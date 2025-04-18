import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class WeaponSystem {
    constructor(camera, physicsWorld) {
        this.camera = camera;
        this.physicsWorld = physicsWorld;
        
        // Direct reference to pistol mesh
        this.pistolMesh = null;
        
        // Recoil state
        this.isRecoiling = false;
        this.recoilStartTime = 0;
        this.recoilDuration = 150; // Increased duration for smoother effect
        this.originalPistolPosition = null;
        this.originalPistolRotation = null;
        this.basePistolPosition = null;
        this.basePistolRotation = null;
        this.debugRecoil = false; // Debug flag for recoil
        
        // Headshot streak tracking
        this.consecutiveHeadshots = 0;
        this.headshotStreakBonus = 500; // Points for 3 consecutive headshots
        this.headshotStreakTarget = 3; // Number of headshots needed for bonus
        
        // Create pistol model right away
        this.createPistolModel();
        
        // Sound setup for pistol
        this.gunshotSound = new Audio('/assets/sounds/GunshotPistol_BW.56967.wav');
        this.gunshotSound.volume = 0.5;
        this.reloadSound = new Audio('/assets/sounds/ESM_GW_gun_one_shot_pistol_reload_ammo_mechanical_magazine_reload_1.wav');
        this.reloadSound.volume = 0.7;
        
        // Add headshot sound
        this.headshotSound = new Audio('/assets/sounds/ESM_Undead_Vocal_Headshot_Ghost_Zombie.wav');
        this.headshotSound.volume = 0.9;
        
        // Add headshot streak sound
        this.headshotStreakSound = new Audio('/assets/sounds/ESM_Explainer_Video_One_Shot_Gestures_Whoosh_1_Alert_Game.wav');
        this.headshotStreakSound.volume = 0.8;
        
        // Pistol state
        this.isReloading = false;
        this.bulletsFired = 0;
        this.maxBullets = 15;
        
        // Fast reload perk
        this.hasFastReload = false;
        this.hasSuperFastReload = false;
        this.normalReloadTime = 2000; // 2 seconds for normal reload
        this.fastReloadTime = 705;    // 0.705 seconds for fast reload (2.8x faster)
        this.superFastReloadTime = 352.5; // 0.3525 seconds for super fast reload (5.7x faster)
        
        // Setup reload event listener
        this.reloadSound.addEventListener('ended', () => {
            this.isReloading = false;
            this.bulletsFired = 0;
            console.log("Reload complete");
        });
        
        // Bullet system
        this.bullets = [];
        this.particles = []; // Generic particle array for blood, etc.
        this.lastShotTime = 0;
        this.shootCooldown = 87.5; // Reduced by 30% from 125ms
        this.bulletSpeed = 0.5; // Changed from 100 to 0.5 for more reasonable speed
        this.bulletLifetime = 10000; // 10 seconds
        this.bulletDamage = 25; // Damage per bullet hit
        this.smokeTrails = []; // Store smoke trail particles
        this.smokeSpawnRate = 50; // milliseconds between smoke particles
        this.isGameOver = false; // Track game over state
        this.gameActive = false; // Flag to prevent shooting before game starts
        
        // Bind methods to preserve 'this' context
        this.shoot = this.shoot.bind(this);
        this.reload = this.reload.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize hitbox visualization state
        this.showHitboxes = false;
    }
    
    createPistolModel() {
        const loader = new GLTFLoader();
        loader.load(
            'assets/3d models/guns/pistol_stryk_prototype.glb',
            (gltf) => {
                this.pistolMesh = gltf.scene;
                
                // Apply metallic material to all meshes in the model
                this.pistolMesh.traverse((child) => {
                    if (child.isMesh) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0x888888, // Gun metal gray
                            metalness: 0.9,  // High metalness for metallic look
                            roughness: 0.2,  // Low roughness for shiny appearance
                            envMapIntensity: 1.0, // Full environment map intensity
                        });
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // CRITICAL: Set userData to identify this as pistol
                this.pistolMesh.userData.isPistolMesh = true;
                
                // Create axis helper but don't add it to the pistol by default
                this.axisHelper = new THREE.AxesHelper(1);
                this.axisHelper.visible = false; // Start hidden
                this.pistolMesh.add(this.axisHelper);
                
                // Add directly to scene
                this.physicsWorld.scene.add(this.pistolMesh);
                
                // Set initial position
                this.updatePistolPosition();
                
                console.log("Loaded pistol model with metallic shader");
            },
            (progress) => {
                console.log(`Loading pistol model: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
            },
            (error) => {
                console.error('Error loading pistol model:', error);
                // Fallback to simple cube if model fails to load
                this.createFallbackPistolModel();
            }
        );
    }
    
    createFallbackPistolModel() {
        // Create a simple, highly visible pistol representation
        const pistolGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.8);
        const pistolMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFF0000, // Bright red - will be visible regardless of lighting
        });
        
        const pistolMesh = new THREE.Mesh(pistolGeometry, pistolMaterial);
        
        // CRITICAL: Set userData to identify this as pistol
        pistolMesh.userData.isPistolMesh = true;
        
        // Important: Store reference to the mesh on the instance
        this.pistolMesh = pistolMesh;
        
        // Create axis helper but don't add it to the pistol by default
        this.axisHelper = new THREE.AxesHelper(1);
        this.axisHelper.visible = false; // Start hidden
        this.pistolMesh.add(this.axisHelper);
        
        // Add directly to scene
        this.physicsWorld.scene.add(this.pistolMesh);
        
        // Set initial position
        this.updatePistolPosition();
        
        console.log("Created fallback BRIGHT RED pistol cube - added directly to scene");
    }
    
    // Update the pistol position method to keep it fixed relative to camera
    updatePistolPosition() {
        if (!this.pistolMesh || !this.camera) return;
        
        // Calculate pistol position in world space based on camera view
        const cameraPosition = this.camera.position.clone();
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(this.camera.quaternion);
        
        // Fixed offsets in camera space - adjusted for the new model
        const rightOffset = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(0.55); // Slightly reduced from 0.6 to move it more to the left
        const downOffset = new THREE.Vector3(0, -1, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(0.5);
        const forwardOffset = cameraDirection.clone().multiplyScalar(0.8);
        
        // Apply all offsets to position pistol in bottom right corner
        const pistolPosition = cameraPosition.clone()
            .add(rightOffset)
            .add(downOffset)
            .add(forwardOffset);
        
        // Store the base position for recoil calculations
        this.basePistolPosition = pistolPosition.clone();
        
        // Update pistol position
        this.pistolMesh.position.copy(pistolPosition);
        
        // Make pistol face the same direction as camera
        this.pistolMesh.quaternion.copy(this.camera.quaternion);
        
        // Apply a slight rotation to align the gun properly
        const gunRotation = new THREE.Quaternion();
        gunRotation.setFromEuler(new THREE.Euler(0, Math.PI, 0));
        this.pistolMesh.quaternion.multiply(gunRotation);
        
        // Store the base rotation for recoil calculations
        this.basePistolRotation = this.pistolMesh.quaternion.clone();
        
        // Scale the model appropriately - slightly smaller
        this.pistolMesh.scale.set(3.8, 3.8, 3.8); // Reduced from 4.14 to 3.8
        
        // Ensure visibility
        this.pistolMesh.visible = true;
    }
    
    canShoot() {
        return !this.isReloading;
    }
    
    // Method to load hitbox config from assets/hitboxes folder for enemy type
    loadHitboxConfig(enemyType) {
        return new Promise((resolve, reject) => {
            const filePath = `assets/hitboxes/${enemyType.toLowerCase()}_hitboxes.json`;
            console.log(`Loading hitbox config from: ${filePath}`);
            
            fetch(filePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load hitbox config: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log(`Successfully loaded hitbox config for ${enemyType}:`, data);
                    resolve(data);
                })
                .catch(error => {
                    console.warn(`Error loading hitbox config for ${enemyType}: ${error.message}`);
                    resolve(null); // Resolve with null instead of rejecting
                });
        });
    }
    
    // Method to apply hitbox data to an enemy model
    applyHitboxesToEnemyModel(enemyObject, hitboxConfig, enemyType, makeVisible = false) {
        if (!enemyObject || !hitboxConfig || !Array.isArray(hitboxConfig)) {
            console.warn(`Cannot apply hitboxes: Invalid inputs for ${enemyType}`);
            return false;
        }
        
        // Check if the hitboxConfig has a hitboxes array (newer format with metadata)
        const hitboxArray = Array.isArray(hitboxConfig.hitboxes) ? hitboxConfig.hitboxes : hitboxConfig;
        
        if (hitboxArray.length === 0) {
            console.warn(`No hitboxes found in config for ${enemyType}`);
            return false;
        }
        
        console.log(`Applying ${hitboxArray.length} hitboxes to ${enemyType} model`);
        console.log(`Debug: Full hitbox data:`, JSON.stringify(hitboxArray));
        
        // Set a property on the enemy object indicating hitboxes are loaded
        enemyObject.userData.hitboxesLoaded = true;
        enemyObject.name = `${enemyType}_Model`;
        
        // Remove any existing hitbox meshes
        enemyObject.traverse((child) => {
            if (child.userData && child.userData.isHitbox) {
                enemyObject.remove(child);
            }
        });
        
        // Store the model's scale for reference
        const modelScale = {
            x: enemyObject.scale.x,
            y: enemyObject.scale.y,
            z: enemyObject.scale.z
        };
        
        console.log(`*** DEBUG: Model scale for ${enemyType}: x=${modelScale.x}, y=${modelScale.y}, z=${modelScale.z}`);
        
        // Scaling factor to match hitboxes in editor to in-game size
        const hitboxScaleFactor = 1.0; // Using neutral scaling since hitbox JSON values are now pre-scaled
        
        // Add new hitboxes
        hitboxArray.forEach((hitboxData, index) => {
            // Create the geometry based on shape
            let geometry;
            const shape = hitboxData.shape || 'box';
            
            switch (shape) {
                case 'sphere':
                    geometry = new THREE.SphereGeometry(0.5, 16, 16);
                    break;
                case 'cylinder':
                    geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
                    break;
                default: // 'box' is the default
                    geometry = new THREE.BoxGeometry(1, 1, 1);
                    break;
            }
            
            // Create the material - visible or invisible based on parameter
            let material;
            if (makeVisible) {
                // Visible colored material based on hitbox type
                let color = this.getHitboxColor(hitboxData.type || 'Default');
                
                material = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.5,
                    wireframe: true
                });
            } else {
                // Invisible material for normal gameplay
                material = new THREE.MeshBasicMaterial({
                    visible: false,
                    transparent: true,
                    opacity: 0,
                    alphaTest: 0
                });
            }
            
            // Create the hitbox mesh
            const hitboxMesh = new THREE.Mesh(geometry, material);
            hitboxMesh.visible = makeVisible; // Only visible if requested
            
            // Set position from saved data - apply the scaling factor to match in-game scale
            const position = hitboxData.position || { x: 0, y: 0, z: 0 };
            hitboxMesh.position.set(
                parseFloat(position.x) * hitboxScaleFactor || 0,
                parseFloat(position.y) * hitboxScaleFactor || 0,
                parseFloat(position.z) * hitboxScaleFactor || 0
            );
            
            // Set scale from saved data - apply the scaling factor to match in-game scale
            const scale = hitboxData.scale || { x: 1, y: 1, z: 1 };
            hitboxMesh.scale.set(
                parseFloat(scale.x) * hitboxScaleFactor || 1,
                parseFloat(scale.y) * hitboxScaleFactor || 1,
                parseFloat(scale.z) * hitboxScaleFactor || 1
            );
            
            console.log(`Hitbox ${index} position=(${hitboxMesh.position.x.toFixed(2)}, ${hitboxMesh.position.y.toFixed(2)}, ${hitboxMesh.position.z.toFixed(2)}), scale=(${hitboxMesh.scale.x.toFixed(2)}, ${hitboxMesh.scale.y.toFixed(2)}, ${hitboxMesh.scale.z.toFixed(2)})`);
            
            // Store hitbox metadata in userData
            hitboxMesh.userData = {
                isHitbox: true,
                hitboxType: hitboxData.type || 'Default',
                damageMultiplier: hitboxData.damageMultiplier || '1x',
                shape: shape,
                originalPosition: {
                    x: parseFloat(position.x) || 0,
                    y: parseFloat(position.y) || 0,
                    z: parseFloat(position.z) || 0
                },
                originalScale: {
                    x: parseFloat(scale.x) || 1,
                    y: parseFloat(scale.y) || 1,
                    z: parseFloat(scale.z) || 1
                }
            };
            
            // Add the hitbox to the enemy model
            enemyObject.add(hitboxMesh);
            
            console.log(`*** DEBUG: Hitbox ${index} (${hitboxMesh.userData.hitboxType}): using editor values position=(${position.x}, ${position.y}, ${position.z}), scale=(${scale.x}, ${scale.y}, ${scale.z}), applied with ${hitboxScaleFactor}x multiplier`);
        });
        
        return true;
    }

    shoot() {
        // Prevent shooting if game over or not active yet
        if (this.isGameOver || !this.gameActive) {
            return;
        }
        
        // Ensure pistol is visible
        if (this.pistolMesh) {
            this.pistolMesh.visible = true;
        }
        
        const currentTime = Date.now();
        if (currentTime - this.lastShotTime < this.shootCooldown) {
            return; // Still on cooldown
        }
        
        // Check if pistol can shoot (not reloading)
        if (!this.canShoot()) {
            return;
        }
        
        this.lastShotTime = currentTime;
        
        // DIRECT RECOIL IMPLEMENTATION - Apply recoil immediately
        this.applyRecoil();
        
        // Play gunshot sound only if not game over
        if (!this.isGameOver) {
            this.gunshotSound.currentTime = 0;
            this.gunshotSound.play().catch(error => {
                console.log("Error playing gunshot sound:", error);
            });
        }
        
        // Increment bullets fired counter
        this.bulletsFired++;
        
        // Check if magazine is empty
        if (this.bulletsFired >= this.maxBullets) {
            this.reload();
        }
        
        // Get camera direction
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        direction.normalize();
        
        // CRITICAL FIX: Force all hitboxes to be visible to raycasting
        // before shooting to ensure hit detection works
        this.physicsWorld.scene.traverse((object) => {
            if (object.userData && (object.userData.isLokitoMesh || object.userData.isDNBMesh)) {
                // Ensure the enemy mesh itself is visible for raycasting
                object.visible = true;
                
                // Log the enemy check for debug
                console.log(`DEBUG-SHOOT: Checking enemy mesh: ${object.name || 'unnamed'}, visible=${object.visible}`);
                
                object.traverse((child) => {
                    if (child.userData && child.userData.isHitbox) {
                        // Log the hitbox check for debug
                        console.log(`DEBUG-SHOOT: Found hitbox: ${child.userData.hitboxType}, current visibility=${child.visible}`);
                        
                        // CRITICAL: Ensure hitbox is always ray-visible regardless of visual state
                        child.visible = true;
                        
                        // Make sure the material allows raycasting even if transparent
                        if (child.material) {
                            child.material.alphaTest = 0; // Ensure we hit even if transparent
                        }
                    }
                });
            }
        });
        
        // Raycasting for hit detection
        const raycaster = new THREE.Raycaster(this.camera.position, direction);
        // Increase near plane slightly to avoid hitting self/gun
        raycaster.near = 0.6; 
        raycaster.far = 1000;

        // Create a filter function to ignore rain and other non-target objects
        const intersects = raycaster.intersectObjects(this.physicsWorld.scene.children, true)
            .filter(hit => {
                // Skip any object (or its parents) that are marked to ignore raycasts
                let currentObj = hit.object;
                while (currentObj) {
                    // Check if this object or any parent has the ignoreRaycast flag
                    if (currentObj.userData && 
                        (currentObj.userData.ignoreRaycast === true || 
                         currentObj.userData.isPistolMesh === true)) {
                        return false;
                    }
                    // Check its parent
                    currentObj = currentObj.parent;
                }
                // Also skip any bullet meshes
                if (hit.object.userData && hit.object.userData.isBullet) {
                    return false;
                }
                return true;
            });

        let hitDetected = false;
        if (intersects.length > 0) {
            for (let i = 0; i < intersects.length; i++) {
                 const hit = intersects[i];
                 // Find the mesh associated with a potential enemy physics body
                 let currentObject = hit.object;
                 let enemyInstance = null; // Use generic name
                 let enemyBodyUUID = null; // Use generic name
                 let enemyType = null; // Store type ('lokito' or 'dnb')

                 while (currentObject && !enemyInstance) { 
                      // Check for Lokito OR DNB mesh userData
                      if (currentObject.userData && currentObject.userData.isLokitoMesh && currentObject.userData.lokitoBodyUUID) {
                           enemyBodyUUID = currentObject.userData.lokitoBodyUUID;
                           enemyType = 'Lokito'; // Identify type
                      } else if (currentObject.userData && currentObject.userData.isDNBMesh && currentObject.userData.dnbBodyUUID) {
                           enemyBodyUUID = currentObject.userData.dnbBodyUUID;
                           enemyType = 'DNB'; // Identify type
                      }
                      
                      // If a UUID was found, try to get the instance
                      if (enemyBodyUUID) {
                           const body = this.physicsWorld.bodies.get(enemyBodyUUID);
                           // Check both possible instance property names (adjust if DNB uses different name)
                           if (body && body.userData && (body.userData.lokitoInstance || body.userData.dnbInstance)) {
                                enemyInstance = body.userData.lokitoInstance || body.userData.dnbInstance; 
                                break; 
                           }
                      }
                      currentObject = currentObject.parent;
                 }

                 if (enemyInstance && enemyInstance.isInitialized) {
                      // --- Hit an Enemy (Lokito or DNB) ---
                      console.log(`Raycast hit ${enemyType}: ${enemyBodyUUID}`); // Use type
                      console.log(`[WeaponSystem] Hit confirmed for ${enemyType}. Setting hitDetected.`);
                      
                      // Check if the enemy mesh has hitboxes, if not, try to load them
                      // This check might be redundant if hitboxes are always loaded on init
                      // if (enemyInstance.mesh && !enemyInstance.mesh.userData.hitboxesLoaded) { ... } // Consider removing if always loaded

                      // Get headshot status and multiplier directly from the hit object's userData
                      let isHeadshot = false;
                      let multiplier = 1.0;
                      let hitSpecificBox = false; // Flag if we hit *any* specific hitbox

                      if (hit.object.userData && hit.object.userData.isHitbox) {
                           hitSpecificBox = true; // We hit a hitbox mesh
                           const hitboxType = hit.object.userData.hitboxType || 'Default';
                           console.log(`Hitbox check: Type='${hitboxType}'`); // Log the type found

                           if (hitboxType === 'Headshot') { // Use 'Headshot' as defined in JSON
                                isHeadshot = true;
                                const multiplierStr = hit.object.userData.damageMultiplier || '1x';
                                const parsedMultiplier = parseFloat(multiplierStr.replace('x', ''));
                                if (!isNaN(parsedMultiplier)) {
                                    multiplier = parsedMultiplier;
                                }
                                console.log(`Headshot hitbox confirmed! Multiplier: ${multiplier}x`);
                           } else {
                                // If it's not 'Headshot', check if it has its own multiplier anyway
                                const multiplierStr = hit.object.userData.damageMultiplier || '1x';
                                const parsedMultiplier = parseFloat(multiplierStr.replace('x', ''));
                                if (!isNaN(parsedMultiplier)) {
                                    multiplier = parsedMultiplier; // Apply multiplier even if not headshot
                                    console.log(`Non-Headshot hitbox '${hitboxType}' hit! Multiplier: ${multiplier}x`);
                                }
                           }
                      } else {
                           console.log("Ray hit the main enemy mesh, not a specific hitbox. Applying default damage.");
                           // Optional: could try isHeadshot logic here as fallback if needed
                      }

                      // Calculate damage using the multiplier
                      let damage = this.bulletDamage * multiplier;
                      console.log(`Calculated Damage: ${this.bulletDamage} * ${multiplier} = ${damage.toFixed(1)}`);

                      // Create damage object with headshot info for enemy to process
                      const damageInfo = {
                          damage: damage,
                          isHeadshot: isHeadshot // Pass the boolean flag
                      };

                      // Apply damage and get result
                      const result = enemyInstance.takeDamage(damageInfo);
                      console.log(`DEBUG-DAMAGE: Enemy damage result:`, result);

                      // Always create blood splatter on hit
                      this.createBloodSplatter(hit);

                      // Check for killing blow and headshot status for points and effects
                      if (result && result.isDead) {
                           console.log(`${enemyType} ${enemyBodyUUID} killed!`);

                           let pointsAwarded = 100; // Base points for a kill

                           if (result.wasHeadshot) {
                                // Killing blow was a headshot
                                console.log("Killing blow was a HEADSHOT!");
                                pointsAwarded *= multiplier; // Apply multiplier to points

                                // Play headshot sound only on killing headshot
                                if (this.headshotSound) {
                                    this.headshotSound.currentTime = 0;
                                    this.headshotSound.play().catch(error => {
                                        console.log("Error playing headshot sound:", error);
                                    });
                                }

                                // Display headshot message only on killing headshot
                                this.displayHeadshotMessage();
                                
                                // Increment consecutive headshots counter
                                this.consecutiveHeadshots++;
                                console.log(`Consecutive headshots: ${this.consecutiveHeadshots}`);
                                
                                // Check if player achieved the headshot streak
                                if (this.consecutiveHeadshots >= this.headshotStreakTarget) {
                                    // Award bonus points
                                    if (this.playerController && typeof this.playerController.addScore === 'function') {
                                        this.playerController.addScore(this.headshotStreakBonus);
                                        console.log(`HEADSHOT STREAK BONUS! Awarded ${this.headshotStreakBonus} points.`);
                                    }
                                    // Display streak message
                                    this.displayHeadshotStreakMessage();
                                    // Reset streak counter after awarding
                                    this.consecutiveHeadshots = 0;
                                }

                           } else {
                                console.log("Killing blow was a normal hit.");
                           }

                           // Award points
                           if (this.playerController && typeof this.playerController.addScore === 'function') {
                                this.playerController.addScore(pointsAwarded);
                                console.log(`Awarded ${pointsAwarded} points.`);
                           } else {
                                console.warn("PlayerController or addScore method not found, cannot award points.");
                           }
                      } else if (isHeadshot) {
                           // If it was a headshot but not a killing blow, still maybe show a hit marker?
                           // this.createHeadshotHitMarker(hit.point); // Re-enable if desired for non-killing headshots
                           console.log("Registered a non-killing headshot.");
                      }

                      hitDetected = true;
                      break; // Stop checking after hitting the first valid enemy
                 } else if (hit.object.userData && hit.object.userData.isHitbox) {
                     // --- Hit an Enemy Hitbox directly (might happen if main mesh check fails) ---
                     // Try to find the parent enemy instance
                     let parentObject = hit.object.parent;
                     let enemyInstance = null;
                     let enemyBodyUUID = null;
                     let enemyType = null;

                     while (parentObject && !enemyInstance) {
                         if (parentObject.userData && parentObject.userData.isLokitoMesh && parentObject.userData.lokitoBodyUUID) {
                              enemyBodyUUID = parentObject.userData.lokitoBodyUUID;
                              enemyType = 'Lokito';
                         } else if (parentObject.userData && parentObject.userData.isDNBMesh && parentObject.userData.dnbBodyUUID) {
                              enemyBodyUUID = parentObject.userData.dnbBodyUUID;
                              enemyType = 'DNB';
                         }

                         if (enemyBodyUUID) {
                              const body = this.physicsWorld.bodies.get(enemyBodyUUID);
                              if (body && body.userData && (body.userData.lokitoInstance || body.userData.dnbInstance)) {
                                   enemyInstance = body.userData.lokitoInstance || body.userData.dnbInstance;
                                   break;
                              }
                         }
                         parentObject = parentObject.parent;
                     }

                     if (enemyInstance && enemyInstance.isInitialized) {
                         console.log(`Direct Hitbox Hit on ${enemyType}: ${enemyBodyUUID}`);
                         // Duplicate logic from above (Refactor opportunity later)
                         let isHeadshot = false;
                         let multiplier = 1.0;
                         const hitboxType = hit.object.userData.hitboxType || 'Default';
                         console.log(`Direct Hitbox Type='${hitboxType}'`);

                         if (hitboxType === 'Headshot') {
                              isHeadshot = true;
                              const multiplierStr = hit.object.userData.damageMultiplier || '1x';
                              const parsedMultiplier = parseFloat(multiplierStr.replace('x', ''));
                              if (!isNaN(parsedMultiplier)) {
                                  multiplier = parsedMultiplier;
                              }
                              console.log(`Direct Headshot! Multiplier: ${multiplier}x`);
                         } else {
                              const multiplierStr = hit.object.userData.damageMultiplier || '1x';
                              const parsedMultiplier = parseFloat(multiplierStr.replace('x', ''));
                              if (!isNaN(parsedMultiplier)) {
                                  multiplier = parsedMultiplier;
                                  console.log(`Direct Non-Headshot '${hitboxType}'! Multiplier: ${multiplier}x`);
                              }
                         }

                         let damage = this.bulletDamage * multiplier;
                         const damageInfo = { damage: damage, isHeadshot: isHeadshot };
                         const result = enemyInstance.takeDamage(damageInfo);
                         console.log(`DEBUG-DAMAGE (Direct Hitbox): Enemy damage result:`, result);
                         this.createBloodSplatter(hit);

                         if (result && result.isDead) {
                              console.log(`${enemyType} ${enemyBodyUUID} killed! (Direct Hitbox)`);
                              let pointsAwarded = 100;
                              if (result.wasHeadshot) {
                                   console.log("Killing blow was a HEADSHOT! (Direct Hitbox)");
                                   pointsAwarded *= multiplier;
                                   if (this.headshotSound) { this.headshotSound.currentTime = 0; this.headshotSound.play().catch(e => console.log(e)); }
                                   this.displayHeadshotMessage();
                                   
                                   // Increment consecutive headshots counter (Direct Hitbox)
                                   this.consecutiveHeadshots++;
                                   console.log(`Consecutive headshots: ${this.consecutiveHeadshots}`);
                                   
                                   // Check if player achieved the headshot streak
                                   if (this.consecutiveHeadshots >= this.headshotStreakTarget) {
                                       // Award bonus points
                                       if (this.playerController && typeof this.playerController.addScore === 'function') {
                                           this.playerController.addScore(this.headshotStreakBonus);
                                           console.log(`HEADSHOT STREAK BONUS! Awarded ${this.headshotStreakBonus} points.`);
                                       }
                                       // Display streak message
                                       this.displayHeadshotStreakMessage();
                                       // Reset streak counter after awarding
                                       this.consecutiveHeadshots = 0;
                                   }
                              } else { console.log("Killing blow normal. (Direct Hitbox)"); }
                              if (this.playerController && typeof this.playerController.addScore === 'function') {
                                   this.playerController.addScore(pointsAwarded);
                                   console.log(`Awarded ${pointsAwarded} points. (Direct Hitbox)`);
                              } else { console.warn("PlayerController/addScore missing. (Direct Hitbox)"); }
                         } else if (isHeadshot) {
                              console.log("Registered non-killing headshot. (Direct Hitbox)");
                         }
                         hitDetected = true;
                         break;
                     } else {
                         console.log("Hit a hitbox but couldn't find associated enemy instance.");
                         // Hit something else, maybe environment
                         break; // Stop checking after hitting the first valid non-enemy surface
                     }

                 } else if (!hit.object.userData.isBullet) {
                      // --- Hit a Non-Enemy Surface ---
                      // Show hit marker on surfaces too - REMOVED
                      break; // Stop checking after hitting the first valid surface
                 }
            }
        }

        console.log(`[WeaponSystem] After raycast loop, hitDetected = ${hitDetected}`);
        // Only create a bullet if the raycast didn't hit a valid enemy target
        if (!hitDetected) {
             console.log("[WeaponSystem] Hit not detected or invalid, creating visual bullet.");
            // --- Bullet Creation Logic --- 
            const bulletGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.084, 16);
            const bulletMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xFFD700, // Gold color
                roughness: 0.1,  // Lower roughness for shinier appearance
                metalness: 1.0,  // Full metalness for metallic look
                emissive: 0xAA8500, // Subtle gold emissive color
                emissiveIntensity: 0.4 // Lower intensity for metallic look
            });
            const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
            
            // Set bullet userData flag to ignore mesh view toggle
            bulletMesh.userData.isBullet = true;
            bulletMesh.userData.ignoresMeshToggle = true;
            
            // Position bullet at the end of the pistol barrel
            const bulletPosition = new THREE.Vector3(0, 0, -0.5);
            bulletPosition.applyQuaternion(this.camera.quaternion);
            bulletPosition.add(this.camera.position);
            
            bulletMesh.position.copy(bulletPosition);
            
            // FIXED APPROACH: Use a more direct method to orient the bullet
            // First, create a quaternion that aligns the cylinder with the forward direction
            const bulletQuaternion = new THREE.Quaternion();
            
            // Create a rotation matrix that aligns the bullet with the camera direction
            const rotationMatrix = new THREE.Matrix4();
            const upVector = new THREE.Vector3(0, 1, 0);
            rotationMatrix.lookAt(new THREE.Vector3(0, 0, 0), direction, upVector);
            
            // Extract the quaternion from the rotation matrix
            bulletQuaternion.setFromRotationMatrix(rotationMatrix);
            
            // Apply an additional rotation to align the cylinder with the forward direction
            // This ensures the circular side of the cylinder faces the crosshair
            const cylinderRotation = new THREE.Quaternion();
            cylinderRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
            bulletQuaternion.multiply(cylinderRotation);
            
            // Apply the rotation to the bullet
            bulletMesh.quaternion.copy(bulletQuaternion);
            
            // Add bullet to scene
            this.physicsWorld.scene.add(bulletMesh);
            
            // Create bullet physics body
            const bulletBody = this.physicsWorld.createBullet(bulletPosition);
            
            // Link the bullet mesh with its physics body
            const bulletId = bulletBody.userData.id;
            bulletMesh.userData.bulletId = bulletId;
            
            // Store bullet data
            const bullet = {
                mesh: bulletMesh,
                body: bulletBody,
                createdAt: currentTime,
                lastSmokeTime: 0, // Track when we last spawned smoke for this bullet
                initialDirection: direction.clone() // Store the initial direction for reference
            };
            
            this.bullets.push(bullet);
            
            // Apply impulse to make bullets move
            const impulse = {
                x: direction.x * this.bulletSpeed * 2,
                y: direction.y * this.bulletSpeed * 2,
                z: direction.z * this.bulletSpeed * 2
            };
            
            // Apply the impulse to the bullet body
            bulletBody.applyImpulse(impulse, true);
            
            console.log("Bullet created with ID:", bulletId);
        }
    }
    
    createBloodSplatter(hit) {
        const position = hit.point;
        
        // Clone the normal to avoid modifying the original face normal
        let normal = hit.face ? hit.face.normal.clone() : null; 

        if (!normal) {
            console.warn("Blood splatter: Hit face normal not available.");
            return; 
        }
        
        // Ensure normal is normalized
        normal.normalize();

        const particleCount = 15;
        const bloodMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x8B0000, // Darker Red
            transparent: true,
            opacity: 0.7,
            depthWrite: false // Disable depth writing for particles
        });

        for (let i = 0; i < particleCount; i++) {
            // const particleSize = Math.random() * 0.05 + 0.01; 
            const particleSize = Math.random() * 0.06 + 0.02; // Slightly larger minimum size
            const particleGeometry = new THREE.SphereGeometry(particleSize, 4, 4);
            const particle = new THREE.Mesh(particleGeometry, bloodMaterial.clone());
            
            // Set blood userData flags to ensure visibility
            particle.userData.ignoresMeshToggle = true;
            particle.userData.type = 'blood';
            
            // Spawn slightly outside the hit point along the normal
            // const spawnOffset = 0.1; // Increase offset further
            const spawnOffset = 0.25; // Increase offset substantially
            const spawnPosition = position.clone().addScaledVector(normal, spawnOffset);
            particle.position.copy(spawnPosition);

            // Base velocity on the surface normal - CHANGED to random direction
            // let velocity = normal.clone();
            let velocity = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize(); // Random direction

            // Apply speed (no longer needs spread calculation)
            /*
            const spreadAngle = Math.PI / 1.2; // Even wider spread
            const randomAngle = Math.random() * spreadAngle - spreadAngle / 2;
            const randomRotationAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            velocity.applyAxisAngle(randomRotationAxis, randomAngle);
            */ 
            velocity.multiplyScalar(Math.random() * 2.0 + 0.8); // Adjusted speed range (0.8 to 2.8)

            this.physicsWorld.scene.add(particle);

            this.particles.push({
                mesh: particle,
                velocity: velocity,
                life: Math.random() * 0.6 + 0.4, // Lifetime 0.4 to 1.0 seconds
                startTime: Date.now(),
                gravity: 5.0 // Lower gravity effect
            });
        }
    }
    
    createSmokeParticle(position) {
        const smokeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        const smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.5
        });
        const smokeMesh = new THREE.Mesh(smokeGeometry, smokeMaterial);
        smokeMesh.position.copy(position);
        
        // Add some random offset to make it look more natural
        smokeMesh.position.x += (Math.random() - 0.5) * 0.02;
        smokeMesh.position.y += (Math.random() - 0.5) * 0.02;
        smokeMesh.position.z += (Math.random() - 0.5) * 0.02;
        
        this.physicsWorld.scene.add(smokeMesh);
        
        return {
            mesh: smokeMesh,
            createdAt: Date.now(),
            lifetime: 1000, // Smoke particles last 1 second
            initialScale: 1.0
        };
    }
    
    update(deltaTime) {
        const currentTime = Date.now();
        
        // Always update the base position and rotation to ensure the gun stays fixed relative to the camera
        this.updateBasePositionAndRotation();
        
        // If not recoiling, update the pistol position to match the base position
        if (!this.isRecoiling) {
            if (this.basePistolPosition && this.basePistolRotation) {
                this.pistolMesh.position.copy(this.basePistolPosition);
                this.pistolMesh.quaternion.copy(this.basePistolRotation);
            }
        }
        
        // ENSURE PISTOL VISIBILITY AT EVERY FRAME
        if (this.pistolMesh) {
            // Force visibility every frame
            this.pistolMesh.visible = true;
            
            // Log pistol status every 5 seconds for debugging
            if (Math.floor(currentTime / 1000) % 5 === 0 && !this._lastVisibilityLog) {
                console.log("Pistol visibility:", this.pistolMesh.visible,
                    "Position:", 
                    this.pistolMesh.position.x.toFixed(2),
                    this.pistolMesh.position.y.toFixed(2),
                    this.pistolMesh.position.z.toFixed(2)
                );
                this._lastVisibilityLog = true;
            } else if (Math.floor(currentTime / 1000) % 5 !== 0) {
                this._lastVisibilityLog = false;
            }
        }
        
        // Update bullets and create smoke trails
        this.bullets.forEach(bullet => {
            // CRITICAL FIX: Force bullet and smoke visibility regardless of mesh view toggle
            if (bullet.mesh) {
                bullet.mesh.visible = true;
            }
            
            // Update bullet mesh position from physics body
            const position = bullet.body.translation();
            bullet.mesh.position.set(position.x, position.y, position.z);
            
            // Update bullet orientation to match its velocity direction
            const velocity = bullet.body.linvel();
            if (velocity.x !== 0 || velocity.y !== 0 || velocity.z !== 0) {
                // Create a direction vector from the velocity
                const direction = new THREE.Vector3(velocity.x, velocity.y, velocity.z).normalize();
                
                // FIXED APPROACH: Use the same method as in the shoot function
                // Create a rotation matrix that aligns the bullet with the velocity direction
                const rotationMatrix = new THREE.Matrix4();
                const upVector = new THREE.Vector3(0, 1, 0);
                rotationMatrix.lookAt(new THREE.Vector3(0, 0, 0), direction, upVector);
                
                // Extract the quaternion from the rotation matrix
                const bulletQuaternion = new THREE.Quaternion();
                bulletQuaternion.setFromRotationMatrix(rotationMatrix);
                
                // Apply an additional rotation to align the cylinder with the forward direction
                const cylinderRotation = new THREE.Quaternion();
                cylinderRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
                bulletQuaternion.multiply(cylinderRotation);
                
                // Apply the rotation to the bullet
                bullet.mesh.quaternion.copy(bulletQuaternion);
            }
            
            // Check if it's time to spawn a new smoke particle
            if (!bullet.lastSmokeTime || currentTime - bullet.lastSmokeTime >= this.smokeSpawnRate) {
                const position = bullet.mesh.position.clone();
                const smokeParticle = this.createSmokeParticle(position);
                
                // CRITICAL FIX: Mark smoke particles to stay visible
                if (smokeParticle && smokeParticle.mesh) {
                    smokeParticle.mesh.userData.ignoresMeshToggle = true;
                    smokeParticle.mesh.visible = true;
                }
                
                this.smokeTrails.push(smokeParticle);
                bullet.lastSmokeTime = currentTime;
            }
        });
        
        // CRITICAL FIX: Force smoke visibility
        this.smokeTrails.forEach(smoke => {
            if (smoke.mesh) {
                smoke.mesh.visible = true;
            }
        });
        
        // Remove bullets that have exceeded their lifetime
        this.bullets = this.bullets.filter(bullet => {
            if (currentTime - bullet.createdAt > this.bulletLifetime) {
                this.physicsWorld.scene.remove(bullet.mesh);
                this.physicsWorld.removeBody(bullet.body);
                return false;
            }
            return true;
        });
        
        // Update smoke trails
        this.smokeTrails = this.smokeTrails.filter(smoke => {
            const age = currentTime - smoke.createdAt;
            if (age > smoke.lifetime) {
                this.physicsWorld.scene.remove(smoke.mesh);
                return false;
            }
            
            // Update smoke appearance
            const lifeRatio = 1 - (age / smoke.lifetime);
            smoke.mesh.material.opacity = lifeRatio * 0.5;
            
            // Scale up the smoke over time
            const scale = smoke.initialScale + (1 - lifeRatio) * 2;
            smoke.mesh.scale.set(scale, scale, scale);
            
            return true;
        });

        // ADD BACK generic particles (blood) update logic
        const now = Date.now();
        this.particles = this.particles.filter(p => {
            // CRITICAL FIX: Force blood particles to stay visible
            if (p.mesh) {
                p.mesh.visible = true;
            }
            
            const elapsedTime = (now - p.startTime) / 1000; 
            if (elapsedTime > p.life) {
                this.physicsWorld.scene.remove(p.mesh);
                // Dispose geometry/material ? Maybe overkill for small particles
                return false;
            }
            p.velocity.y -= p.gravity * deltaTime;
            p.mesh.position.add(p.velocity.clone().multiplyScalar(deltaTime));
            p.mesh.material.opacity = (1.0 - (elapsedTime / p.life)) * 0.7;
            return true;
        });
    }

    // Helper method to determine if a hit is a headshot
    isHeadshot(hitPoint, enemyPosition, enemyType) {
        let hitHeadbox = false;
        let damageMultiplier = 1.0;
        let hitboxType = "none";
        
        console.log(`Checking headshot for ${enemyType} at: ${hitPoint.x.toFixed(2)}, ${hitPoint.y.toFixed(2)}, ${hitPoint.z.toFixed(2)}`);
        
        // First check the enemy mesh directly
        if (this.physicsWorld && this.physicsWorld.scene) {
            // Find all active enemies in the scene
            this.physicsWorld.scene.traverse((object) => {
                // Check for Lokito or DNB meshes
                if ((object.userData && object.userData.isLokitoMesh && enemyType === 'Lokito') ||
                    (object.userData && object.userData.isDNBMesh && enemyType === 'DNB')) {
                    
                    console.log(`Found ${enemyType} mesh, checking for hitboxes...`);
                    
                    // Check if this object has hitbox children
                    let hitboxFound = false;
                    
                    object.traverse((child) => {
                        if (child.userData && child.userData.isHitbox) {
                            hitboxFound = true;
                            
                            // Calculate world position of the hitbox
                            const worldPos = new THREE.Vector3();
                            child.getWorldPosition(worldPos);
                            
                            // Get world scale
                            const worldScale = new THREE.Vector3();
                            child.getWorldScale(worldScale);
                            
                            console.log(`Testing hitbox: ${child.userData.hitboxType} at ${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}`);
                            
                            // We need the actual mesh to get correct geometry parameters
                            let halfWidth = 0.5;
                            let halfHeight = 0.5;
                            let halfDepth = 0.5;
                            
                            if (child.geometry && child.geometry.parameters) {
                                if (child.geometry.type === 'BoxGeometry' || child.geometry.type === 'BoxBufferGeometry') {
                                    halfWidth = (child.geometry.parameters.width || 1) * worldScale.x / 2;
                                    halfHeight = (child.geometry.parameters.height || 1) * worldScale.y / 2;
                                    halfDepth = (child.geometry.parameters.depth || 1) * worldScale.z / 2;
                                    
                                    console.log(`Box dimensions: ${halfWidth.toFixed(2)} x ${halfHeight.toFixed(2)} x ${halfDepth.toFixed(2)}`);
                                    
                                    // Check if hit point is inside this box hitbox
                                    if (Math.abs(hitPoint.x - worldPos.x) <= halfWidth &&
                                        Math.abs(hitPoint.y - worldPos.y) <= halfHeight &&
                                        Math.abs(hitPoint.z - worldPos.z) <= halfDepth) {
                                        
                                        console.log(`Hit detected on ${child.userData.hitboxType} box hitbox!`);
                                        
                                        if (child.userData.hitboxType === 'Head') {
                                            hitHeadbox = true;
                                            hitboxType = "Head";
                                            
                                            // Get damage multiplier if available
                                            if (child.userData.damageMultiplier) {
                                                const multiplierStr = child.userData.damageMultiplier.toString();
                                                const multiplierVal = parseFloat(multiplierStr.replace('x', ''));
                                                if (!isNaN(multiplierVal)) {
                                                    damageMultiplier = multiplierVal;
                                                }
                                            }
                                        } else {
                                            hitboxType = child.userData.hitboxType || "unknown";
                                        }
                                    }
                                } 
                                else if (child.geometry.type === 'SphereGeometry' || child.geometry.type === 'SphereBufferGeometry') {
                                    // For sphere, check if point is within radius
                                    const radius = (child.geometry.parameters.radius || 0.5) * Math.max(worldScale.x, worldScale.y, worldScale.z);
                                    console.log(`Sphere radius: ${radius.toFixed(2)}`);
                                    
                                    // Calculate distance from hit point to sphere center
                                    const distance = hitPoint.distanceTo(worldPos);
                                    if (distance <= radius) {
                                        console.log(`Hit detected on ${child.userData.hitboxType} sphere hitbox!`);
                                        
                                        if (child.userData.hitboxType === 'Head') {
                                            hitHeadbox = true;
                                            hitboxType = "Head";
                                            
                                            // Get damage multiplier if available
                                            if (child.userData.damageMultiplier) {
                                                const multiplierStr = child.userData.damageMultiplier.toString();
                                                const multiplierVal = parseFloat(multiplierStr.replace('x', ''));
                                                if (!isNaN(multiplierVal)) {
                                                    damageMultiplier = multiplierVal;
                                                }
                                            }
                                        } else {
                                            hitboxType = child.userData.hitboxType || "unknown";
                                        }
                                    }
                                }
                                else if (child.geometry.type === 'CylinderGeometry' || child.geometry.type === 'CylinderBufferGeometry') {
                                    // For cylinder, do a simplified cylinder check
                                    const radiusTop = (child.geometry.parameters.radiusTop || 0.5) * Math.max(worldScale.x, worldScale.z);
                                    const radiusBottom = (child.geometry.parameters.radiusBottom || 0.5) * Math.max(worldScale.x, worldScale.z);
                                    const height = (child.geometry.parameters.height || 1) * worldScale.y;
                                    
                                    console.log(`Cylinder: top=${radiusTop.toFixed(2)}, bottom=${radiusBottom.toFixed(2)}, height=${height.toFixed(2)}`);
                                    
                                    // Check if point is within the cylinder's height
                                    if (Math.abs(hitPoint.y - worldPos.y) <= height / 2) {
                                        // Now check horizontal distance to central axis
                                        const horizontalDistance = Math.sqrt(
                                            Math.pow(hitPoint.x - worldPos.x, 2) + 
                                            Math.pow(hitPoint.z - worldPos.z, 2)
                                        );
                                        
                                        // Use average radius as an approximation
                                        const averageRadius = (radiusTop + radiusBottom) / 2;
                                        if (horizontalDistance <= averageRadius) {
                                            console.log(`Hit detected on ${child.userData.hitboxType} cylinder hitbox!`);
                                            
                                            if (child.userData.hitboxType === 'Head') {
                                                hitHeadbox = true;
                                                hitboxType = "Head";
                                                
                                                // Get damage multiplier if available
                                                if (child.userData.damageMultiplier) {
                                                    const multiplierStr = child.userData.damageMultiplier.toString();
                                                    const multiplierVal = parseFloat(multiplierStr.replace('x', ''));
                                                    if (!isNaN(multiplierVal)) {
                                                        damageMultiplier = multiplierVal;
                                                    }
                                                }
                                            } else {
                                                hitboxType = child.userData.hitboxType || "unknown";
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                    
                    if (!hitboxFound) {
                        console.log(`No hitboxes found on ${enemyType} mesh!`);
                    }
                }
            });
        }
        
        if (hitHeadbox) {
            console.log(`HEADSHOT confirmed on ${enemyType} with multiplier ${damageMultiplier}x`);
            return {
                isHeadshot: true,
                multiplier: damageMultiplier,
                hitboxType: hitboxType
            };
        } else if (hitboxType !== "none") {
            console.log(`Hit on ${hitboxType} hitbox (not a headshot)`);
        } else {
            console.log(`No hitbox hit detected, not a headshot`);
        }
        
        return {
            isHeadshot: false,
            multiplier: 1.0,
            hitboxType: hitboxType
        };
    }
    
    // Create a distinctive hit marker and display effects for headshots
    createHeadshotHitMarker(position) {
        const markerGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff3300, // Orange-red for headshots
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        
        marker.position.copy(position);
        this.physicsWorld.scene.add(marker);
        
        // Create an additional particle effect for headshots
        const particleCount = 10;
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.03, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.7
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Position around the hit point
            particle.position.copy(position);
            particle.position.x += (Math.random() - 0.5) * 0.2;
            particle.position.y += (Math.random() - 0.5) * 0.2;
            particle.position.z += (Math.random() - 0.5) * 0.2;
            
            this.physicsWorld.scene.add(particle);
            
            // Animate and remove
            const startTime = Date.now();
            const duration = 300 + Math.random() * 200;
            
            const updateParticle = () => {
                const elapsed = Date.now() - startTime;
                if (elapsed < duration) {
                    // Move outward
                    const direction = new THREE.Vector3()
                        .subVectors(particle.position, position)
                        .normalize();
                    particle.position.add(direction.multiplyScalar(0.01));
                    
                    // Fade out
                    particle.material.opacity = 0.7 * (1 - elapsed / duration);
                    requestAnimationFrame(updateParticle);
                } else {
                    // Remove when done
                    this.physicsWorld.scene.remove(particle);
                    particle.material.dispose();
                    particle.geometry.dispose();
                }
            };
            
            requestAnimationFrame(updateParticle);
        }
        
        // Play headshot sound
        if (this.headshotSound) {
            this.headshotSound.currentTime = 0;
            this.headshotSound.play().catch(error => {
                console.log("Error playing headshot sound:", error);
            });
        }
        
        // Display "HEADSHOT" text on screen
        this.displayHeadshotMessage();
        
        // Remove marker after a short time
        setTimeout(() => {
            this.physicsWorld.scene.remove(marker);
            marker.material.dispose();
            marker.geometry.dispose();
        }, 300);
    }
    
    // Display "HEADSHOT" text overlay when scoring a headshot
    displayHeadshotMessage() {
        // Create the headshot message element if it doesn't exist
        if (!this.headshotMessage) {
            const message = document.createElement('div');
            message.id = 'headshot-message';
            message.style.position = 'fixed';
            message.style.top = '15%'; // Moved up further (was 20%)
            message.style.left = '50%';
            message.style.transform = 'translate(-50%, -50%)';
            message.style.color = '#ff1111'; // Brighter red
            // Use the same font as Game Over
            message.style.fontFamily = '"Creepster", "Chiller", cursive';
            message.style.fontSize = '72px'; // Made bigger (was 64px)
            message.style.fontWeight = 'bold';
            // Adjusted text shadow slightly for new color/size
            message.style.textShadow = '3px 3px 0px #000000, 6px 6px 6px rgba(0,0,0,0.8)'; 
            message.style.letterSpacing = '4px'; // Adjust spacing if needed
            message.style.textAlign = 'center';
            message.style.opacity = '0';
            // Removed direct transition, using animation class now
            message.style.pointerEvents = 'none';
            message.style.zIndex = '1000';
            message.textContent = 'HEADSHOT';
            document.body.appendChild(message);
            this.headshotMessage = message;

            // Add/Update CSS for animations (ensure this doesn't conflict if already added)
            const existingStyle = document.getElementById('headshot-animation-style');
            if (existingStyle) existingStyle.remove(); // Remove old style if it exists

            const styleSheet = document.createElement("style");
            styleSheet.id = 'headshot-animation-style'; // Give it an ID for easy removal/update
            styleSheet.type = "text/css";
            // Animation: Flash then immediate fade
            styleSheet.innerText = `
                @keyframes headshotFlashFade {
                  0% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
                  10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                  20% { opacity: 0.4; }
                  30% { opacity: 1; }
                  40% { opacity: 0.4; }
                  50% { opacity: 1; } /* Last flash */
                  /* 50% to 100% is fade out */
                  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); } /* Fade completely */
                }
                .headshot-animate {
                  animation: headshotFlashFade 1.3s ease-out forwards;
                }
            `;
            document.head.appendChild(styleSheet);
        }

        // Trigger the CSS animation
        this.headshotMessage.classList.remove('headshot-animate');
        void this.headshotMessage.offsetWidth; // Force reflow
        this.headshotMessage.classList.add('headshot-animate');
    }

    // Method to set game active state when play is clicked
    setGameActive(active) {
        this.gameActive = active;
        
        // Make sure pistol is visible when game becomes active
        if (active && this.pistolMesh) {
            console.log("Game active - ensuring pistol visibility");
            this.pistolMesh.visible = true;
        }
    }
    
    // Method to set game over state
    setGameOver(isOver) {
        this.isGameOver = isOver;
        
        // Disable bullet sounds when game is over
        if (isOver) {
            // Mute and stop the gunshot sound
            if (this.gunshotSound) {
                this.gunshotSound.volume = 0;
                this.gunshotSound.pause();
                this.gunshotSound.currentTime = 0;
            }
            
            // Mute and stop the reload sound
            if (this.reloadSound) {
                this.reloadSound.volume = 0;
                this.reloadSound.pause();
                this.reloadSound.currentTime = 0;
            }
            
            // Remove event listeners to prevent shooting
            this.removeEventListeners();
            
            // Clear any existing bullets
            this.bullets.forEach(bullet => {
                if (bullet.mesh) {
                    this.physicsWorld.scene.remove(bullet.mesh);
                }
                if (bullet.body) {
                    this.physicsWorld.removeBody(bullet.body);
                }
            });
            this.bullets = [];
            
            // Clear particles
            this.particles.forEach(particle => {
                if (particle.mesh) {
                    this.physicsWorld.scene.remove(particle.mesh);
                }
            });
            this.particles = [];
            
            // Clear smoke trails
            this.smokeTrails.forEach(smoke => {
                if (smoke.mesh) {
                    this.physicsWorld.scene.remove(smoke.mesh);
                }
            });
            this.smokeTrails = [];
        } else {
            // Restore original volume when game is not over
            if (this.gunshotSound) {
                this.gunshotSound.volume = 0.5;
            }
            
            if (this.reloadSound) {
                this.reloadSound.volume = 0.7;
            }
            
            // Re-add event listeners
            this.setupEventListeners();
        }
    }
    
    setupEventListeners() {
        // Remove any existing listeners first
        this.removeEventListeners();
        
        // Only add listeners if not game over
        if (!this.isGameOver) {
            // Listen for mouse clicks to shoot
            document.addEventListener('mousedown', this.shoot);
            
            // Add 'R' key for manual reload
            document.addEventListener('keydown', this.handleKeyDown);
        }
    }
    
    removeEventListeners() {
        document.removeEventListener('mousedown', this.shoot);
        document.removeEventListener('keydown', this.handleKeyDown);
    }
    
    handleKeyDown(event) {
        if (event.key === 'r' || event.key === 'R') {
            this.reload();
        } else if (event.key === 'm' || event.key === 'M') {
            // Toggle hitbox visibility when 'm' is pressed
            this.toggleHitboxVisibility();
        }
    }
    
    reload() {
        if (this.isReloading) return;
        
        this.isReloading = true;
        console.log("Reloading...");
        
        // Play reload sound
        this.reloadSound.currentTime = 0;
        
        // Speed up the reload sound if fast reload is active
        if (this.hasSuperFastReload) {
            this.reloadSound.playbackRate = 5.7; // Play sound 5.7x faster
        } else if (this.hasFastReload) {
            this.reloadSound.playbackRate = 2.8; // Play sound 2.8x faster
        } else {
            this.reloadSound.playbackRate = 1.0; // Normal playback rate
        }
        
        this.reloadSound.play();
        
        // Set reload time based on perk
        let reloadTime = this.normalReloadTime;
        if (this.hasSuperFastReload) {
            reloadTime = this.superFastReloadTime;
        } else if (this.hasFastReload) {
            reloadTime = this.fastReloadTime;
        }
        
        // Store the timeout ID so we can cancel it if needed
        this.reloadTimeout = setTimeout(() => {
            this.isReloading = false;
            this.bulletsFired = 0;
            console.log("Reload complete");
        }, reloadTime);
    }

    cancelReload() {
        if (this.isReloading) {
            // Clear the timeout
            if (this.reloadTimeout) {
                clearTimeout(this.reloadTimeout);
                this.reloadTimeout = null;
            }
            
            // Stop the reload sound
            if (this.reloadSound) {
                this.reloadSound.pause();
                this.reloadSound.currentTime = 0;
            }
            
            // Reset reload state
            this.isReloading = false;
            console.log("Reload cancelled");
        }
    }

    // Toggle weapon debugging elements
    toggleDebugElements(preserveBullets = false) {
        // Toggle debug overlay
        if (this.debugOverlay) {
            // If overlay exists, toggle visibility
            this.debugOverlay.style.display = this.debugOverlay.style.display === 'none' ? 'block' : 'none';
        } else {
            // Create overlay if it doesn't exist
            this.debugOverlay = document.createElement('div');
            this.debugOverlay.style.position = 'fixed';
            this.debugOverlay.style.bottom = '10px';
            this.debugOverlay.style.left = '10px';
            this.debugOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            this.debugOverlay.style.color = 'white';
            this.debugOverlay.style.padding = '10px';
            this.debugOverlay.style.borderRadius = '5px';
            this.debugOverlay.style.fontFamily = 'monospace';
            this.debugOverlay.style.zIndex = '1000';
            document.body.appendChild(this.debugOverlay);
            
            // Start updating the debug overlay
            this.startDebugOverlayUpdates();
        }
        
        // Always make sure bullets and particles stay visible
        // This is critical for gameplay regardless of debug mode
        this.bullets.forEach(bullet => {
            if (bullet.mesh) {
                bullet.mesh.userData.ignoresMeshToggle = true;
                bullet.mesh.visible = true;
            }
        });
        
        this.smokeTrails.forEach(smoke => {
            if (smoke.mesh) {
                smoke.mesh.userData.ignoresMeshToggle = true;
                smoke.mesh.visible = true;
            }
        });
        
        this.particles.forEach(particle => {
            if (particle.mesh) {
                particle.mesh.userData.ignoresMeshToggle = true;
                particle.mesh.visible = true;
            }
        });
        
        console.log(`Weapon debug elements ${this.debugOverlay.style.display === 'none' ? 'disabled' : 'enabled'}, bullets visibility preserved`);
    }
    
    // Start continuous updates for debug overlay
    startDebugOverlayUpdates() {
        if (!this.debugOverlay) return;
        
        const updateDebugInfo = () => {
            if (!this.debugOverlay || this.debugOverlay.style.display === 'none') return;
            
            this.debugOverlay.innerHTML = `
                <div>Camera Position: ${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)}</div>
                <div>Camera Rotation: ${this.camera.rotation.x.toFixed(2)}, ${this.camera.rotation.y.toFixed(2)}, ${this.camera.rotation.z.toFixed(2)}</div>
                <div>Pistol Position: ${this.pistolMesh.position.x.toFixed(2)}, ${this.pistolMesh.position.y.toFixed(2)}, ${this.pistolMesh.position.z.toFixed(2)}</div>
                <div>Recoil State: ${this.isRecoiling ? 'ACTIVE' : 'Inactive'}</div>
                <div>Recoil Time: ${this.isRecoiling ? (Date.now() - this.recoilStartTime).toFixed(0) + 'ms' : 'N/A'}</div>
                <div>Pistol Rotation: ${this.pistolMesh.rotation.x.toFixed(2)}, ${this.pistolMesh.rotation.y.toFixed(2)}, ${this.pistolMesh.rotation.z.toFixed(2)}</div>
                <div>Base Position: ${this.basePistolPosition ? `${this.basePistolPosition.x.toFixed(2)}, ${this.basePistolPosition.y.toFixed(2)}, ${this.basePistolPosition.z.toFixed(2)}` : 'Not set'}</div>
                <div>Original Position: ${this.originalPistolPosition ? `${this.originalPistolPosition.x.toFixed(2)}, ${this.originalPistolPosition.y.toFixed(2)}, ${this.originalPistolPosition.z.toFixed(2)}` : 'Not set'}</div>
            `;
            
            // Continue updating if overlay is visible
            if (this.debugOverlay && this.debugOverlay.style.display !== 'none') {
                requestAnimationFrame(updateDebugInfo);
            }
        };
        
        // Start the update loop
        requestAnimationFrame(updateDebugInfo);
    }

    // Method to enable/disable fast reload perk
    setFastReload(enabled, superFast = false) {
        this.hasFastReload = enabled;
        this.hasSuperFastReload = superFast;
        console.log(`Fast reload ${enabled ? (superFast ? 'super fast' : 'enabled') : 'disabled'}`);
        
        // Reset playback rate when toggling the perk
        if (!enabled) {
            this.reloadSound.playbackRate = 1.0;
        }
    }

    // Completely rewritten recoil effect
    applyRecoil() {
        if (!this.pistolMesh) return;
        
        // Use base position and rotation if available, otherwise use current values
        this.originalPistolPosition = this.basePistolPosition ? this.basePistolPosition.clone() : this.pistolMesh.position.clone();
        this.originalPistolRotation = this.basePistolRotation ? this.basePistolRotation.clone() : this.pistolMesh.quaternion.clone();
        
        // Set recoil state
        this.isRecoiling = true;
        this.recoilStartTime = Date.now();
        
        // Calculate recoil offset (slightly backward)
        const recoilOffset = new THREE.Vector3(0, 0, 0.3);
        recoilOffset.applyQuaternion(this.camera.quaternion);
        
        // Apply recoil offset immediately
        this.pistolMesh.position.add(recoilOffset);
        
        // Create a rotation for the recoil (20 degrees up - FIXED: negative value for upward rotation)
        const recoilRotation = new THREE.Euler(THREE.MathUtils.degToRad(-20), 0, 0);
        const recoilQuaternion = new THREE.Quaternion();
        recoilQuaternion.setFromEuler(recoilRotation);
        
        // Apply the rotation to the pistol
        this.pistolMesh.quaternion.multiply(recoilQuaternion);
        
        // Add a slight camera shake effect
        this.addCameraShake();
        
        // Animate the return to original position and rotation
        this.animateRecoilReturn();
    }

    // Animate the return to original position and rotation
    animateRecoilReturn() {
        if (!this.pistolMesh || !this.originalPistolPosition || !this.originalPistolRotation) return;
        
        const startTime = Date.now();
        const duration = this.recoilDuration;
        
        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Use easing function for smoother animation
            const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
            
            // Calculate the recoil position (original position + recoil offset)
            const recoilOffset = new THREE.Vector3(0, 0, 0.3);
            recoilOffset.applyQuaternion(this.camera.quaternion);
            const recoilPosition = this.originalPistolPosition.clone().add(recoilOffset);
            
            // Calculate the recoil rotation (original rotation + 20 degrees up - FIXED: negative value)
            const recoilRotation = new THREE.Euler(THREE.MathUtils.degToRad(-20), 0, 0);
            const recoilQuaternion = new THREE.Quaternion();
            recoilQuaternion.setFromEuler(recoilRotation);
            const recoilRotationQuat = this.originalPistolRotation.clone().multiply(recoilQuaternion);
            
            // Interpolate position
            this.pistolMesh.position.lerpVectors(
                recoilPosition,
                this.originalPistolPosition,
                easedProgress
            );
            
            // Interpolate rotation
            this.pistolMesh.quaternion.slerpQuaternions(
                recoilRotationQuat,
                this.originalPistolRotation,
                easedProgress
            );
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure we're exactly at the original position and rotation
                this.pistolMesh.position.copy(this.originalPistolPosition);
                this.pistolMesh.quaternion.copy(this.originalPistolRotation);
                this.isRecoiling = false;
            }
        };
        
        requestAnimationFrame(animate);
    }

    // Add a camera shake effect
    addCameraShake() {
        if (!this.camera) return;
        
        // Store original camera position
        const originalCameraPosition = this.camera.position.clone();
        
        // Calculate shake offset (reduced for more subtle effect)
        const shakeOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05
        );
        
        // Apply shake offset
        this.camera.position.add(shakeOffset);
        
        // Reset camera position after a short delay
        setTimeout(() => {
            if (this.camera) {
                this.camera.position.copy(originalCameraPosition);
            }
        }, 50); // 50ms shake duration
    }

    // Toggle recoil debug mode
    toggleRecoilDebug() {
        this.debugRecoil = !this.debugRecoil;
        console.log(`Recoil debug mode: ${this.debugRecoil ? 'ENABLED' : 'disabled'}`);
        
        // If enabled, create a test recoil effect
        if (this.debugRecoil) {
            this.applyRecoil();
        }
    }

    // Create a visual indicator for recoil - REMOVED to prevent ghost trails
    createRecoilIndicator() {
        // This method is intentionally empty to prevent ghost trails
        return;
    }

    // Test recoil effect directly
    testRecoil() {
        console.log("TESTING RECOIL EFFECT");
        this.applyRecoil();
    }

    // Add a new method to update the base position and rotation during recoil
    updateBasePositionAndRotation() {
        if (!this.pistolMesh || !this.camera) return;
        
        // Calculate pistol position in world space based on camera view
        const cameraPosition = this.camera.position.clone();
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(this.camera.quaternion);
        
        // Fixed offsets in camera space - adjusted for the new model
        const rightOffset = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(0.55);
        const downOffset = new THREE.Vector3(0, -1, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(0.5);
        const forwardOffset = cameraDirection.clone().multiplyScalar(0.8);
        
        // Apply all offsets to position pistol in bottom right corner
        const pistolPosition = cameraPosition.clone()
            .add(rightOffset)
            .add(downOffset)
            .add(forwardOffset);
        
        // Update the base position and rotation
        this.basePistolPosition = pistolPosition.clone();
        
        // Make pistol face the same direction as camera
        const baseQuaternion = this.camera.quaternion.clone();
        
        // Apply a slight rotation to align the gun properly
        const gunRotation = new THREE.Quaternion();
        gunRotation.setFromEuler(new THREE.Euler(0, Math.PI, 0));
        baseQuaternion.multiply(gunRotation);
        
        // Update the base rotation
        this.basePistolRotation = baseQuaternion.clone();
        
        // Update the original position and rotation for the recoil animation
        if (this.originalPistolPosition && this.originalPistolRotation) {
            this.originalPistolPosition = this.basePistolPosition.clone();
            this.originalPistolRotation = this.basePistolRotation.clone();
        }
    }

    // Add method to toggle hitbox visibility
    toggleHitboxVisibility() {
        if (!this.physicsWorld || !this.physicsWorld.scene) return;
        
        // Keep track of hitbox visibility state
        this.showHitboxes = !this.showHitboxes;
        console.log(`*** DEBUG: Hitbox visualization ${this.showHitboxes ? 'enabled' : 'disabled'}`);
        
        // Find all relevant objects in the scene that could have hitboxes
        const enemyTypes = ['Lokito', 'DNB'];
        let hitboxCount = 0;
        let totalEnemies = 0;
        let scaleInfo = [];
        
        // First approach: look for enemy models by name
        for (const enemyType of enemyTypes) {
            const enemyObject = this.physicsWorld.scene.getObjectByName(`${enemyType}_Model`);
            if (enemyObject) {
                const scale = `${enemyType}: ${enemyObject.scale.x.toFixed(1)}x`;
                scaleInfo.push(scale);
                console.log(`*** DEBUG: Found enemy by name: ${enemyType}_Model with scale ${enemyObject.scale.x.toFixed(2)}`);
                this.toggleHitboxesForObject(enemyObject);
                hitboxCount++;
            } else {
                console.log(`*** DEBUG: No enemy found by name: ${enemyType}_Model`);
            }
        }
        
        // Second approach: find all enemy meshes in the scene
        this.physicsWorld.scene.traverse((object) => {
            if (object.userData && (object.userData.isLokitoMesh || object.userData.isDNBMesh)) {
                totalEnemies++;
                const enemyType = object.userData.isLokitoMesh ? 'Lokito' : 'DNB';
                const scale = `${enemyType}: ${object.scale.x.toFixed(1)}x`;
                if (!scaleInfo.includes(scale)) {
                    scaleInfo.push(scale);
                }
                
                console.log(`*** DEBUG: Found enemy by traversal: ${enemyType} with scale ${object.scale.x.toFixed(2)}`);
                
                // For any enemy model, check for existing hitboxes
                let hasHitboxes = false;
                let hitboxList = [];
                
                object.traverse((child) => {
                    if (child.userData && child.userData.isHitbox) {
                        hasHitboxes = true;
                        hitboxList.push(`${child.userData.hitboxType} at (${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)}), scale=(${child.scale.x.toFixed(2)}, ${child.scale.y.toFixed(2)}, ${child.scale.z.toFixed(2)})`);
                        
                        // Toggle visual appearance of hitboxes, but keep them in the ray casting
                        if (this.showHitboxes) {
                            // Create visible colored material based on hitbox type
                            const color = this.getHitboxColor(child.userData.hitboxType);
                            
                            // If we need to restore the material, save the original first
                            if (!child.userData.originalMaterial) {
                                child.userData.originalMaterial = child.material;
                            }
                            
                            // Create new visible material
                            child.material = new THREE.MeshBasicMaterial({
                                color: color,
                                transparent: true,
                                opacity: 0.5,
                                wireframe: true
                            });
                            
                            child.visible = true;
                        } else {
                            // Restore original material
                            if (child.userData.originalMaterial) {
                                child.material = child.userData.originalMaterial;
                                delete child.userData.originalMaterial;
                            }
                            
                            // Make it invisible to user but still detectable by raycasting
                            // This is critical - we're hiding it visually but it's still there for hit detection
                            child.visible = true;
                            
                            // CRITICAL FIX: Just make material transparent instead of hiding the object
                            if (child.material) {
                                child.material.transparent = true;
                                child.material.opacity = 0;
                            }
                        }
                        
                        console.log(`*** DEBUG: Toggled hitbox visibility: ${child.userData.hitboxType}`);
                        hitboxCount++;
                    }
                });
                
                if (hasHitboxes) {
                    console.log(`*** DEBUG: Found ${hitboxList.length} hitboxes on ${enemyType}:`);
                    hitboxList.forEach(info => console.log(`  - ${info}`));
                }
                
                // If no hitboxes found, try to load them now for visualization
                if (!hasHitboxes && this.showHitboxes) {
                    let enemyType = 'unknown';
                    if (object.userData.isLokitoMesh) enemyType = 'Lokito';
                    if (object.userData.isDNBMesh) enemyType = 'DNB';
                    
                    console.log(`*** DEBUG: Loading hitboxes for ${enemyType} for visualization`);
                    this.loadHitboxConfig(enemyType)
                        .then(config => {
                            if (config) {
                                console.log(`*** DEBUG: Successfully loaded hitbox config for ${enemyType}:`, JSON.stringify(config));
                                
                                // If we're showing hitboxes, make them visible
                                const result = this.applyHitboxesToEnemyModel(object, config, enemyType, true);
                                if (result) hitboxCount += config.length;
                            } else {
                                console.warn(`*** DEBUG: No hitbox config found for ${enemyType}`);
                            }
                        })
                        .catch(error => {
                            console.error(`*** DEBUG: Error loading hitbox config: ${error}`);
                        });
                }
            }
        });
        
        // Show a status message with scale information
        const message = document.createElement('div');
        message.style.position = 'fixed';
        message.style.top = '20%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.color = 'white';
        message.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        message.style.padding = '10px';
        message.style.borderRadius = '5px';
        message.style.fontFamily = 'monospace';
        message.style.zIndex = '1000';
        message.textContent = 'Hitbox visualization ' + 
            (this.showHitboxes ? 'enabled' : 'disabled') +
            ` (Found ${totalEnemies} enemies, ${hitboxCount} hitboxes)`;
        
        // Add scale info
        if (scaleInfo.length > 0) {
            message.textContent += '\nModel Scales: ' + scaleInfo.join(', ');
        }
        
        document.body.appendChild(message);
        
        // Remove the message after 5 seconds (increased from 3)
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 5000);
    }
    
    // Helper to get color for hitbox type
    getHitboxColor(hitboxType) {
        switch (hitboxType) {
            case 'Head':
                return 0xff0000; // Red for head
            case 'Body':
                return 0x00ff00; // Green for body
            case 'Limb':
                return 0x0000ff; // Blue for limbs
            default:
                return 0xffff00; // Yellow for other/default
        }
    }
    
    // Enhanced hitbox visualization with edges
    createVisibleHitboxMaterial(hitboxType) {
        const color = this.getHitboxColor(hitboxType);
        
        // Create material for the hitbox
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            wireframe: false,
            depthTest: true,
            side: THREE.DoubleSide
        });
        
        return material;
    }
    
    // Helper to toggle hitboxes for a specific object
    toggleHitboxesForObject(object) {
        if (!object) return;
        
        let hasVisibleHitboxes = false;
        
        // Get the parent model's scale to apply it to hitbox visualization
        const parentScale = object.scale.clone();
        
        // Store info about parent scale
        console.log(`Parent model scale: x=${parentScale.x.toFixed(2)}, y=${parentScale.y.toFixed(2)}, z=${parentScale.z.toFixed(2)}`);
        
        object.traverse((child) => {
            if (child.userData && child.userData.hitboxType) {
                hasVisibleHitboxes = true;
                
                // This is a hitbox - toggle its visibility
                if (this.showHitboxes) {
                    // Create visible colored material based on hitbox type
                    const material = this.createVisibleHitboxMaterial(child.userData.hitboxType);
                    
                    // Save original material
                    if (!child.userData.originalMaterial) {
                        child.userData.originalMaterial = child.material;
                    }
                    
                    // Apply new material
                    child.material = material;
                    child.visible = true;
                    
                    // Log hitbox info for debugging
                    console.log(`Hitbox ${child.userData.hitboxType}: position=(${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)}), scale=(${child.scale.x.toFixed(2)}, ${child.scale.y.toFixed(2)}, ${child.scale.z.toFixed(2)})`);
                    
                    // Add a wireframe helper if needed
                    if (!child.userData.hasEdgeHelper) {
                        const edgeGeometry = new THREE.EdgesGeometry(child.geometry);
                        const edgeMaterial = new THREE.LineBasicMaterial({ 
                            color: 0x000000, 
                            linewidth: 2,
                            transparent: true,
                            opacity: 0.8
                        });
                        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
                        child.add(edges);
                        child.userData.edgeHelper = edges;
                        child.userData.hasEdgeHelper = true;
                    } else if (child.userData.edgeHelper) {
                        child.userData.edgeHelper.visible = true;
                    }
                    
                    // Add type label
                    if (!child.userData.typeLabel) {
                        const canvas = document.createElement('canvas');
                        canvas.width = 256;
                        canvas.height = 64;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.fillRect(0, 0, 256, 64);
                        ctx.font = 'bold 24px monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#ffffff';
                        
                        // Include more details in the label
                        const shape = child.userData.shape || 'box';
                        const pos = child.position;
                        
                        // Create a detailed label but keep it readable
                        ctx.fillText(`${child.userData.hitboxType} (${child.userData.damageMultiplier})`, 128, 32);
                        
                        const texture = new THREE.CanvasTexture(canvas);
                        const spriteMaterial = new THREE.SpriteMaterial({ 
                            map: texture,
                            transparent: true
                        });
                        const sprite = new THREE.Sprite(spriteMaterial);
                        sprite.position.set(0, 0.8, 0);
                        
                        // Scale the sprite inversely to the parent model's scale to keep it readable
                        const scaleMultiplier = Math.max(parentScale.x, parentScale.y, parentScale.z);
                        sprite.scale.set(1.5 * scaleMultiplier, 0.4 * scaleMultiplier, 1);
                        child.add(sprite);
                        child.userData.typeLabel = sprite;
                        
                        // Add a second label with position/scale details
                        const detailsCanvas = document.createElement('canvas');
                        detailsCanvas.width = 512;
                        detailsCanvas.height = 64;
                        const dtx = detailsCanvas.getContext('2d');
                        dtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        dtx.fillRect(0, 0, 512, 64);
                        dtx.font = 'bold 16px monospace';
                        dtx.textAlign = 'center';
                        dtx.textBaseline = 'middle';
                        dtx.fillStyle = '#ffffff';
                        dtx.fillText(`pos: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) - ${shape}`, 256, 32);
                        
                        const detailsTexture = new THREE.CanvasTexture(detailsCanvas);
                        const detailsMaterial = new THREE.SpriteMaterial({ 
                            map: detailsTexture,
                            transparent: true
                        });
                        const detailsSprite = new THREE.Sprite(detailsMaterial);
                        detailsSprite.position.set(0, 1.2, 0);
                        detailsSprite.scale.set(2.0 * scaleMultiplier, 0.4 * scaleMultiplier, 1);
                        child.add(detailsSprite);
                        child.userData.detailsLabel = detailsSprite;
                        
                    } else if (child.userData.typeLabel) {
                        child.userData.typeLabel.visible = true;
                        if (child.userData.detailsLabel) {
                            child.userData.detailsLabel.visible = true;
                        }
                    }
                } else {
                    // Restore original material
                    if (child.userData.originalMaterial) {
                        child.material = child.userData.originalMaterial;
                        // IMPORTANT: Make hitboxes invisible by setting opacity to 0
                        // instead of setting visible=false so raycasting still works
                        child.material.transparent = true;
                        child.material.opacity = 0;
                        child.material.visible = true;
                    }
                    
                    // Hide edge helper if it exists
                    if (child.userData.edgeHelper) {
                        child.userData.edgeHelper.visible = false;
                    }
                    
                    // Hide type label if it exists
                    if (child.userData.typeLabel) {
                        child.userData.typeLabel.visible = false;
                    }
                    
                    // Hide details label if it exists
                    if (child.userData.detailsLabel) {
                        child.userData.detailsLabel.visible = false;
                    }
                    
                    // CRITICAL CHANGE: Keep hitbox object visible for raycasting but make material transparent
                    // Instead of setting child.visible = false (which makes raycasts ignore it)
                    child.visible = true;
                }
                
                console.log(`Toggled visibility for ${child.userData.hitboxType} hitbox, multiplier: ${child.userData.damageMultiplier}`);
            }
        });
        
        if (!hasVisibleHitboxes && this.showHitboxes) {
            console.log(`No hitboxes found on object: ${object.name || 'unnamed'}`);
        }
    }

    // Method to create a bullet
    createBullet(position, direction) {
        const bulletGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.084, 16);
        const bulletMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFD700, // Gold color
            roughness: 0.1,  // Lower roughness for shinier appearance
            metalness: 1.0,  // Full metalness for metallic look
            emissive: 0xAA8500, // Subtle gold emissive color
            emissiveIntensity: 0.4 // Lower intensity for metallic look
        });
        const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Set bullet userData flags to ensure visibility
        bulletMesh.userData.isBullet = true;
        bulletMesh.userData.ignoresMeshToggle = true;
        bulletMesh.userData.type = 'bullet';
        
        return bulletMesh;
    }
    
    // Create smoke particle with proper flags
    createSmokeParticle(position) {
        const smokeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        const smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.5
        });
        const smokeMesh = new THREE.Mesh(smokeGeometry, smokeMaterial);
        smokeMesh.position.copy(position);
        
        // Add some random offset to make it look more natural
        smokeMesh.position.x += (Math.random() - 0.5) * 0.02;
        smokeMesh.position.y += (Math.random() - 0.5) * 0.02;
        smokeMesh.position.z += (Math.random() - 0.5) * 0.02;
        
        // Set smoke userData flags to ensure visibility
        smokeMesh.userData.ignoresMeshToggle = true;
        smokeMesh.userData.type = 'smoke';
        
        this.physicsWorld.scene.add(smokeMesh);
        
        return {
            mesh: smokeMesh,
            createdAt: Date.now(),
            lifetime: 1000, // Smoke particles last 1 second
            initialScale: 1.0
        };
    }

    // Add this function after displayHeadshotMessage method
    displayHeadshotStreakMessage() {
        // Create the headshot streak message element if it doesn't exist
        if (!this.headshotStreakMessage) {
            const message = document.createElement('div');
            message.id = 'headshot-streak-message';
            message.style.position = 'fixed';
            message.style.top = '25%'; // Position below the headshot message
            message.style.left = '50%';
            message.style.transform = 'translate(-50%, -50%)';
            message.style.color = '#ffcc00'; // Gold color
            message.style.fontFamily = '"Creepster", "Chiller", cursive';
            message.style.fontSize = '64px';
            message.style.fontWeight = 'bold';
            message.style.textShadow = '3px 3px 0px #000000, 6px 6px 6px rgba(0,0,0,0.8)';
            message.style.letterSpacing = '4px';
            message.style.textAlign = 'center';
            message.style.opacity = '0';
            message.style.pointerEvents = 'none';
            message.style.zIndex = '1000';
            message.textContent = '+500 HEADSHOT STREAK!';
            document.body.appendChild(message);
            this.headshotStreakMessage = message;

            // Add CSS for animations if not already added
            const existingStyle = document.getElementById('headshot-streak-animation-style');
            if (existingStyle) existingStyle.remove();

            const styleSheet = document.createElement("style");
            styleSheet.id = 'headshot-streak-animation-style';
            styleSheet.type = "text/css";
            styleSheet.innerText = `
                @keyframes streakFlashFade {
                  0% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
                  10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                  20% { opacity: 0.4; }
                  30% { opacity: 1; }
                  40% { opacity: 0.4; }
                  50% { opacity: 1; }
                  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
                }
                .streak-animate {
                  animation: streakFlashFade 1.8s ease-out forwards;
                }
            `;
            document.head.appendChild(styleSheet);
        }

        // Play the headshot streak sound
        if (this.headshotStreakSound) {
            this.headshotStreakSound.currentTime = 0;
            this.headshotStreakSound.play().catch(error => {
                console.log("Error playing headshot streak sound:", error);
            });
        }

        // Trigger the CSS animation
        this.headshotStreakMessage.classList.remove('streak-animate');
        void this.headshotStreakMessage.offsetWidth; // Force reflow
        this.headshotStreakMessage.classList.add('streak-animate');
    }
    
    // Reset headshot streak counter when player takes damage
    resetHeadshotStreak() {
        if (this.consecutiveHeadshots > 0) {
            console.log(`Headshot streak reset: ${this.consecutiveHeadshots} -> 0`);
            this.consecutiveHeadshots = 0;
        }
    }
} 