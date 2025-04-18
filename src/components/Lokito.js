import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Enemy } from './Enemy.js';

export class Lokito extends Enemy {
    constructor(scene, physicsWorld) {
        super(scene, physicsWorld);

        this.health = 150;
        this.maxHealth = 150;
        this.damagePerHit = 15;
        this.moveSpeed = 2.5;
        this.turnSpeed = 0.8;
        this.proximityDamageInterval = 1500;
        this.maxSpeed = 6.5;
        this.meleeRange = 3.0;
        this.attackRange = 3.0;
        this.attackCooldown = 1200;
        this.floatAmplitude = 0.1;
        this.floatFrequency = 1.5;
        this.floatTime = Math.random() * Math.PI * 2;
        this.gasParticles = [];
        this.gasSpawnInterval = 100;
        this.lastGasParticleTime = 0;
        this.pulseTime = 0;
        this.pulseSpeed = 2.0;
        
        this.attackSounds = [
            'assets/sounds/ESM_HCREA_cinematic_FX_voice_one_shot_creaethr_spectre_alerted_wispy_breath_reverb_01_Fm.wav',
            'assets/sounds/ESM_HCREA_cinematic_FX_voice_one_shot_creaethr_spectre_alerted_wispy_breath_reverb_03_Cm.wav'
        ];
        
        this.damageSounds = [
            'assets/sounds/ESM_HCREA_cinematic_FX_voice_one_shot_creaethr_banshee_attack_damage_screech_reverb_06.wav',
            'assets/sounds/ESM_Horror_Game_Vocal_Creature_Banshee_Short_Scream_Wet_1_Ghost.wav'
        ];
        
        this.isCircling = false;
        this.circleEndTime = 0;
        this.circleDirection = 1;
        this.circleChance = 0.5;
        this.minCircleDistance = 3.5;
        this.maxCircleDistance = 6.0;
        this.lastBehaviorChange = 0;
        this.behaviorChangeInterval = 2500;
    }

    _getEnemyType() { return 'Lokito'; }
    _getHitboxConfigPath() { return 'assets/hitboxes/lokito_hitboxes.json'; }
    _getDamageSounds() { return this.damageSounds; }

