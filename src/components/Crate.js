import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Crate {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        
        this.mesh = null;
        this.model = null;
        this.body = null;
        this.collider = null;
        this.isInitialized = false;
        this.uuid = null;
        
        // Drop animation properties
        this.dropHeight = 20; // Start height above ground
        this.targetY = -1.5; // Final Y position (ground level)
        this.isDropping = false;
        this.dropStartTime = 0;
        
        // Crate properties
        this.size = 1.0; // Size of the crate
        this.isOpen = false;
        this.canInteract = true;
        this.modelLoaded = false;
        this.pendingPosition = null;
        
        // Interaction properties
        this.interactionDistance = 2.5; // How close to interact
        this.promptVisible = false;
        this.promptElement = null;
        this.messageElement = null;
        
        // Sound effects
        this.openSound = new Audio('/assets/sounds/ESM_Battle_Game_Open_Foley_Chest_Enemy_Loot_Box_2_Wood_Crate_One_Shot.wav');
        this.emptySound = new Audio('/assets/sounds/LNG_Dammit_Whisper.wav');
        this.openSound.volume = 0.7;
        this.emptySound.volume = 0.7;
        
        // Load the model
        this.loadModel();
    }
    
    loadModel() {
        const loader = new GLTFLoader();
        loader.load(
            // Resource URL
            '/assets/3d models/level objects/OldWoodCrate_ver01.glb',
            
            // onLoad callback
            (gltf) => {
                this.model = gltf.scene;
                
                // Apply shadows to the model
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // Scale model to appropriate size
                this.model.scale.set(1.0, 1.0, 1.0);
                
                this.modelLoaded = true;
                
                // If we have a pending position, initialize now
                if (this.pendingPosition) {
                    this.completeInitialization(this.pendingPosition);
                    this.pendingPosition = null;
                }
                
                console.log("Crate model loaded");
            },
            
            // onProgress callback
            (xhr) => {
                console.log(`Crate model: ${(xhr.loaded / xhr.total) * 100}% loaded`);
            },
            
            // onError callback
            (error) => {
                console.error('Error loading crate model:', error);
                // Fall back to box geometry
                this.fallbackToBoxGeometry();
            }
        );
    }
    
    fallbackToBoxGeometry() {
        console.warn('Using fallback box geometry for crate');
        // Create a simple box as fallback
        const crateGeometry = new THREE.BoxGeometry(this.size, this.size, this.size, 5, 5, 5);
        const crateMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513, // Brown color
            roughness: 0.8,
            metalness: 0.2
        });
        this.model = new THREE.Mesh(crateGeometry, crateMaterial);
        this.modelLoaded = true;
        
        // If we have a pending position, initialize now
        if (this.pendingPosition) {
            this.completeInitialization(this.pendingPosition);
            this.pendingPosition = null;
        }
    }
    
    initialize(position) {
        if (!this.modelLoaded) {
            // Store position for later when model is loaded
            this.pendingPosition = position;
            return this;
        }
        
        return this.completeInitialization(position);
    }
    
    completeInitialization(position) {
        // Set initial position (in the sky)
        const initialPosition = {
            x: position.x,
            y: this.dropHeight,
            z: position.z
        };
        
        // Create mesh from the model
        this.mesh = this.model.clone();
        this.mesh.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Add to scene
        this.scene.add(this.mesh);
        
        // Create rigid body for physics - make it heavier (5x mass)
        const rigidBodyDesc = this.physicsWorld.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(initialPosition.x, initialPosition.y, initialPosition.z)
            .setLinearDamping(0.8) // Increased damping to reduce movement
            .setAngularDamping(0.8) // Reduce rotation
            .setAdditionalMass(50.0); // Make it much heavier (5x default mass)
        
        this.body = this.physicsWorld.world.createRigidBody(rigidBodyDesc);
        
        // Create collider (still using a box shape for physics)
        const colliderDesc = this.physicsWorld.RAPIER.ColliderDesc.cuboid(
            this.size/2, this.size/2, this.size/2
        )
        .setFriction(0.9) // Higher friction so it doesn't slide easily
        .setRestitution(0.2); // Less bounce
        
        this.collider = this.physicsWorld.world.createCollider(colliderDesc, this.body);
        
        // Generate unique ID
        this.uuid = 'crate_' + Math.random().toString(36).substr(2, 9);
        
        // Store references in physics world
        this.physicsWorld.bodies.set(this.uuid, this.body);
        this.physicsWorld.colliders.set(this.uuid, this.collider);
        
        // Set userData for interaction
        this.mesh.userData = { 
            isInteractable: true, 
            type: 'crate',
            instance: this,
            uuid: this.uuid
        };
        
        // Mark as initialized
        this.isInitialized = true;
        this.isDropping = true;
        this.dropStartTime = Date.now();
        
        return this;
    }
    
    update(deltaTime) {
        if (!this.isInitialized) return;
        
        // Update mesh position from physics body
        const position = this.body.translation();
        this.mesh.position.set(position.x, position.y, position.z);
        
        // Update mesh rotation from physics body
        const rotation = this.body.rotation();
        this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
    
    showInteractionPrompt() {
        if (this.promptVisible || this.isOpen) return;
        
        // Create prompt element if it doesn't exist
        if (!this.promptElement) {
            this.promptElement = document.createElement('div');
            this.promptElement.style.position = 'absolute';
            this.promptElement.style.top = '60%';
            this.promptElement.style.left = '50%';
            this.promptElement.style.transform = 'translate(-50%, -50%)';
            this.promptElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            this.promptElement.style.color = 'white';
            this.promptElement.style.padding = '10px 20px';
            this.promptElement.style.borderRadius = '5px';
            this.promptElement.style.fontFamily = 'Arial, sans-serif';
            this.promptElement.style.fontSize = '18px';
            this.promptElement.style.zIndex = '100';
            document.body.appendChild(this.promptElement);
        }
        
        this.promptElement.textContent = 'Press E to open crate';
        this.promptElement.style.display = 'block';
        this.promptVisible = true;
    }
    
    hideInteractionPrompt() {
        if (!this.promptVisible) return;
        
        if (this.promptElement) {
            this.promptElement.style.display = 'none';
        }
        this.promptVisible = false;
    }
    
    showEmptyMessage() {
        // Create message element if it doesn't exist
        if (!this.messageElement) {
            this.messageElement = document.createElement('div');
            this.messageElement.style.position = 'absolute';
            this.messageElement.style.top = '40%';
            this.messageElement.style.left = '50%';
            this.messageElement.style.transform = 'translate(-50%, -50%)';
            this.messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            this.messageElement.style.color = 'white';
            this.messageElement.style.padding = '15px 25px';
            this.messageElement.style.borderRadius = '5px';
            this.messageElement.style.fontFamily = 'Arial, sans-serif';
            this.messageElement.style.fontSize = '20px';
            this.messageElement.style.zIndex = '100';
            document.body.appendChild(this.messageElement);
        }
        
        this.messageElement.textContent = 'The crate is empty';
        this.messageElement.style.display = 'block';
        
        // Hide after 2 seconds
        setTimeout(() => {
            if (this.messageElement) {
                this.messageElement.style.display = 'none';
            }
        }, 2000);
    }
    
    interact() {
        if (!this.canInteract || this.isOpen) return null;
        
        console.log(`Opening crate: ${this.uuid}`);
        this.isOpen = true;
        this.canInteract = false;
        
        // Hide interaction prompt
        this.hideInteractionPrompt();
        
        // Change appearance to look open
        if (this.mesh) {
            // Slightly change the appearance to show it's been opened
            this.mesh.rotation.x = Math.PI / 6; // Tilt the lid
            
            // Play opening sound
            this.openSound.currentTime = 0;
            this.openSound.play().catch(error => {
                console.log("Error playing crate open sound:", error);
            });
            
            // 60% chance of getting a medikit
            const itemRoll = Math.random();
            if (itemRoll < 0.6) {
                console.log('Found a medikit!');
                return 'medikit';
            } else {
                // Play empty sound effect
                setTimeout(() => {
                    this.emptySound.currentTime = 0;
                    this.emptySound.play().catch(error => {
                        console.log("Error playing empty crate sound:", error);
                    });
                    
                    // Show empty message
                    this.showEmptyMessage();
                }, 500); // Slight delay after opening sound
            }
        }
        
        return null; // No item found
    }
    
    cleanup() {
        if (!this.isInitialized) return;
        
        console.log(`Cleaning up crate: ${this.uuid}`);
        
        // Remove UI elements
        this.hideInteractionPrompt();
        if (this.promptElement) {
            document.body.removeChild(this.promptElement);
            this.promptElement = null;
        }
        
        if (this.messageElement) {
            this.messageElement.style.display = 'none';
            document.body.removeChild(this.messageElement);
            this.messageElement = null;
        }
        
        // Remove from scene
        if (this.mesh) {
            this.scene.remove(this.mesh);
            // Dispose geometries and materials
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(material => material.dispose());
                } else {
                    this.mesh.material.dispose();
                }
            }
        }
        
        // Remove physics body and collider
        if (this.uuid) {
            this.physicsWorld.removeBodyByUUID(this.uuid);
        } else if (this.body) {
            try {
                this.physicsWorld.world.removeRigidBody(this.body);
            } catch (e) {
                console.error("Error removing crate rigidbody:", e);
            }
        }
        
        this.isInitialized = false;
    }
} 