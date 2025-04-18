import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; // Use GLTFLoader
import { Enemy } from './Enemy.js'; // <-- Import base class
// import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
// import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

// Renamed class
export class DNB extends Enemy { 
    constructor(scene, physicsWorld) {
        super(scene, physicsWorld); // <-- Call base constructor
        this.target = null;
        this.mesh = null;
        this.body = null;
        this.collider = null;
        this.isInitialized = false;
        // RE-ADD Animation properties
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;

        // Stats & AI Parameters (Can be adjusted later for DNB specifically)
        this.health = 100;
        this.maxHealth = 100;
        this.damagePerHit = 10; 
        this.moveSpeed = 30;   // Increased from 25 to 30 for more speed
        this.turnSpeed = 1.0;   // Increased from 0.5 to 1.0 for faster turning
        this.proximityDamageInterval = 2000; 
        this.lastAttackTime = 0;
        this.maxSpeed = 7.0;    // Increased from 5.0 to 7.0
        this.detectionRange = 80.0; // Doubled from 40.0 to 80.0 for better detection
        this.meleeRange = 2.5;    // Increased slightly from 2.0
        this.attackRange = 3.0;   // Increased from 2.0
        this.attackCooldown = 1200; // Reduced from 1500 milliseconds
        this.isAlive = true;

        // Make DNB more aggressive by reducing random behaviors
        this.pauseChance = 0; // Disabled pausing behavior
        this.isPaused = false;
        this.pauseEndTime = 0;
        this.wanderChance = 0; // Disabled wandering behavior
        this.isWandering = false;
        this.wanderEndTime = 0;
        this.wanderDirection = new THREE.Vector3();

        // Floating parameters
        this.floatAmplitude = 0; 
        this.floatFrequency = 0; 
        this.floatTime = 0; 

        // Gas trail parameters
        this.gasParticles = [];
        this.gasSpawnInterval = 200; 
        this.lastGasParticleTime = 0;

        // Used for physics body lookup in cleanup
        this.dnbBodyUUID = null; // Renamed property
        this.playerController = null; 
        
        // Add stuck detection properties
        this.lastPosition = new THREE.Vector3();
        this.stuckTime = 0;
        this.stuckThreshold = 0.5; // Changed to 0.5 seconds as requested
        this.stuckDetectionDistance = 0.1; // If moved less than this in one update
        this.avoidanceDirection = new THREE.Vector3();
        this.isAvoiding = false;
        this.avoidanceEndTime = 0;
        this.navRandomFactor = 0.5; // Reduced randomness to focus more on reaching player (was 0.8)
        this.lastStateTime = Date.now(); // Initialize lastStateTime
        
        // Path memory for smarter navigation
        this.knownObstacles = []; // Store positions of known obstacles
        this.previousPaths = []; // Remember successful paths
        this.lastStuckPosition = new THREE.Vector3();
        this.pathMemoryLimit = 5; // Number of obstacles/paths to remember
        this.explorationDirections = []; // Potential directions to try when stuck
        this.currentExplorationIndex = 0; // Current direction being tried
        
        // Circling behavior properties
        this.isCircling = false;
        this.circleEndTime = 0;
        this.circleDirection = 1; // 1 for clockwise, -1 for counter-clockwise
        this.circleChance = 0.6; // 60% chance to circle when near player
        this.minCircleDistance = 3.5; // Minimum distance to maintain while circling
        this.maxCircleDistance = 6.0; // Maximum distance to maintain while circling
        this.lastBehaviorChange = 0;
        this.behaviorChangeInterval = 4000; // Change behavior every 4 seconds

        // Wall bounce properties
        this.lastWallHitTime = null;
        this.wallBounceRecoveryTime = 300; // 300ms recovery after a wall hit
        this.wallBounceCount = 0; // Track how many times bounced off walls

        // Audio properties for damage sounds
        this.damageSoundFiles = [
            'assets/sounds/MonsterGrunt_S011HO.285.wav',
            'assets/sounds/MonsterGrunt_S011HO.302.wav',
            'assets/sounds/MonsterGrunt_S011HO.304.wav'
        ];
        this.lastDamageSoundTime = 0;
        this.damageSoundCooldown = 500; // Minimum time between sounds (ms)
        this.damageSoundChance = 0.4; // 40% chance to play sound when hit

        // Add stair climbing variables as class properties
        this.isOnStairs = false;
        this.lastGroundY = 0;
        this.groundCheckDistance = 2.0;
        
        // A* pathfinding properties
        this.pathfindingNodes = []; // Nodes used in pathfinding
        this.currentPath = []; // Current calculated path
        this.pathUpdateInterval = 500; // ms between path updates
        this.lastPathUpdateTime = 0;
        this.pathfindingGridSize = 3.0; // Size of grid cells for pathfinding
        this.maxPathNodes = 15; // Maximum number of nodes in path to prevent excessive computation
        this.isPathfinding = false; // Whether we're currently using pathfinding
        this.pathNodeIndex = 0; // Current node in the path we're moving toward
    }