    async _loadModel() {
        const loader = new GLTFLoader();
        const modelPath = 'assets/3d models/zombie 2/132_necrozomb9.glb';
        console.log(`Attempting to load model: ${modelPath}`);
        const gltf = await loader.loadAsync(modelPath);
        console.log("GLB model loaded successfully for Lokito.");
        this.mesh = gltf.scene;

        if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.mesh);
            console.log('[Lokito] Available animations:', gltf.animations.map(clip => clip.name));
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
                    console.warn(`[Lokito] Animation clip not found for key: ${key}`);
                }
            });

            this.playAnimation('idle');
            console.log("[Lokito] Animation setup complete.");
        } else {
            console.log("[Lokito] No animations found in model. Animation system disabled.");
            this.mixer = null;
            this.animations = {};
        }

        const scale = 2.0;
        this.mesh.scale.set(scale, scale, scale);

        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            material.transparent = true;
                            material.opacity = 0.5;
                            if (material.isMeshStandardMaterial || material.isMeshPhongMaterial || material.isMeshBasicMaterial) {
                                material.emissive = new THREE.Color(0x88BBFF);
                                material.emissiveIntensity = 1.0;
                            }
                            material.needsUpdate = true;
                        });
                    } else {
                        child.material.transparent = true;
                        child.material.opacity = 0.5;
                        if (child.material.isMeshStandardMaterial || child.material.isMeshPhongMaterial || child.material.isMeshBasicMaterial) {
                            child.material.emissive = new THREE.Color(0x88BBFF);
                            child.material.emissiveIntensity = 1.0;
                        }
                        child.material.needsUpdate = true;
                    }
                }
            }
        });
    }

    _createPhysicsBody(position) {
        const colliderHalfWidth = 0.6;
        const colliderHalfHeight = 1.8;
        const colliderHalfDepth = 0.6;
        const colliderOffsetY = colliderHalfHeight;
        
        const GROUP_ENEMY = 1 << 1;
        const GROUP_PLAYER = 1 << 0; 
        const collidesWith = GROUP_PLAYER;

        this.mesh.position.copy(position);
        this.mesh.position.y += colliderOffsetY;

        const rigidBodyDesc = this.physicsWorld.RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y + colliderOffsetY, position.z)
            .lockRotations();

        this.body = this.physicsWorld.world.createRigidBody(rigidBodyDesc);
        this.body.userData = { lokitoInstance: this };
        this.enemyBodyUUID = `lokito_${this.body.handle}`;
        this.mesh.userData = { isLokitoMesh: true, lokitoBodyUUID: this.enemyBodyUUID };

        const colliderDesc = this.physicsWorld.RAPIER.ColliderDesc.cuboid(colliderHalfWidth, colliderHalfHeight, colliderHalfDepth)
            .setTranslation(0, colliderOffsetY, 0)
            .setSensor(true)
            .setCollisionGroups((GROUP_ENEMY << 16) | collidesWith)
            .setSolverGroups((GROUP_ENEMY << 16) | collidesWith)
            .setFriction(0)
            .setRestitution(0);

        this.collider = this.physicsWorld.world.createCollider(colliderDesc, this.body);
        this.collider.userData = { type: 'lokito', instance: this };

        this.physicsWorld.bodies.set(this.enemyBodyUUID, this.body);
        this.physicsWorld.colliders.set(this.enemyBodyUUID, this.collider);
        console.log("Lokito Physics setup complete.");
    }

    _updateAI(deltaTime) {
        const now = Date.now();

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        
        this.pulseTime += deltaTime * this.pulseSpeed;
        const pulseIntensity = 0.5 + 0.5 * Math.sin(this.pulseTime);
        
        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            if (material.emissive) {
                                material.emissiveIntensity = pulseIntensity;
                            }
                            material.opacity = 0.3 + 0.2 * pulseIntensity;
                        });
                    } else if (child.material.emissive) {
                        child.material.emissiveIntensity = pulseIntensity;
                        child.material.opacity = 0.3 + 0.2 * pulseIntensity;
                    }
                }
            });
        }

        const playerPosition = this.target.mesh.position;
        const lokitoBodyPosition = this.body.translation();
        
        const currentPosition = new THREE.Vector3(lokitoBodyPosition.x, lokitoBodyPosition.y, lokitoBodyPosition.z);
        
        const distance = currentPosition.distanceTo(playerPosition);
        let desiredAnimation = 'idle';
        
        const groundLevelY = -1.5;
        
        let floatHeight = 0;
        
        const approachRange = 8;
        const hoverHeight = 2.0;
        
        if (distance > approachRange) {
            floatHeight = hoverHeight;
        } else {
            const attackHeight = 0.5;
            const t = 1 - (distance / approachRange);
            floatHeight = hoverHeight * (1-t) + attackHeight * t;
        }
        
        this.floatTime += deltaTime * this.floatFrequency;
        const floatOffset = Math.sin(this.floatTime) * this.floatAmplitude;

        if (distance <= this.meleeRange) {
            desiredAnimation = 'idle';
            
            const attackHeight = groundLevelY + 1.7 + 0.5;
            
            this.body.setNextKinematicTranslation({
                x: currentPosition.x,
                y: attackHeight,
                z: currentPosition.z
            });
            
            this.mesh.position.set(currentPosition.x, attackHeight + floatOffset, currentPosition.z);
            
            if (now - this.lastAttackTime >= this.proximityDamageInterval) {
                console.log(`[Ghost Lokito ${this.enemyBodyUUID}] Attacking player from any angle.`);
                this.attack();
                desiredAnimation = 'attack';
            } else {
                if (this.currentAction === this.animations.attack && this.currentAction.isRunning()) {
                    desiredAnimation = 'attack';
                }
            }
        } else {
            desiredAnimation = 'walk';
            
            const lookAtTarget = new THREE.Vector3(playerPosition.x, this.mesh.position.y, playerPosition.z);
            this.mesh.lookAt(lookAtTarget);
            
            const directionToPlayer = new THREE.Vector3(
                playerPosition.x - currentPosition.x,
                0,
                playerPosition.z - currentPosition.z
            ).normalize();
            
            if (now - this.lastBehaviorChange > this.behaviorChangeInterval) {
                if (distance < this.maxCircleDistance && distance > this.meleeRange && Math.random() < this.circleChance) {
                    this.isCircling = true;
                    this.circleDirection = Math.random() < 0.5 ? 1 : -1;
                    this.circleEndTime = now + 2000 + Math.random() * 1000;
                } else {
                    this.isCircling = false;
                }
                this.lastBehaviorChange = now;
            }
            
            let moveDirection;
            
            if (this.isAvoiding && now < this.avoidanceEndTime) {
                moveDirection = new THREE.Vector3()
                    .addVectors(
                        this.avoidanceDirection.clone().multiplyScalar(0.5),
                        directionToPlayer.clone().multiplyScalar(0.5)
                    )
                    .normalize();
            } 
            else if (this.stuckTime > this.stuckThreshold) {
                console.log(`Ghost Lokito ${this.enemyBodyUUID} got stuck for more than ${this.stuckThreshold}s, finding a new path`);
                
                this.avoidanceDirection.set(
                    directionToPlayer.z * 0.6 + (Math.random() - 0.5) * this.navRandomFactor,
                    0.8 + Math.random() * 0.4,
                    -directionToPlayer.x * 0.6 + (Math.random() - 0.5) * this.navRandomFactor
                ).normalize();
                
                this.isAvoiding = true;
                this.avoidanceEndTime = now + 1000 + Math.random() * 500;
                this.stuckTime = 0;
                
                moveDirection = this.avoidanceDirection;
            }
            else if (this.isCircling && now < this.circleEndTime && distance < this.maxCircleDistance && distance > this.meleeRange) {
                const perpVector = new THREE.Vector3().crossVectors(directionToPlayer, new THREE.Vector3(0, 1, 0)).normalize();
                
                const idealDistance = (this.minCircleDistance + this.maxCircleDistance) / 2;
                const distanceFactor = Math.min(1, Math.max(-1, (distance - idealDistance) / 2));
                
                moveDirection = new THREE.Vector3()
                    .addScaledVector(perpVector, 0.6 * this.circleDirection)
                    .addScaledVector(directionToPlayer, 0.4 + distanceFactor);
                
                moveDirection.normalize();
            } else {
                this.isCircling = false;
                moveDirection = directionToPlayer;
            }
            
            const separationForce = this.calculateSeparationForce();
            if (separationForce.length() > 0.01) {
                moveDirection.addScaledVector(separationForce.normalize(), 0.5);
                moveDirection.normalize();
            }
            
            let moveSpeed = this.moveSpeed * 2.0;
            
            let nextX = currentPosition.x + moveDirection.x * moveSpeed * deltaTime;
            let nextZ = currentPosition.z + moveDirection.z * moveSpeed * deltaTime;
            
            let nextY = groundLevelY + floatHeight;
            if (this.isAvoiding) {
                nextY += moveDirection.y * moveSpeed * deltaTime * 3;
            }
            
            this.body.setNextKinematicTranslation({
                x: nextX,
                y: nextY,
                z: nextZ
            });
            
            this.mesh.position.set(nextX, nextY + floatOffset, nextZ);
        }

        if (this.currentAction !== this.animations[desiredAnimation]) {
            if (!(desiredAnimation === 'attack' && this.currentAction === this.animations.attack && this.currentAction.isRunning())) {
                this.playAnimation(desiredAnimation);
            }
        }

        if (now - this.lastGasParticleTime > this.gasSpawnInterval) {
            this.createGasParticle(currentPosition);
            this.lastGasParticleTime = now;
        }

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

    attack() {
        const currentTime = Date.now();
        if (currentTime - this.lastAttackTime < this.attackCooldown) return;
        
        if (this.playerController && this.playerController.isSliding) {
            console.log("Player is sliding - Lokito attack missed!");
            this.lastAttackTime = currentTime;
            
            this.playAnimation('attack', false);
            
            if (this.playerController.audioManager && this.attackSounds.length > 0) {
                const randomIndex = Math.floor(Math.random() * this.attackSounds.length);
                this.playerController.audioManager.playOneShot(this.attackSounds[randomIndex])
                    .catch(error => console.error("Error playing ghost attack sound:", error));
            }
            return;
        }

        this.lastAttackTime = currentTime;
        
        this.playAnimation('attack', false);
        
        if (this.playerController && this.playerController.audioManager && this.attackSounds.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.attackSounds.length);
            const soundFile = this.attackSounds[randomIndex];
            console.log(`Playing ghost attack sound: ${soundFile}`);
            this.playerController.audioManager.playOneShot(soundFile)
                .catch(error => console.error("Error playing ghost attack sound:", error));
        } else {
            console.error("Cannot play ghost attack sound: Missing audioManager or sound files");
            if (!this.playerController) console.error("  - playerController is missing");
            else if (!this.playerController.audioManager) console.error("  - audioManager is missing");
            else if (!this.attackSounds || this.attackSounds.length === 0) console.error("  - No attack sounds available");
        }
        
        if (this.target && this.playerController) {
            console.log(`Lokito ${this.enemyBodyUUID} attacking player`);
            this.playerController.takeDamage(this.damagePerHit);
        }
    }

    _createDeathEffect() {
        this.createDeathCubes();
    }

    createGasParticle(position) {
        const particleSize = Math.random() * 0.15 + 0.08;
        const ghostColor = new THREE.Color(0x88BBFF);
        const gasMaterial = new THREE.MeshBasicMaterial({ color: ghostColor, transparent: true, opacity: 0.6, depthWrite: false });
        const particleGeometry = new THREE.SphereGeometry(particleSize, 4, 4);
        const particle = new THREE.Mesh(particleGeometry, gasMaterial);
        particle.position.copy(position);
        
        particle.position.x += (Math.random() - 0.5) * 0.4;
        particle.position.z += (Math.random() - 0.5) * 0.4;
        particle.position.y += Math.random() * 0.5;
        
        this.scene.add(particle);
        
        const particleData = { 
            mesh: particle, 
            startTime: Date.now(), 
            life: Math.random() * 1.8 + 1.0,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.1, 
                Math.random() * 0.15 + 0.1,
                (Math.random() - 0.5) * 0.1
            ) 
        };
        
        this.gasParticles.push(particleData);
    }

    createDeathCubes() {
        if (!this.mesh || !this.scene) return;
        
        const position = this.mesh.position.clone();
        const cubes = [];
        const numCubes = 40;
        
        for (let i = 0; i < numCubes; i++) {
            const size = Math.random() * 0.1 + 0.05;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x88BBFF,
                transparent: true,
                opacity: 0.5
            });
            
            const cube = new THREE.Mesh(geometry, material);
            
            cube.position.copy(position);
            
            cube.position.x += (Math.random() - 0.5) * 2;
            cube.position.y += (Math.random() - 0.5) * 2 + 1;
            cube.position.z += (Math.random() - 0.5) * 2;
            
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                Math.random() * 3 + 1,
                (Math.random() - 0.5) * 3
            );
            
            cube.userData = { 
                velocity: velocity,
                rotationSpeed: new THREE.Vector3(
                    Math.random() * 3,
                    Math.random() * 3,
                    Math.random() * 3
                ),
                startTime: Date.now(),
                lifeTime: Math.random() * 2000 + 1000
            };
            
            this.scene.add(cube);
            cubes.push(cube);
        }
        
        const updateCubes = () => {
            const now = Date.now();
            let allDone = true;
            
            for (let i = cubes.length - 1; i >= 0; i--) {
                const cube = cubes[i];
                const data = cube.userData;
                const elapsed = now - data.startTime;
                
                if (elapsed > data.lifeTime) {
                    this.scene.remove(cube);
                    cube.geometry.dispose();
                    cube.material.dispose();
                    cubes.splice(i, 1);
                } else {
                    const t = elapsed / data.lifeTime;
                    
                    cube.position.x += data.velocity.x * 0.016;
                    cube.position.y += data.velocity.y * 0.016 - 9.8 * 0.016 * 0.016 * 0.8;
                    cube.position.z += data.velocity.z * 0.016;
                    
                    cube.rotation.x += data.rotationSpeed.x * 0.016;
                    cube.rotation.y += data.rotationSpeed.y * 0.016;
                    cube.rotation.z += data.rotationSpeed.z * 0.016;
                    
                    cube.material.opacity = 0.5 * (1 - t);
                    
                    allDone = false;
                }
            }
            
            if (!allDone) {
                requestAnimationFrame(updateCubes);
            }
        };
        
        updateCubes();
    }

    calculateSeparationForce() {
        const separation = new THREE.Vector3();
        let neighborCount = 0;
        const minimumDistance = 3.0;
        
        if (!this.scene || !this.mesh) return separation;
        
        this.scene.traverse((object) => {
            if (object.userData && object.userData.isLokitoMesh && object !== this.mesh) {
                const otherPosition = object.position.clone();
                const myPosition = this.mesh.position.clone();
                otherPosition.y = 0;
                myPosition.y = 0;
                const distance = myPosition.distanceTo(otherPosition);
                
                if (distance > 0 && distance < minimumDistance) {
                    const repulsionStrength = (minimumDistance - distance) / minimumDistance;
                    const awayDirection = new THREE.Vector3().subVectors(myPosition, otherPosition).normalize();
                    separation.addScaledVector(awayDirection, repulsionStrength);
                    neighborCount++;
                }
            }
        });
        
        if (neighborCount > 0) separation.divideScalar(neighborCount);
        
        return separation;
    }

    cleanup() {
        console.log(`Cleanup called for Lokito: ${this.enemyBodyUUID || 'UUID unknown'}`);
        if (!this.isInitialized) return;

        if (this.mixer) {
            this.mixer.stopAllAction();
        }

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
        
        if (this.enemyBodyUUID) {
            this.physicsWorld.removeBodyByUUID(this.enemyBodyUUID);
        } else if (this.body) {
            console.warn("Lokito cleanup: UUID missing, attempting direct body removal.");
            try {
                this.physicsWorld.world.removeRigidBody(this.body);
            } catch (e) {
                console.error("Error removing Lokito rigidbody directly (no UUID):", e);
            }
        }
        
        if (this.collider && this.physicsWorld && this.physicsWorld.world) {
            try {
                this.physicsWorld.world.removeCollider(this.collider);
            } catch (e) {
                console.error("Error removing Lokito collider directly:", e);
            }
        }
        
        if (this.mixer) {
            this.mixer = null;
        }
        
        this.animations = {};
        this.currentAction = null;
        
        this.target = null;
        this.body = null;
        this.collider = null;
        
        this.isInitialized = false;
        this.isAlive = false;
        
        console.log("Lokito ghost completely destroyed and resources released");
    }
} 