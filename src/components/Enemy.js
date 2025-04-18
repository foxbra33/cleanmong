import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Enemy {
    constructor(scene, physicsWorld) {
        if (new.target === Enemy) {
            throw new TypeError("Cannot construct Enemy instances directly");
        }
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.target = null;
        this.mesh = null;
        this.body = null;
        this.collider = null;
        this.isInitialized = false;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.health = 100; // Default health, subclasses should override
        this.maxHealth = 100;
        this.isAlive = true;
        this.lastHitWasHeadshot = false; // Track last hit type for death logic
        this.playerController = null;
        this.audioManager = null;
        this.enemyBodyUUID = null; // Base UUID property

        // Common AI/Movement properties (defaults, can be overridden)
        this.moveSpeed = 2.0;
        this.turnSpeed = 0.5;
        this.detectionRange = 40.0;
        this.attackRange = 2.5;
        this.attackCooldown = 1500;
        this.lastAttackTime = 0;
        this.damagePerHit = 10;
        
        // Stuck detection properties
        this.lastPosition = new THREE.Vector3();
        this.stuckTime = 0;
        this.stuckThreshold = 0.5;
        this.stuckDetectionDistance = 0.1;
        this.isAvoiding = false;
        this.avoidanceEndTime = 0;
        this.avoidanceDirection = new THREE.Vector3();
        
        // Pathfinding properties (optional, used by DNB)
        this.navRandomFactor = 0.5;
        this.knownObstacles = [];
        this.previousPaths = [];
        this.lastStuckPosition = new THREE.Vector3();
        this.pathMemoryLimit = 5;
        this.explorationDirections = [
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 1).normalize(),
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 1).normalize(),
            new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-1, 0, -1).normalize(),
            new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, -1).normalize(),
        ];
    }

    // --- Abstract Methods (must be implemented by subclasses) ---
    async _loadModel() {
        throw new Error("Method '_loadModel()' must be implemented.");
    }

    _createPhysicsBody(position) {
        throw new Error("Method '_createPhysicsBody()' must be implemented.");
    }
    
    _updateAI(deltaTime) {
        throw new Error("Method '_updateAI()' must be implemented.");
    }
    
    attack() {
        throw new Error("Method 'attack()' must be implemented.");
    }
    
    _createDeathEffect() {
        // Optional: Subclasses can implement specific death visuals
        console.log("Default _createDeathEffect called");
    }
    
    _getHitboxConfigPath() {
        throw new Error("Method '_getHitboxConfigPath()' must be implemented.");
    }
    
    _getEnemyType() {
        throw new Error("Method '_getEnemyType()' must be implemented.");
    }
    
    _getDamageSounds() {
        return []; // Default: no damage sounds
    }

    // --- Common Methods ---
    async initialize(position, target, playerController) {
        this.target = target;
        this.playerController = playerController;
        this.audioManager = playerController?.audioManager;
        
        console.log(`${this._getEnemyType()} initialize started...`);

        try {
            // Load model first
            await this._loadModel(); 
            if (!this.mesh) throw new Error("Model loading failed in subclass.");
            
            // Setup physics body using subclass implementation
            this._createPhysicsBody(position);
            if (!this.body || !this.collider) throw new Error("Physics body creation failed in subclass.");
            
            // Common setup
            this.scene.add(this.mesh);
            this.isInitialized = true;
            console.log(`${this._getEnemyType()} fully initialized.`);

            // Load and apply hitbox config
            await this._loadAndApplyHitboxes();

        } catch (error) {
            console.error(`ERROR during ${this._getEnemyType()} initialize:`, error);
            this.cleanup(); // Ensure cleanup if init fails
            throw error; // Re-throw error to be caught by spawner
        }
    }
    
    async _loadAndApplyHitboxes() {
        const hitboxConfigPath = this._getHitboxConfigPath();
        try {
            const response = await fetch(hitboxConfigPath);
            if (!response.ok) {
                throw new Error(`Could not load hitbox config (${response.status})`);
            }
            const hitboxConfig = await response.json();
            console.log(`Loaded hitbox config for ${this._getEnemyType()} from ${hitboxConfigPath}`);
            this.applyHitboxConfig(hitboxConfig);
        } catch (error) {
            console.warn(`Could not load ${this._getEnemyType()} hitbox config: ${error.message}. Enemy may not register hits correctly.`);
        }
    }

    applyHitboxConfig(hitboxConfig) {
        if (!this.mesh || !hitboxConfig) {
            console.warn(`Cannot apply hitboxes for ${this._getEnemyType()}: Mesh or config missing.`);
            return false;
        }
        
        const hitboxArray = Array.isArray(hitboxConfig.hitboxes) ? hitboxConfig.hitboxes : hitboxConfig;
        
        if (!Array.isArray(hitboxArray) || hitboxArray.length === 0) {
            console.warn(`Invalid or empty hitbox configuration for ${this._getEnemyType()}`);
            return false;
        }
        
        console.log(`Applying ${hitboxArray.length} hitboxes to ${this._getEnemyType()} model`);
        
        this.mesh.userData.hitboxesLoaded = true;
        this.mesh.name = `${this._getEnemyType()}_Model`;
        
        console.log(`${this._getEnemyType()} model scale: x=${this.mesh.scale.x.toFixed(2)}, y=${this.mesh.scale.y.toFixed(2)}, z=${this.mesh.scale.z.toFixed(2)}`);
        
        // Remove any previously added hitboxes before adding new ones
        const existingHitboxes = [];
        this.mesh.traverse((child) => {
            if (child.userData && child.userData.isHitbox) {
                existingHitboxes.push(child);
            }
        });
        existingHitboxes.forEach(box => this.mesh.remove(box));
        console.log(`Removed ${existingHitboxes.length} existing hitboxes before applying new config.`);

        hitboxArray.forEach(hitboxData => {
            let geometry;
            const shape = hitboxData.shape || 'box';
            switch (shape) {
                case 'sphere': geometry = new THREE.SphereGeometry(0.5, 16, 16); break;
                case 'cylinder': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16); break;
                default: geometry = new THREE.BoxGeometry(1, 1, 1); break;
            }
            
            const material = new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0, alphaTest: 0 });
            const hitbox = new THREE.Mesh(geometry, material);
            hitbox.visible = false;
            
            const position = hitboxData.position || { x: 0, y: 0, z: 0 };
            hitbox.position.set(parseFloat(position.x) || 0, parseFloat(position.y) || 0, parseFloat(position.z) || 0);
            
            const scale = hitboxData.scale || { x: 1, y: 1, z: 1 };
            hitbox.scale.set(parseFloat(scale.x) || 1, parseFloat(scale.y) || 1, parseFloat(scale.z) || 1);
            
            console.log(`${this._getEnemyType()} Hitbox: type=${hitboxData.type || 'Default'}, pos=(${hitbox.position.x.toFixed(2)}, ${hitbox.position.y.toFixed(2)}, ${hitbox.position.z.toFixed(2)}), scale=(${hitbox.scale.x.toFixed(2)}, ${hitbox.scale.y.toFixed(2)}, ${hitbox.scale.z.toFixed(2)})`);
            
            hitbox.userData = {
                isHitbox: true,
                hitboxType: hitboxData.type || 'Default',
                damageMultiplier: hitboxData.damageMultiplier || '1x',
                shape: shape,
                originalPosition: { x: parseFloat(position.x) || 0, y: parseFloat(position.y) || 0, z: parseFloat(position.z) || 0 },
                originalScale: { x: parseFloat(scale.x) || 1, y: parseFloat(scale.y) || 1, z: parseFloat(scale.z) || 1 }
            };
            
            this.mesh.add(hitbox);
        });
        
        return true;
    }

    playAnimation(name, loop = true) {
        if (!this.mixer || !this.animations || !this.animations[name]) {
            // console.warn(`[${this._getEnemyType()}] Animation '${name}' not found or mixer not initialized.`);
            return;
        }
        
        const newAction = this.animations[name];
        const oldAction = this.currentAction;
        if (oldAction === newAction && newAction.isRunning()) return;
        
        if (oldAction && oldAction !== newAction) {
            oldAction.fadeOut(0.3);
        }
        
        newAction.reset();
        newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        newAction.clampWhenFinished = !loop;
        newAction.enabled = true;
        newAction.fadeIn(0.3);
        newAction.play();
        this.currentAction = newAction;
    }

    takeDamage(damageInfo) {
        if (!this.isInitialized || !this.isAlive) return { isDead: false, wasHeadshot: false };
        
        const isHeadshot = damageInfo.isHeadshot;
        const damageAmount = damageInfo.damage;
        this.lastHitWasHeadshot = isHeadshot;
        
        this.health = Math.max(0, this.health - damageAmount);
        
        // Play damage sound (subclass provides sounds)
        const damageSounds = this._getDamageSounds();
        if (this.audioManager && damageSounds.length > 0 && Math.random() < 0.3) { // Common 30% chance
            const randomIndex = Math.floor(Math.random() * damageSounds.length);
            this.audioManager.playOneShot(damageSounds[randomIndex])
                .catch(error => console.error(`Error playing ${this._getEnemyType()} damage sound:`, error));
        }
        
        if (isHeadshot) {
            console.log(`${this._getEnemyType()} ${this.enemyBodyUUID} took ${damageAmount.toFixed(1)} HEADSHOT damage, health: ${this.health}`);
        } else {
            console.log(`${this._getEnemyType()} ${this.enemyBodyUUID} took ${damageAmount} damage, health: ${this.health}`);
        }
        
        const isDead = this.health <= 0;
        if (isDead) {
            this.die();
            if (this.playerController) {
                this.playerController.recordKill();
            }
        }
        
        return { isDead: isDead, wasHeadshot: isDead ? this.lastHitWasHeadshot : false }; 
    }

    update(deltaTime) {
        if (!this.isInitialized || !this.isAlive || !this.target) return;

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        
        // Basic stuck detection (can be used by subclasses)
        this._updateStuckDetection(deltaTime);
        
        // Call subclass-specific AI update
        this._updateAI(deltaTime);
    }
    
    _updateStuckDetection(deltaTime) {
        if (!this.body) return;
        
        const bodyPosition = this.body.translation();
        const currentPosition = new THREE.Vector3(bodyPosition.x, bodyPosition.y, bodyPosition.z);
        
        if (this.lastPosition.x !== 0 || this.lastPosition.y !== 0 || this.lastPosition.z !== 0) {
            const distanceMoved = currentPosition.distanceTo(this.lastPosition);
            const velocity = this.body.linvel();
            const hasVelocity = velocity ? Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z) > 0.5 : false;

            if (distanceMoved < this.stuckDetectionDistance && hasVelocity) {
                this.stuckTime += deltaTime;
            } else {
                this.stuckTime = 0;
            }
        } else {
            this.stuckTime = 0; // Initialize stuck time if lastPosition wasn't set
        }
        this.lastPosition.copy(currentPosition);
    }

    cleanup() {
        console.log(`Cleanup called for ${this._getEnemyType()}: ${this.enemyBodyUUID || 'UUID unknown'}`);
        if (!this.isInitialized) return;

        if (this.mixer) {
            this.mixer.stopAllAction();
        }

        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => this._disposeMaterial(material));
                    } else {
                        this._disposeMaterial(object.material);
                    }
                }
            });
            this.mesh = null;
        }
        
        // Remove physics body and collider using UUID if possible
        if (this.enemyBodyUUID && this.physicsWorld) {
            this.physicsWorld.removeBodyByUUID(this.enemyBodyUUID);
        } else if (this.body && this.physicsWorld && this.physicsWorld.world) {
            console.warn(`${this._getEnemyType()} cleanup: UUID missing, attempting direct body/collider removal.`);
             try { if (this.collider) this.physicsWorld.world.removeCollider(this.collider, false); } // false: don't wake parent body
             catch (e) { console.error(`Error removing ${this._getEnemyType()} collider directly:`, e); }
             try { this.physicsWorld.world.removeRigidBody(this.body); } 
             catch (e) { console.error(`Error removing ${this._getEnemyType()} rigidbody directly:`, e); }
        }
        
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.target = null;
        this.body = null;
        this.collider = null;
        this.isInitialized = false;
        this.isAlive = false;
        
        console.log(`${this._getEnemyType()} completely destroyed and resources released`);
    }
    
    _disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.bumpMap) material.bumpMap.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.specularMap) material.specularMap.dispose();
        if (material.envMap) material.envMap.dispose();
        material.dispose();
    }

    die() {
        if (!this.isAlive) return;
        console.log(`${this._getEnemyType()} ${this.enemyBodyUUID} is dying.`);
        
        this.health = 0;
        this.isAlive = false;
        
        // Play death sound (consider specific sounds in subclass)
        this._playDeathSound();
        
        // Create death effect (subclass implements specifics)
        this._createDeathEffect();
        
        // Schedule cleanup after a short delay to allow effects to play
        // IMPORTANT: In the main game loop (Engine.js), the check for health <= 0 
        // should now call cleanup directly after checking, rather than relying on this timeout.
        // This timeout is more for visual effect completion before the object *might* be removed.
        // setTimeout(() => this.cleanup(), 1000); // Delay might cause issues if game loop cleans up sooner
    }
    
    _playDeathSound() {
        // Use headshot sound if last hit was headshot --> THIS LOGIC MOVED TO WEAPONSYSTEM.JS
        // if (this.lastHitWasHeadshot && this.playerController?.weaponSystem?.headshotSound) {
        //      console.log(`${this._getEnemyType()} died from headshot - triggering headshot effects`);
        //      this.playerController.weaponSystem.displayHeadshotMessage(); // Show message
        //      this.playerController.weaponSystem.headshotSound.currentTime = 0;
        //      this.playerController.weaponSystem.headshotSound.play().catch(error => {
        //          console.log(\"Error playing headshot death sound:\", error);
        //      });
        // } else { 
            // Play normal death sound (using damage sounds as fallback)
            // Note: Subclasses should ideally define specific death sounds
            const damageSounds = this._getDamageSounds();
            if (this.audioManager && damageSounds.length > 0) {
                const randomIndex = Math.floor(Math.random() * damageSounds.length);
                this.audioManager.playOneShot(damageSounds[randomIndex])
                    .catch(error => console.error(`Error playing ${this._getEnemyType()} death sound:`, error));
            } else {
                console.log(`${this._getEnemyType()} has no death sounds configured.`);
            }
        // }
    }
} 