    async initialize(position, target, playerController) {
        this.target = target;
        this.playerController = playerController; 
        this.audioManager = playerController.audioManager; // Get audio manager reference
        
        // Setup 8 standard exploration directions for pathfinding
        // Add small vertical component to handle stairs and elevation changes
        this.explorationDirections = [
            new THREE.Vector3(1, 0.15, 0).normalize(),   // East with slight upward
            new THREE.Vector3(1, 0.15, 1).normalize(),  // Northeast with slight upward
            new THREE.Vector3(0, 0.15, 1).normalize(),   // North with slight upward
            new THREE.Vector3(-1, 0.15, 1).normalize(), // Northwest with slight upward
            new THREE.Vector3(-1, 0.15, 0).normalize(),  // West with slight upward
            new THREE.Vector3(-1, 0.15, -1).normalize(), // Southwest with slight upward
            new THREE.Vector3(0, 0.15, -1).normalize(),  // South with slight upward
            new THREE.Vector3(1, 0.15, -1).normalize(), // Southeast with slight upward
        ];

        // Setup flat exploration directions (no vertical component)
        this.explorationDirections = [
            new THREE.Vector3(1, 0, 0),   // East
            new THREE.Vector3(1, 0, 1).normalize(),  // Northeast
            new THREE.Vector3(0, 0, 1),   // North
            new THREE.Vector3(-1, 0, 1).normalize(), // Northwest
            new THREE.Vector3(-1, 0, 0),  // West
            new THREE.Vector3(-1, 0, -1).normalize(), // Southwest
            new THREE.Vector3(0, 0, -1),  // South
            new THREE.Vector3(1, 0, -1).normalize(), // Southeast
        ];

        // const mtlLoader = new MTLLoader(); // REMOVED
        const loader = new GLTFLoader(); // Use GLTFLoader
        console.log("DNB initialize started (GLB)..."); // Updated log

        try {
            // const modelPath = 'assets/3d models/zombie 5/DNB.glb'; // OLD PATH
            // const modelPath = 'assets/3d models/zombie 5/DNB2.glb'; // NEW PATH
            const modelPath = 'assets/3d models/zombie 5/DNB4.glb'; // UPDATED PATH
            console.log(`Attempting to load model: ${modelPath}`);
            
            // REMOVED MTL/OBJ Loading logic
            /*
            const materials = await mtlLoader.setPath(modelDir).loadAsync(mtlFile);
            ...
            const model = await objLoader.setPath(modelDir).loadAsync(objFile); 
            */
            const gltf = await loader.loadAsync(modelPath); // Load GLB
            console.log("GLB model loaded successfully for DNB.");
            this.mesh = gltf.scene; // Assign the scene group

            // RE-ENABLE Animation Setup 
            this.mixer = new THREE.AnimationMixer(this.mesh);
            console.log('[DNB] Available animations:', gltf.animations.map(clip => clip.name));
            let singleClip = gltf.animations.length > 0 ? gltf.animations[0] : null;
            const animationClips = {
                 idle: THREE.AnimationClip.findByName(gltf.animations, 'Idle') || THREE.AnimationClip.findByName(gltf.animations, 'idle') || singleClip, 
                 walk: THREE.AnimationClip.findByName(gltf.animations, 'Walk') || THREE.AnimationClip.findByName(gltf.animations, 'walk') || THREE.AnimationClip.findByName(gltf.animations, 'Run') || THREE.AnimationClip.findByName(gltf.animations, 'run') || singleClip, 
                 attack: THREE.AnimationClip.findByName(gltf.animations, 'Attack') || THREE.AnimationClip.findByName(gltf.animations, 'attack') || singleClip 
             };
             if (!animationClips.idle && singleClip) animationClips.idle = singleClip;
             if (!animationClips.walk && singleClip) animationClips.walk = singleClip;
             if (!animationClips.attack && singleClip) animationClips.attack = singleClip;

            Object.keys(animationClips).forEach(key => {
                const clip = animationClips[key];
                if (clip) {
                    this.animations[key] = this.mixer.clipAction(clip);
                    if (key === 'attack') {
                        this.animations[key].timeScale = 0.8; 
                    }
                } else {
                    console.warn(`[DNB] Animation clip not found for key: ${key}`);
                }
            });
            this.playAnimation('idle');
            console.log("[DNB] Animation setup complete.");

            // --- Model Setup ---
            const scale = 2.0; // Doubled scale
            this.mesh.scale.set(scale, scale, scale);

            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                         child.material.needsUpdate = true; 
                    }
                }
            });

            // --- Physics Setup ---
            console.log("DNB Physics setup starting...");
             // Adjust collider dimensions to match doubled scale
             const colliderHalfWidth = 0.6; // Doubled from 0.3
             const colliderHalfHeight = 1.8; // Doubled from 0.9
             const colliderHalfDepth = 0.6; // Doubled from 0.3
             const colliderOffsetY = colliderHalfHeight; // Offset should match new half height
             console.log(`DNB Using MANUAL collider half-extents: w=${colliderHalfWidth}, h=${colliderHalfHeight}, d=${colliderHalfDepth}, offsetY=${colliderOffsetY}`);

             // Define collision groups 
             const GROUP_ENEMY = 1 << 1; 
             const GROUP_ALL = -1; 
             const GROUP_NON_ENEMY = GROUP_ALL ^ GROUP_ENEMY; 

            // Set the initial MESH position (visual debugging aid if needed)
            this.mesh.position.copy(position);
            this.mesh.position.y += colliderOffsetY; // Initial guess for mesh position based on body

            // Set physics BODY position: Center is offset upwards from the target ground pos
            const rigidBodyDesc = this.physicsWorld.RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(position.x, position.y + colliderOffsetY, position.z) 
                .lockRotations(); 

            this.body = this.physicsWorld.world.createRigidBody(rigidBodyDesc);
            this.body.userData = { dnbInstance: this }; 
            this.dnbBodyUUID = `dnb_${this.body.handle}`; 
            this.mesh.userData = { isDNBMesh: true, dnbBodyUUID: this.dnbBodyUUID }; 

            // Set COLLIDER offset relative to the body's center
            const colliderDesc = this.physicsWorld.RAPIER.ColliderDesc.cuboid(colliderHalfWidth, colliderHalfHeight, colliderHalfDepth)
                 .setTranslation(0, colliderOffsetY, 0) 
                 .setCollisionGroups((GROUP_ENEMY << 16) | GROUP_NON_ENEMY) 
                 .setSolverGroups((GROUP_ENEMY << 16) | GROUP_NON_ENEMY)
                 .setFriction(0.7)
                 .setRestitution(0.3); 

            this.collider = this.physicsWorld.world.createCollider(colliderDesc, this.body);
            this.collider.userData = { type: 'dnb', instance: this }; 

            this.physicsWorld.bodies.set(this.dnbBodyUUID, this.body); 
            this.physicsWorld.colliders.set(this.dnbBodyUUID, this.collider); 
            console.log("DNB Physics setup complete.");

            this.scene.add(this.mesh);
            this.isInitialized = true;
            console.log("DNB fully initialized."); 

            // Try to load hitbox configuration
            const hitboxConfigPath = 'assets/hitboxes/dnb_hitboxes.json';
            fetch(hitboxConfigPath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Could not load hitbox config (${response.status})`);
                    }
                    return response.json();
                })
                .then(hitboxConfig => {
                    console.log(`Loaded hitbox config for DNB from ${hitboxConfigPath}`);
                    this.applyHitboxConfig(hitboxConfig);
                })
                .catch(error => {
                    console.warn(`Could not load DNB hitbox config: ${error.message}`);
                });

            return Promise.resolve();
        } catch (error) {
            console.error('ERROR during DNB initialize (GLB):', error); 
            return Promise.reject(error);
        }
    }

    applyHitboxConfig(hitboxConfig) {
        if (!this.mesh || !hitboxConfig) {
            return false;
        }
        
        // Check if hitboxConfig has a hitboxes array (newer format with metadata)
        const hitboxArray = Array.isArray(hitboxConfig.hitboxes) ? hitboxConfig.hitboxes : hitboxConfig;
        
        if (!Array.isArray(hitboxArray) || hitboxArray.length === 0) {
            console.warn("Invalid or empty hitbox configuration for DNB");
            return false;
        }
        
        console.log(`Applying ${hitboxArray.length} hitboxes to DNB model`);
        
        // Mark mesh as having hitboxes
        this.mesh.userData.hitboxesLoaded = true;
        this.mesh.name = 'DNB_Model';
        
        // Store model scale info for reference only (not used for adjustments)
        const modelScale = {
            x: this.mesh.scale.x,
            y: this.mesh.scale.y,
            z: this.mesh.scale.z
        };
        
        console.log(`DNB model scale: x=${modelScale.x}, y=${modelScale.y}, z=${modelScale.z}`);
        
        // Add hitboxes to the model
        hitboxArray.forEach(hitboxData => {
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
            
            // Create an invisible material for the hitbox
            const material = new THREE.MeshBasicMaterial({
                visible: false,
                transparent: true,
                opacity: 0,
                alphaTest: 0
            });
            
            // Create the hitbox mesh
            const hitbox = new THREE.Mesh(geometry, material);
            hitbox.visible = false;
            
            // Set position from saved data - use exactly as in editor
            const position = hitboxData.position || { x: 0, y: 0, z: 0 };
            hitbox.position.set(
                parseFloat(position.x) || 0,
                parseFloat(position.y) || 0,
                parseFloat(position.z) || 0
            );
            
            // Set scale from saved data - use exactly as in editor
            const scale = hitboxData.scale || { x: 1, y: 1, z: 1 };
            hitbox.scale.set(
                parseFloat(scale.x) || 1,
                parseFloat(scale.y) || 1,
                parseFloat(scale.z) || 1
            );
            
            console.log(`DNB Hitbox: position=(${hitbox.position.x.toFixed(2)}, ${hitbox.position.y.toFixed(2)}, ${hitbox.position.z.toFixed(2)}), scale=(${hitbox.scale.x.toFixed(2)}, ${hitbox.scale.y.toFixed(2)}, ${hitbox.scale.z.toFixed(2)})`);
            
            // Set hitbox metadata
            hitbox.userData = {
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
            
            // Add the hitbox to the model
            this.mesh.add(hitbox);
            
            console.log(`Added hitbox: ${hitbox.userData.hitboxType}, shape: ${shape}, multiplier: ${hitbox.userData.damageMultiplier}`);
        });
        
        return true;
    }

    // RE-ENABLE playAnimation method
    playAnimation(name, loop = true) {
        if (!this.mixer || !this.animations[name]) {
             return;
        }
        const newAction = this.animations[name];
        const oldAction = this.currentAction;
        if (oldAction === newAction && newAction.isRunning()) return; 
        this.currentAction = newAction;
        if (oldAction && oldAction !== newAction) {
            oldAction.fadeOut(0.3);
        }
        newAction.reset();
        newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        newAction.clampWhenFinished = !loop; 
        newAction.enabled = true;
        newAction.fadeIn(0.3);
        newAction.play();
    }

    takeDamage(damageInfo) {
        if (!this.isInitialized || this.health <= 0) return { isDead: false, wasHeadshot: false };
        
        // Use damageInfo directly
        const isHeadshot = damageInfo.isHeadshot;
        const damageAmount = damageInfo.damage;
        
        // Track if this was a headshot for death effects
        this.lastHitWasHeadshot = isHeadshot;
        
        this.health = Math.max(0, this.health - damageAmount);
        
        if (isHeadshot) {
            console.log(`DNB ${this.dnbBodyUUID} took ${damageAmount.toFixed(1)} HEADSHOT damage, health: ${this.health}`);
        } else {
            console.log(`DNB ${this.dnbBodyUUID} took ${damageAmount} damage, health: ${this.health}`);
        }
        
        // Play damage sound with random chance
        const now = Date.now();
        if (this.audioManager && 
            now - this.lastDamageSoundTime > this.damageSoundCooldown && 
            (isHeadshot || Math.random() < this.damageSoundChance)) {
            
            const randomIndex = Math.floor(Math.random() * this.damageSoundFiles.length);
            const soundFile = this.damageSoundFiles[randomIndex];
            
            this.audioManager.playOneShot(soundFile)
                .catch(error => console.error("Error playing DNB damage sound:", error));
            
            this.lastDamageSoundTime = now;
        }
        
        const isDead = this.health <= 0;
        if (isDead) {
            this.die();
            // Record kill for kill streak if player controller exists
            if (this.playerController) {
                this.playerController.recordKill();
            }
        }
        
        // Return object indicating death status and if the fatal hit was a headshot
        return { isDead: isDead, wasHeadshot: isDead ? this.lastHitWasHeadshot : false };
    }

    // Method to create a single gas particle
    createGasParticle(position) {
        const particleSize = Math.random() * 0.1 + 0.05;
        const gasMaterial = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.4, depthWrite: false });
        const particleGeometry = new THREE.SphereGeometry(particleSize, 4, 4);
        const particle = new THREE.Mesh(particleGeometry, gasMaterial);
        particle.position.copy(position);
        particle.position.y -= this.collider.translation().y; 
        particle.position.x += (Math.random() - 0.5) * 0.3;
        particle.position.z += (Math.random() - 0.5) * 0.3;
        this.scene.add(particle);
        const particleData = { mesh: particle, startTime: Date.now(), life: Math.random() * 1.5 + 0.8, velocity: new THREE.Vector3((Math.random() - 0.5) * 0.1, Math.random() * 0.1 + 0.05, (Math.random() - 0.5) * 0.1) };
        this.gasParticles.push(particleData);
        return particleData;
    }


    update(deltaTime) {
        if (!this.isInitialized || !this.isAlive) return;

        const now = Date.now();
        const elapsed = now - this.lastStateTime;
        const bodyPosition = this.body.translation();
        const currentPosition = new THREE.Vector3(bodyPosition.x, bodyPosition.y, bodyPosition.z);
        
        // Stuck detection logic - keep but make sure it can quickly resume pursuit after unstuck
        if (this.lastPosition.x !== 0 || this.lastPosition.y !== 0 || this.lastPosition.z !== 0) {
            const distanceMoved = currentPosition.distanceTo(this.lastPosition);
            
            // If the enemy is barely moving but trying to move (has velocity), it might be stuck
            const velocity = this.body.linvel();
            const hasVelocity = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z) > 0.5;
            
            if (distanceMoved < this.stuckDetectionDistance && hasVelocity) {
                this.stuckTime += deltaTime;
                
                // If stuck for more than the threshold time, take action
                if (this.stuckTime > this.stuckThreshold) {
                    console.log("DNB is stuck, turning to find a way out");
                    
                    // Start rotation - pick a random angle between 45 and 180 degrees
                    const turnAngle = (Math.random() * 135 + 45) * (Math.PI / 180);
                    const turnDirection = Math.random() > 0.5 ? 1 : -1; // Random direction
                    
                    // Create a rotation matrix and apply it to the current direction
                    const cosAngle = Math.cos(turnAngle * turnDirection);
                    const sinAngle = Math.sin(turnAngle * turnDirection);
                    
                    // Get current direction from velocity if available, otherwise use mesh orientation
                    let currentDir;
                    if (hasVelocity) {
                        currentDir = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
                    } else {
                        // Extract forward direction from mesh rotation
                        currentDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                    }
                    
                    // Apply rotation to get new direction
                    const newDirX = currentDir.x * cosAngle - currentDir.z * sinAngle;
                    const newDirZ = currentDir.x * sinAngle + currentDir.z * cosAngle;
                    
                    // Record this obstacle position to avoid in future pathfinding
                    this.recordObstacle(currentPosition.clone());
                    
                    // Reset stuck timer and record the new position
                    this.stuckTime = 0;
                    this.lastStuckPosition.copy(currentPosition);
                    
                    // Force the next moveDirection to use this new direction
                    this.avoidanceDirection.set(newDirX, 0, newDirZ).normalize();
                    this.isAvoiding = true;
                    this.avoidanceEndTime = now + 500; // Reduced from 1000ms to 500ms to get back to pursuing faster
                    
                    // Try pathfinding after getting stuck
                    if (this.target && this.target.mesh) {
                        this.isPathfinding = true;
                        this.lastPathUpdateTime = 0; // Force path update
                    }
                }
            } else {
                // If moving well, reset stuck timer
                this.stuckTime = 0;
            }
        }
        
        // Save current position for next frame's stuck detection
        this.lastPosition.copy(currentPosition);
        
        // Default animation and movement behavior
        let desiredAnimation = 'idle';
        let moveDirection = null;
        
        // Check if target is valid and log it
        if (!this.target || !this.target.mesh) {
            console.warn("DNB has no valid target to pursue!");
        } else {
            // Force refresh target if it exists but isn't being used properly
            if (!this.lastTargetUpdate || now - this.lastTargetUpdate > 5000) { // Check every 5 seconds
                console.log("DNB refreshing target lock on player");
                this.lastTargetUpdate = now;
            }
        }
        
        // If we're currently in avoidance mode, use the avoidance direction but still try to face the player
        if (this.isAvoiding && now < this.avoidanceEndTime && this.target) {
            moveDirection = this.avoidanceDirection;
            desiredAnimation = 'walk';
            
            // After half the avoidance time, start blending back toward player direction
            if (now > this.avoidanceEndTime - 250 && this.target.mesh) {
                const playerPosition = this.target.mesh.position.clone();
                const directionToPlayer = new THREE.Vector3()
                    .subVectors(playerPosition, currentPosition)
                    .normalize();
                
                // Blend increasingly toward player as avoidance time ends
                const blendFactor = (this.avoidanceEndTime - now) / 250; // 1.0 to 0.0
                moveDirection.lerp(directionToPlayer, 1 - blendFactor).normalize();
            }
        }
        // Otherwise normal behavior - always pursue player with high priority
        else if (this.target && this.target.mesh) {
            this.isAvoiding = false;
            
            // Get player position and calculate distance/direction
            const playerPosition = this.target.mesh.position.clone();
            const distance = currentPosition.distanceTo(playerPosition);
            const directionToPlayer = new THREE.Vector3()
                .subVectors(playerPosition, currentPosition)
                .normalize();
            
            // State and behavior logic
            // Attack - closest range
            if (distance <= this.meleeRange) {
                this.attack();
                desiredAnimation = 'attack';
                this.isCircling = false;
                this.isPathfinding = false; // Exit pathfinding when in attack range
                
                // Move toward player even when attacking
                moveDirection = directionToPlayer;
            }
            // Close range - mostly direct pursuit with some occasional circling
            else if (distance <= this.maxCircleDistance) {
                // Decide if we should start circling - reduced chance (was 0.01)
                if (!this.isCircling && Math.random() < 0.003) {
                    this.isCircling = true;
                    this.circleDirection = Math.random() < 0.5 ? 1.0 : -1.0; // Randomly choose direction
                    this.circleEndTime = now + 1500; // Only circle for short time
                }
                
                // If we're circling, calculate trajectory
                if (this.isCircling && now < this.circleEndTime) {
                    // Get vector perpendicular to direction to player
                    const perpVector = new THREE.Vector3().crossVectors(directionToPlayer, new THREE.Vector3(0, 1, 0)).normalize();
                    
                    // Less circular behavior - more aggressive approach to player
                    moveDirection = new THREE.Vector3()
                        .addScaledVector(perpVector, 0.4 * this.circleDirection) // Reduced circle factor (was 0.8)
                        .addScaledVector(directionToPlayer, 0.6) // Increased player approach factor
                        .normalize();
                    
                    desiredAnimation = 'walk';
                    this.isPathfinding = false; // Exit pathfinding when circling
                }
                // Normal chase - direct path to player or navigation around obstacles
                else {
                    this.isCircling = false;
                    
                    // Check if path is clear to player
                    if (this.isPathClear(currentPosition, playerPosition)) {
                        // Direct path is clear, go straight to player
                        moveDirection = directionToPlayer;
                        this.isPathfinding = false; // No need for pathfinding when path is clear
                    } else {
                        // Path is obstructed, try to navigate around obstacles
                        // Check if we should update the path (based on time or if no path exists)
                        if (now - this.lastPathUpdateTime > this.pathUpdateInterval || 
                            !this.isPathfinding || this.currentPath.length === 0) {
                            
                            // Calculate a new path to player
                            this.findPathToPlayer(currentPosition, playerPosition);
                            this.lastPathUpdateTime = now;
                            this.isPathfinding = true;
                        }
                        
                        // If we have a valid path, follow it
                        if (this.isPathfinding && this.currentPath.length > 0) {
                            // Get the current waypoint to move toward
                            const currentWaypoint = this.currentPath[this.pathNodeIndex];
                            const distToWaypoint = currentPosition.distanceTo(currentWaypoint);
                            
                            // If we're close enough to the current waypoint, move to the next one
                            if (distToWaypoint < 2.0) {
                                this.pathNodeIndex++;
                                
                                // If we've reached the end of the path, clear it and try direct approach
                                if (this.pathNodeIndex >= this.currentPath.length) {
                                    this.isPathfinding = false;
                                    moveDirection = directionToPlayer;
                                }
                            }
                            
                            // If still pathfinding, move toward the current waypoint
                            if (this.isPathfinding) {
                                const dirToWaypoint = new THREE.Vector3()
                                    .subVectors(currentWaypoint, currentPosition)
                                    .normalize();
                                    
                                // Blend with direction to player for more natural movement
                                moveDirection = new THREE.Vector3()
                                    .addScaledVector(dirToWaypoint, 0.7)
                                    .addScaledVector(directionToPlayer, 0.3)
                                    .normalize();
                            }
                        } else {
                            // Fallback to old behavior if pathfinding fails
                            const bestDirection = this.findBestPathDirection(currentPosition, playerPosition);
                            
                            // More tendency toward player even when navigating
                            moveDirection = new THREE.Vector3()
                                .addScaledVector(bestDirection, 0.5) 
                                .addScaledVector(directionToPlayer, 0.5)
                                .normalize();
                        }
                    }
                    
                    desiredAnimation = 'walk';
                }
            }
            // Far range behavior - pure chase with higher speed
            else {
                this.isCircling = false;
                this.isPathfinding = false; // No pathfinding at long range, just direct chase
                moveDirection = directionToPlayer;
                desiredAnimation = 'walk';
            }
        }

        // Process animations
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Apply movement with increased force when chasing player
        if (moveDirection && this.body) {
            // Check if we have a recent collision and need to wall slide
            const wallSlideResult = this.wallSlideIfNeeded(moveDirection);
            if (wallSlideResult.didSlide) {
                moveDirection = wallSlideResult.newDirection;
                // When pushed by wall collision, don't apply additional movement impulse immediately
                // This allows the bounce impulse to control the movement
                this.lastWallHitTime = now;
                this.wallBounceRecoveryTime = 300; // Recovery time in ms
            }
            
            // Apply impulse in the direction we want to move
            let multiplier = this.moveSpeed;
            
            // If recently hit a wall, reduce impulse to allow bounce physics to work
            if (this.lastWallHitTime && now - this.lastWallHitTime < this.wallBounceRecoveryTime) {
                // Gradually increase multiplier as recovery time passes
                const recoveryProgress = (now - this.lastWallHitTime) / this.wallBounceRecoveryTime;
                multiplier *= recoveryProgress * 0.5; // Reduce movement impulse during recovery
            }
            // If far from player, move faster to catch up
            else if (this.target && this.target.mesh) {
                const distance = currentPosition.distanceTo(this.target.mesh.position);
                if (distance > this.maxCircleDistance) {
                    multiplier *= 1.3; // 30% speed boost when far away
                }
            }
            
            // Only apply normal movement impulse if not in wall bounce recovery
            // or with reduced force during recovery
            if (!this.lastWallHitTime || now - this.lastWallHitTime > 50) {
                const impulse = new THREE.Vector3(
                    moveDirection.x * multiplier, 
                    0,
                    moveDirection.z * multiplier
                );
                
                this.body.applyImpulse(impulse);
            }

            // Simple stair climbing logic - apply upward force when player is above
            if (this.target && this.target.mesh) {
                // Check height difference between player and enemy
                const heightDifference = this.target.mesh.position.y - currentPosition.y;
                
                // Only apply upward force if:
                // 1. Player is above us (positive height difference)
                // 2. Height difference is reasonable for stairs (not too high)
                // 3. We're close enough horizontally (on the same staircase)
                if (heightDifference > 0.2 && heightDifference < 1.5) {
                    const horizontalDistance = new THREE.Vector2(
                        this.target.mesh.position.x - currentPosition.x,
                        this.target.mesh.position.z - currentPosition.z
                    ).length();
                    
                    // Only climb if we're close enough horizontally (likely on the same staircase)
                    if (horizontalDistance < 4.0) {
                        // Apply a small upward impulse - just enough to climb stairs
                        // The 0.2 factor keeps the jump height minimal
                        const upwardForce = Math.min(heightDifference * 0.2, 0.3) * multiplier;
                        
                        const stairImpulse = { 
                            x: 0, 
                            y: upwardForce, 
                            z: 0 
                        };
                        
                        this.body.applyImpulse(stairImpulse);
                    }
                }
            }
            
            // Limit max speed
            const velocity = this.body.linvel();
            const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
            
            if (currentSpeed > this.maxSpeed) {
                const scaleFactor = this.maxSpeed / currentSpeed;
                this.body.setLinvel({ x: velocity.x * scaleFactor, y: velocity.y, z: velocity.z * scaleFactor });
            }
                
            // Update mesh position and rotation from physics body
            const updatedPosition = this.body.translation();
            this.mesh.position.set(updatedPosition.x, updatedPosition.y, updatedPosition.z);
            
            // Make the DNB face the direction it's moving
            if (moveDirection && moveDirection.length() > 0.01) {
                // Calculate the target rotation based on movement direction
                const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
                
                // Apply the rotation to the mesh
                this.mesh.rotation.y = targetRotation;
            } else if (this.target) {
                // Even when not moving, face the player
                const dirToPlayer = new THREE.Vector3()
                    .subVectors(this.target.mesh.position, this.mesh.position)
                    .normalize();
                
                // Only use the horizontal direction for rotation
                const targetRotation = Math.atan2(dirToPlayer.x, dirToPlayer.z);
                this.mesh.rotation.y = targetRotation;
            }
        }

        // RE-ENABLE Animation playing logic
        if (this.currentAction !== this.animations[desiredAnimation]) {
             if (!(desiredAnimation === 'attack' && this.currentAction === this.animations.attack && this.currentAction.isRunning())) {
                  this.playAnimation(desiredAnimation);
             }
         }

        // --- Gas Trail Spawning ---
        if (now - this.lastGasParticleTime > this.gasSpawnInterval) {
            this.createGasParticle(this.body.translation()); 
            this.lastGasParticleTime = now;
        }

        // --- Gas Trail Update ---
        this.gasParticles = this.gasParticles.filter(p => {
            const elapsedTime = (now - p.startTime) / 1000;
            if (elapsedTime > p.life) {
                this.scene.remove(p.mesh);
                return false;
            }
            p.mesh.position.add(p.velocity.clone().multiplyScalar(deltaTime));
            p.mesh.material.opacity = (1.0 - (elapsedTime / p.life)) * 0.4;
            return true;
        });
    }

    cleanup() {
        console.log(`Cleanup called for DNB: ${this.dnbBodyUUID || 'UUID unknown'}`);
        if (!this.isInitialized) return;

        // Force stop any animations
        if (this.mixer) {
            this.mixer.stopAllAction();
        }

        // Remove mesh from scene and dispose resources
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse(object => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            if (material.normalMap) material.normalMap.dispose();
                            if (material.specularMap) material.specularMap.dispose();
                            if (material.envMap) material.envMap.dispose();
                            material.dispose();
                        });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        if (object.material.normalMap) object.material.normalMap.dispose();
                        if (object.material.specularMap) object.material.specularMap.dispose();
                        if (object.material.envMap) object.material.envMap.dispose();
                        object.material.dispose();
                    }
                }
            });
            this.mesh = null;
        }
        
        // Clean up gas particles
        this.gasParticles.forEach(p => {
            if (p.mesh) {
                if (p.mesh.material) {
                    p.mesh.material.dispose();
                }
                if (p.mesh.geometry) {
                    p.mesh.geometry.dispose();
                }
                if (this.scene.children.includes(p.mesh)) {
                    this.scene.remove(p.mesh);
                }
                p.mesh = null;
            }
        });
        this.gasParticles = []; 
        
        // Remove physics body and collider
        if (this.dnbBodyUUID) {
            this.physicsWorld.removeBodyByUUID(this.dnbBodyUUID);
        } else if (this.body) {
            console.warn("DNB cleanup: UUID missing, attempting direct body removal.");
            try {
                this.physicsWorld.world.removeRigidBody(this.body);
            } catch (e) {
                console.error("Error removing DNB rigidbody directly (no UUID):", e);
            }
        }
        
        // Remove collider directly if needed
        if (this.collider && this.physicsWorld && this.physicsWorld.world) {
            try {
                this.physicsWorld.world.removeCollider(this.collider);
            } catch (e) {
                console.error("Error removing DNB collider directly:", e);
            }
        }
        
        // Clean up animation mixer
        if (this.mixer) {
            this.mixer = null;
        }
        
        // Clear all animation references
        this.animations = {};
        this.currentAction = null;
        
        // Clear all other references
        this.target = null;
        this.body = null;
        this.collider = null;
        this.lastPosition = new THREE.Vector3();
        this.avoidanceDirection = new THREE.Vector3();
        
        // Mark as not initialized
        this.isInitialized = false;
        this.isAlive = false;
        
        console.log("DNB enemy completely destroyed and resources released");
    }

    attack() {
        const currentTime = Date.now();
        if (currentTime - this.lastAttackTime < this.attackCooldown) return;

        this.lastAttackTime = currentTime;
        this.playAnimation('attack', false);
        
        // Deal damage to player if in range, regardless of facing angle
        if (this.target && this.playerController) {
            const distanceToTarget = this.mesh.position.distanceTo(this.target.mesh.position);
            if (distanceToTarget <= this.meleeRange) {
                console.log(`DNB ${this.dnbBodyUUID} attacking player from any angle`);
                this.playerController.takeDamage(this.damagePerHit);
            }
        }
    }

    createDeathCubes() {
        if (!this.mesh || !this.scene) return;
        
        const position = this.mesh.position.clone();
        const cubes = [];
        const numCubes = 40; // Number of cubes in the explosion
        
        // Create a bunch of small black cubes
        for (let i = 0; i < numCubes; i++) {
            // Random cube size between 0.05 and 0.15
            const size = Math.random() * 0.1 + 0.05;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x000000, // Black cubes
                transparent: true,
                opacity: 0.8
            });
            
            const cube = new THREE.Mesh(geometry, material);
            
            // Position the cube at the DNB's position
            cube.position.copy(position);
            
            // Add random offset from center
            cube.position.x += (Math.random() - 0.5) * 2;
            cube.position.y += (Math.random() - 0.5) * 2 + 1; // Slightly higher on average
            cube.position.z += (Math.random() - 0.5) * 2;
            
            // Give the cube a random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 5 + 2, // Upward bias
                (Math.random() - 0.5) * 5
            );
            
            cube.userData = { 
                velocity: velocity,
                rotationSpeed: new THREE.Vector3(
                    Math.random() * 5,
                    Math.random() * 5,
                    Math.random() * 5
                ),
                startTime: Date.now(),
                lifeTime: Math.random() * 1000 + 500 // 0.5 to 1.5 seconds
            };
            
            // Add to scene
            this.scene.add(cube);
            cubes.push(cube);
        }
        
        // Setup the animation/cleanup function
        const updateCubes = () => {
            const now = Date.now();
            let allDone = true;
            
            for (let i = cubes.length - 1; i >= 0; i--) {
                const cube = cubes[i];
                const data = cube.userData;
                const elapsed = now - data.startTime;
                
                if (elapsed > data.lifeTime) {
                    // Remove cube
                    this.scene.remove(cube);
                    cube.geometry.dispose();
                    cube.material.dispose();
                    cubes.splice(i, 1);
                } else {
                    // Update position and rotation
                    const t = elapsed / data.lifeTime;
                    
                    // Apply velocity
                    cube.position.x += data.velocity.x * 0.016; // Assuming 60fps
                    cube.position.y += data.velocity.y * 0.016 - 9.8 * 0.016 * 0.016 * 2; // Add gravity
                    cube.position.z += data.velocity.z * 0.016;
                    
                    // Apply rotation
                    cube.rotation.x += data.rotationSpeed.x * 0.016;
                    cube.rotation.y += data.rotationSpeed.y * 0.016;
                    cube.rotation.z += data.rotationSpeed.z * 0.016;
                    
                    // Fade out
                    cube.material.opacity = 0.8 * (1 - t);
                    
                    allDone = false;
                }
            }
            
            if (!allDone) {
                requestAnimationFrame(updateCubes);
            }
        };
        
        // Start animation
        updateCubes();
    }

    die() {
        if (!this.isAlive) return;
        
        this.health = 0;
        this.isAlive = false;
        
        // Play death sound
        if (this.playerController && this.playerController.audioManager) {
            // If the last hit was a headshot, use the headshot sound and effect
            if (this.lastHitWasHeadshot && this.playerController.weaponSystem) {
                console.log("DNB died from headshot - triggering headshot effects");
                
                // Create red spooky text using weaponSystem's displayHeadshotMessage
                this.playerController.weaponSystem.displayHeadshotMessage();
                
                // Play headshot sound if available
                if (this.playerController.weaponSystem.headshotSound) {
                    this.playerController.weaponSystem.headshotSound.currentTime = 0;
                    this.playerController.weaponSystem.headshotSound.play().catch(error => {
                        console.log("Error playing headshot death sound:", error);
                    });
                }
            } else {
                // Play normal death sound
                const randomIndex = Math.floor(Math.random() * this.damageSoundFiles.length);
                this.playerController.audioManager.playOneShot(this.damageSoundFiles[randomIndex])
                    .catch(error => console.error("Error playing death sound:", error));
            }
        }
        
        // Create explosion of cubes at death position
        this.createDeathCubes();
        
        // Remove from physics world
        if (this.collider) {
            this.physicsWorld.world.removeCollider(this.collider, true);
        }
        if (this.body) {
            this.physicsWorld.world.removeRigidBody(this.body);
        }
        // Remove from scene
        this.scene.remove(this.mesh);
        // Remove references
        this.physicsWorld.bodies.delete(this.dnbBodyUUID);
        this.physicsWorld.colliders.delete(this.dnbBodyUUID);
    }

    // Calculate separation force to avoid other enemies
    calculateSeparationForce() {
        const separation = new THREE.Vector3();
        let neighborCount = 0;
        const minimumDistance = 2.5; // Minimum distance between enemies
        
        if (!this.scene) return separation;
        
        // Find all other enemies in the scene
        this.scene.traverse((object) => {
            // Check for DNB enemies
            if (object.userData && 
                ((object.userData.isDNBMesh && object.userData.dnbBodyUUID !== this.dnbBodyUUID) ||
                 (object.userData.isLokitoMesh))) { // Also avoid Lokito ghosts
                
                const otherPosition = object.position.clone();
                const myPosition = this.mesh.position.clone();
                
                // Use only X and Z for distance (horizontal plane)
                otherPosition.y = 0;
                myPosition.y = 0;
                
                const distance = myPosition.distanceTo(otherPosition);
                
                // If too close, add a repulsion vector
                if (distance < minimumDistance) {
                    const repulsionStrength = (minimumDistance - distance) / minimumDistance;
                    
                    // Direction from other enemy to this enemy
                    const awayDirection = new THREE.Vector3()
                        .subVectors(myPosition, otherPosition)
                        .normalize();
                    
                    // Add weighted repulsion vector
                    separation.addScaledVector(awayDirection, repulsionStrength);
                    neighborCount++;
                }
            }
        });
        
        // Average the repulsion vectors if we have neighbors
        if (neighborCount > 0) {
            separation.divideScalar(neighborCount);
        }
        
        return separation;
    }

    // Add position to known obstacles
    recordObstacle(position) {
        // First check if this obstacle is already known
        const obstacleExists = this.knownObstacles.some(obs => 
            position.distanceTo(obs) < 2.0 // Consider obstacles within 2 units to be the same
        );
        
        if (!obstacleExists) {
            this.knownObstacles.push(position.clone());
            
            // Limit the memory to prevent array from growing too large
            if (this.knownObstacles.length > this.pathMemoryLimit) {
                this.knownObstacles.shift(); // Remove oldest obstacle
            }
        }
    }
    
    // Find the best direction to move based on known obstacles and target position
    findBestPathDirection(currentPosition, targetPosition, enhancedRandomization = false) {
        // Create a score for each potential direction
        const directionScores = this.explorationDirections.map(dir => {
            // Start with a base score
            let score = 0;
            
            // Create a potential next position by moving in this direction
            const potentialPosition = currentPosition.clone().add(
                dir.clone().multiplyScalar(5.0) // Look 5 units ahead
            );
            
            // Calculate dot product with direction to player (higher is better - moving toward player)
            const dirToPlayer = new THREE.Vector3().subVectors(targetPosition, currentPosition).normalize();
            const alignment = dir.dot(dirToPlayer);
            
            // If we need enhanced randomization (to break out of being stuck), 
            // reduce the weight of alignment to player direction
            if (enhancedRandomization) {
                score += alignment * 0.8; // Less weight on alignment when stuck
                score += Math.random() * 1.5; // Much stronger randomization to escape
            } else {
                score += alignment * 2.0; // Weight alignment with player direction heavily
                score += Math.random() * 0.3; // Normal randomization
            }
            
            // Check distance to known obstacles (farther is better)
            for (const obstacle of this.knownObstacles) {
                const distToObstacle = potentialPosition.distanceTo(obstacle);
                if (distToObstacle < 3.0) {
                    // Stronger avoidance penalty when using enhanced randomization
                    const avoidanceMultiplier = enhancedRandomization ? 2.5 : 1.5;
                    score -= (3.0 - distToObstacle) * avoidanceMultiplier;
                }
            }
            
            // Bonus for directions that haven't been tried recently
            // This encourages exploration of new routes
            if (this.previousPaths.length > 0) {
                const lastDirection = this.previousPaths[this.previousPaths.length - 1];
                // When enhancedRandomization is true, strongly prefer directions different from previous paths
                if (enhancedRandomization) {
                    const angleDiff = Math.abs(dir.angleTo(lastDirection));
                    if (angleDiff > Math.PI * 0.5) {
                        score += 1.2; // Stronger bonus for trying very different directions
                    }
                } else if (Math.abs(dir.angleTo(lastDirection)) > Math.PI * 0.5) {
                    score += 0.5; // Regular bonus for trying a significantly different direction
                }
            }
            
            return { direction: dir, score: score };
        });
        
        // Sort by score (highest first)
        directionScores.sort((a, b) => b.score - a.score);
        
        // When using enhanced randomization, occasionally pick a completely random direction
        // to break out of potential movement loops
        if (enhancedRandomization && Math.random() < 0.3) {
            const randomIndex = Math.floor(Math.random() * this.explorationDirections.length);
            const randomDirection = this.explorationDirections[randomIndex].clone();
            this.previousPaths.push(randomDirection);
            
            // Limit the path memory
            if (this.previousPaths.length > this.pathMemoryLimit) {
                this.previousPaths.shift();
            }
            
            return randomDirection;
        }
        
        // Store this path for future reference
        const bestDirection = directionScores[0].direction.clone();
        this.previousPaths.push(bestDirection);
        
        // Limit the path memory
        if (this.previousPaths.length > this.pathMemoryLimit) {
            this.previousPaths.shift();
        }
        
        return bestDirection;
    }
    
    // Check if a path to the player is clear
    isPathClear(currentPosition, targetPosition) {
        // Sanity check - if positions are invalid, return false
        if (!currentPosition || !targetPosition || 
            typeof currentPosition.x === 'undefined' || 
            typeof targetPosition.x === 'undefined') {
            return false;
        }
        
        // Calculate direction and distance including vertical component for stairs
        const direction = new THREE.Vector3()
            .subVectors(targetPosition, currentPosition)
            .normalize();
        const distance = currentPosition.distanceTo(targetPosition);
        
        // Check height difference - if too steep, consider path not clear
        const heightDifference = Math.abs(targetPosition.y - currentPosition.y);
        // Allow for steep climbing if the height difference is gradual relative to distance
        const maxClimbAngle = 0.6; // Maximum slope angle (about 30 degrees)
        if (heightDifference / distance > maxClimbAngle && distance > 3.0) {
            // Path is too steep, record as obstacle
            this.recordObstacle(new THREE.Vector3(
                currentPosition.x + direction.x * 2.0,
                currentPosition.y,
                currentPosition.z + direction.z * 2.0
            ));
            return false;
        }
        
        // Check for known obstacles
        if (this.knownObstacles.length > 0) {
            for (const obstacle of this.knownObstacles) {
                // Calculate the projection of the obstacle onto our path line
                const v1 = new THREE.Vector3().subVectors(obstacle, currentPosition);
                const projectionLength = v1.dot(direction);
                
                // If the obstacle is behind us or beyond our target, ignore it
                if (projectionLength < 0 || projectionLength > distance) {
                    continue;
                }
                
                // Calculate the closest point on our path to the obstacle
                const projection = new THREE.Vector3()
                    .copy(currentPosition)
                    .addScaledVector(direction, projectionLength
                );
                
                // Check if obstacle is close to path
                const distanceToPath = projection.distanceTo(obstacle);
                if (distanceToPath < 2.5) { // Increased detection radius from 2.0 to 2.5
                    return false; // Path is not clear
                }
            }
        }
        
        // Cast rays in a narrow fan pattern to check for obstacles that might not be in our memory
        // This helps detect level geometry that's not explicitly stored
        const rayCount = 3; // Number of rays to cast
        const raySpread = 0.2; // How wide to spread the rays
        let pathBlocked = false;
        
        // Check if we have physics raycasting available
        if (this.physicsWorld && this.physicsWorld.RAPIER && this.physicsWorld.world) {
            try {
                // Cast the main ray directly toward the target
                const raycastFilter = this.physicsWorld.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
                
                for (let i = 0; i < rayCount; i++) {
                    // Create a slightly modified direction for the fan pattern
                    const spreadFactor = i - (rayCount - 1) / 2;
                    const spreadDirection = new THREE.Vector3().copy(direction);
                    
                    // Apply a small rotation to create the fan
                    if (spreadFactor !== 0) {
                        const perpendicular = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
                        spreadDirection.addScaledVector(perpendicular, spreadFactor * raySpread);
                        spreadDirection.normalize();
                    }
                    
                    const raycastResult = this.physicsWorld.world.castRay(
                        { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z },
                        { x: spreadDirection.x, y: spreadDirection.y, z: spreadDirection.z }, 
                        Math.min(distance, 10.0), // Don't cast too far
                        true, // Solid hit only
                        raycastFilter
                    );
                    
                    // If we hit something that isn't the player, the path is blocked
                    if (raycastResult && raycastResult.toi < Math.min(distance, 10.0)) {
                        // Get the collider we hit
                        const hitCollider = this.physicsWorld.world.getCollider(raycastResult.colliderHandle);
                        
                        // Check if hitCollider exists before accessing userData
                        if (!hitCollider) continue;
                        
                        const hitData = hitCollider.userData;
                        
                        // If it's not the player, consider it an obstacle
                        if (!hitData || !hitData.isPlayer) {
                            // Remember this location as an obstacle
                            const hitPoint = new THREE.Vector3(
                                currentPosition.x + spreadDirection.x * raycastResult.toi,
                                currentPosition.y + spreadDirection.y * raycastResult.toi,
                                currentPosition.z + spreadDirection.z * raycastResult.toi
                            );
                            this.recordObstacle(hitPoint);
                            pathBlocked = true;
                            break;
                        }
                    }
                }
            } catch (error) {
                // Fallback to basic path checking if raycasting fails
                console.error("Error during raycasting:", error);
                return false; // Assume path is not clear if there's an error
            }
        }
        
        if (pathBlocked) {
            return false;
        }
        
        return true; // Path is clear
    }

    // Add a new wall sliding method to detect collisions and slide along walls
    wallSlideIfNeeded(moveDirection) {
        // Default result - no slide
        const result = {
            didSlide: false,
            newDirection: moveDirection.clone()
        };
        
        if (!this.physicsWorld || !this.physicsWorld.RAPIER || !this.physicsWorld.world) {
            return result;
        }

        // If we've been stuck for too long, force a direction change
        if (this.stuckTime > 3.0) { // 3 seconds stuck threshold
            console.log("DNB stuck for too long, forcing direction change");
            
            // Force a 90-degree turn with no vertical component by default
            const forcedDirection = new THREE.Vector3(-moveDirection.z, 0, moveDirection.x);
            if (Math.random() > 0.5) {
                forcedDirection.multiplyScalar(-1);
            }
            
            // Only add vertical component if on stairs and trying to go up
            let yComponent = 0;
            const position = this.body.translation();
            const currentPosition = new THREE.Vector3(position.x, position.y, position.z);
            
            if (this._checkIfOnStairs() && this.target && this.target.mesh) {
                const heightDifference = this.target.mesh.position.y - currentPosition.y;
                if (heightDifference > 0.3 && heightDifference < 2.0) {
                    // Very small upward component, just enough to climb a step
                    yComponent = 0.1 * this.moveSpeed; 
                }
            }
            
            this.body.applyImpulse({
                x: forcedDirection.x * this.moveSpeed * 2.0,
                y: yComponent,
                z: forcedDirection.z * this.moveSpeed * 2.0
            }, true);
            
            result.didSlide = true;
            result.newDirection = forcedDirection;
            
            return result;
        }
        
        // Cast rays in multiple directions to detect nearby walls
        const position = this.body.translation();
        const rayOrigin = new THREE.Vector3(position.x, position.y + 0.5, position.z);
        const rayLength = 1.0; // Detection distance
        
        // Cast a ray in the movement direction to check for wall ahead
        const frontRay = new this.physicsWorld.RAPIER.Ray(
            { x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z },
            { x: moveDirection.x, y: 0, z: moveDirection.z }
        );
        
        const frontHit = this.physicsWorld.world.castRay(
            frontRay,
            rayLength,
            true,
            undefined,
            undefined,
            this.collider
        );
        
        // If no wall ahead, no need to push
        if (!frontHit) {
            return result;
        }
        
        // We hit something ahead - push away from the wall
        console.log("DNB hit wall, getting pushed away");
        
        // Calculate wall normal (direction away from wall)
        const wallNormal = new THREE.Vector3(-moveDirection.x, 0, -moveDirection.z).normalize();
        
        // Apply a bounce effect by reflecting the movement direction off the wall
        const reflectionVector = new THREE.Vector3();
        reflectionVector.copy(moveDirection);
        reflectionVector.reflect(wallNormal);
        
        // Add more randomization to the reflection to avoid getting stuck in corners
        const randomOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.8, // Increased from 0.3 to 0.8
            Math.random() * 0.15, // Small vertical randomization for stairs
            (Math.random() - 0.5) * 0.8
        );
        
        // Create the push direction by combining reflection and randomization
        const pushDirection = reflectionVector.add(randomOffset).normalize();
        
        // Apply a stronger impulse to push the DNB away from the wall
        const pushForce = 2.5; // Increased from 1.5 to 2.5
        
        // Check if we're on stairs and need to climb
        let verticalPush = 0;
        if (this._checkIfOnStairs() && this.target && this.target.mesh) {
            const currentPosition = new THREE.Vector3(position.x, position.y, position.z);
            const heightDifference = this.target.mesh.position.y - currentPosition.y;
            
            // Only add vertical component if player is above and we're on stairs
            if (heightDifference > 0.3 && heightDifference < 2.0) {
                verticalPush = Math.min(0.1 * this.moveSpeed, 0.3);
            }
        }
        
        // Apply immediate impulse to bounce off the wall with very limited vertical component
        this.body.applyImpulse({
            x: pushDirection.x * this.moveSpeed * pushForce,
            y: verticalPush,
            z: pushDirection.z * this.moveSpeed * pushForce
        }, true);
        
        // Record this obstacle position to avoid in future pathfinding
        this.recordObstacle(new THREE.Vector3(
            rayOrigin.x + moveDirection.x * frontHit.toi,
            rayOrigin.y,
            rayOrigin.z + moveDirection.z * frontHit.toi
        ));
        
        // Update the result with the push direction
        result.didSlide = true;
        result.newDirection = pushDirection;
        
        return result;
    }

    // Check if the enemy is on stairs
    _checkIfOnStairs() {
        try {
            if (!this.physicsWorld || !this.body) return false;
            
            const position = this.body.translation();
            if (!position || typeof position.x === 'undefined') return false;
            
            const rayOrigin = { x: position.x, y: position.y + 0.5, z: position.z };
            const rayDir = { x: 0, y: -1, z: 0 }; // Cast downward
            
            // Cast ray down to check ground
            let rayHit = null;
            try {
                rayHit = this.physicsWorld.world.castRay(
                    rayOrigin,
                    rayDir,
                    this.groundCheckDistance || 2.0,
                    true
                );
            } catch (error) {
                console.warn("Error in DNB stair detection raycast:", error);
                return false;
            }
            
            // Make sure we have a valid hit with the toi property
            if (rayHit && typeof rayHit.toi === 'number') {
                const hitY = position.y - rayHit.toi;
                
                // If ground Y has changed since last check, we might be on stairs
                if (Math.abs(hitY - this.lastGroundY) > 0.1) {
                    this.lastGroundY = hitY;
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.warn("Error in DNB _checkIfOnStairs:", error);
            return false;
        }
    }

    findPathToPlayer(startPosition, targetPosition) {
        // Clear the current path
        this.currentPath = [];
        this.pathNodeIndex = 0;
        
        // Simplified A* pathfinding for 3D game environment
        // This works on a 3D grid but focuses on horizontal (XZ) plane navigation
        
        // Define the grid area around the DNB and player
        const distanceToTarget = startPosition.distanceTo(targetPosition);
        
        // If target is very close, don't bother with complex pathfinding
        if (distanceToTarget < 5.0) {
            return false;
        }
        
        // Calculate bounds for exploration
        const midPoint = new THREE.Vector3().addVectors(startPosition, targetPosition).multiplyScalar(0.5);
        const radius = distanceToTarget * 0.7; // Explore area around the midpoint
        
        // Create a simple grid of nodes
        const nodes = [];
        const gridSize = this.pathfindingGridSize;
        const gridExtent = Math.min(Math.ceil(radius / gridSize), this.maxPathNodes);
        
        // Create exploration nodes in a grid pattern
        for (let x = -gridExtent; x <= gridExtent; x += 1) {
            for (let z = -gridExtent; z <= gridExtent; z += 1) {
                // Place nodes in a grid around the midpoint
                const nodePosition = new THREE.Vector3(
                    midPoint.x + x * gridSize,
                    // Y position will be determined by raycasting down
                    midPoint.y,
                    midPoint.z + z * gridSize
                );
                
                // Skip nodes that are too far from the midpoint
                if (nodePosition.distanceTo(midPoint) > radius * 1.5) {
                    continue;
                }
                
                // Find the correct Y position by raycasting down
                this.adjustNodeHeight(nodePosition);
                
                // Check if this node would be a valid position (not inside obstacles)
                if (this.isNodeValid(nodePosition, startPosition, targetPosition)) {
                    nodes.push({
                        position: nodePosition.clone(),
                        // G cost = distance from start
                        gCost: nodePosition.distanceTo(startPosition),
                        // H cost = distance to target
                        hCost: nodePosition.distanceTo(targetPosition),
                        // F cost = G + H
                        fCost: 0, // Will be calculated below
                        visited: false,
                        parent: null
                    });
                }
            }
        }
        
        // Add start and end nodes
        const startNode = {
            position: startPosition.clone(),
            gCost: 0,
            hCost: startPosition.distanceTo(targetPosition),
            fCost: 0,
            visited: false,
            parent: null
        };
        
        const endNode = {
            position: targetPosition.clone(),
            gCost: distanceToTarget,
            hCost: 0,
            fCost: 0,
            visited: false,
            parent: null
        };
        
        // Calculate F costs
        nodes.forEach(node => {
            node.fCost = node.gCost + node.hCost;
        });
        startNode.fCost = startNode.hCost;
        endNode.fCost = endNode.gCost;
        
        // Add start and end nodes to our list
        nodes.push(startNode);
        nodes.push(endNode);
        
        // A* algorithm
        const openSet = [startNode];
        const closedSet = [];
        
        // Loop until we find a path or run out of nodes to explore
        while (openSet.length > 0) {
            // Sort open set by F cost (lowest first)
            openSet.sort((a, b) => a.fCost - b.fCost);
            
            // Get the node with lowest F cost
            const currentNode = openSet.shift();
            currentNode.visited = true;
            closedSet.push(currentNode);
            
            // If we reached the end node, path found
            if (currentNode.position.distanceTo(endNode.position) < gridSize * 0.5) {
                // Reconstruct path by walking up parent chain
                let pathNode = currentNode;
                while (pathNode !== null && pathNode !== startNode) {
                    this.currentPath.unshift(pathNode.position.clone());
                    pathNode = pathNode.parent;
                }
                
                // We succeeded in finding a path
                console.log(`DNB found path to player with ${this.currentPath.length} nodes`);
                return true;
            }
            
            // Limit search time by checking only a reasonable number of neighbors
            const maxNeighbors = 5;
            
            // Check neighbors - find nearest nodes that aren't in the closed set
            const neighbors = nodes.filter(node => 
                !closedSet.includes(node) && 
                node.position.distanceTo(currentNode.position) < gridSize * 2.0
            );
            
            // Sort by distance so we check closest nodes first
            neighbors.sort((a, b) => 
                a.position.distanceTo(currentNode.position) - 
                b.position.distanceTo(currentNode.position)
            );
            
            // Only check the closest neighbors to save computation
            for (let i = 0; i < Math.min(neighbors.length, maxNeighbors); i++) {
                const neighbor = neighbors[i];
                
                // Skip if we already processed this neighbor
                if (closedSet.includes(neighbor)) {
                    continue;
                }
                
                // Check if path between current node and neighbor is clear
                if (!this.isPathClear(currentNode.position, neighbor.position)) {
                    // Path blocked, skip this neighbor
                    closedSet.push(neighbor);
                    continue;
                }
                
                // Calculate new G cost (distance from start through current node)
                const newGCost = currentNode.gCost + currentNode.position.distanceTo(neighbor.position);
                
                // If neighbor isn't in open set, or we found a better path
                if (!openSet.includes(neighbor) || newGCost < neighbor.gCost) {
                    neighbor.gCost = newGCost;
                    neighbor.fCost = neighbor.gCost + neighbor.hCost;
                    neighbor.parent = currentNode;
                    
                    // Add to open set if not already there
                    if (!openSet.includes(neighbor)) {
                        openSet.push(neighbor);
                    }
                }
            }
            
            // Limit pathfinding iterations to prevent excessive computation
            if (closedSet.length > this.maxPathNodes * 3) {
                console.log("DNB pathfinding aborted - too many iterations");
                break;
            }
        }
        
        // If we get here, path not found
        console.log("DNB failed to find path to player");
        return false;
    }
    
    // Adjust node height by raycasting down to find ground
    adjustNodeHeight(position) {
        if (!this.physicsWorld || !this.physicsWorld.RAPIER || !this.physicsWorld.world) {
            return;
        }
        
        try {
            // Cast ray down from a position slightly above the node
            const rayOrigin = { 
                x: position.x, 
                y: position.y + 10, // Start high above
                z: position.z 
            };
            const rayDir = { x: 0, y: -1, z: 0 }; // Straight down
            
            const rayHit = this.physicsWorld.world.castRay(
                rayOrigin,
                rayDir,
                20, // Cast up to 20 units down
                true // Solid hit only
            );
            
            // If we hit something, adjust the Y position
            if (rayHit && typeof rayHit.toi === 'number') {
                // Calculate the hit position
                position.y = rayOrigin.y - rayHit.toi + 1.0; // Add 1.0 to ensure node is above ground
            }
        } catch (error) {
            console.warn("Error adjusting node height:", error);
        }
    }
    
    // Check if a node is valid (not inside an obstacle)
    isNodeValid(position, startPosition, targetPosition) {
        // Skip validity check for start and end positions
        if (position.distanceTo(startPosition) < 1.0 || 
            position.distanceTo(targetPosition) < 1.0) {
            return true;
        }
        
        // Check if position is inside or too close to a known obstacle
        for (const obstacle of this.knownObstacles) {
            if (position.distanceTo(obstacle) < 2.0) {
                return false;
            }
        }
        
        // Raycast in all directions to check for nearby obstacles
        if (this.physicsWorld && this.physicsWorld.RAPIER && this.physicsWorld.world) {
            try {
                // Cast short rays in 4 horizontal directions
                const directions = [
                    { x: 1, y: 0, z: 0 },
                    { x: -1, y: 0, z: 0 },
                    { x: 0, y: 0, z: 1 },
                    { x: 0, y: 0, z: -1 }
                ];
                
                for (const dir of directions) {
                    const rayOrigin = { 
                        x: position.x, 
                        y: position.y, 
                        z: position.z 
                    };
                    
                    const rayHit = this.physicsWorld.world.castRay(
                        rayOrigin,
                        dir,
                        1.0, // 1 unit radius check
                        true
                    );
                    
                    // If any ray hits something close, position is not valid
                    if (rayHit && rayHit.toi < 1.0) {
                        return false;
                    }
                }
            } catch (error) {
                console.warn("Error checking node validity:", error);
            }
        }
        
        return true;
    }
} 