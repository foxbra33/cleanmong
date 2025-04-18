"C:\Users\cobra\Desktop\vibe coding\mongtendo64\assets\sounds\FootstepsCement_BW.7457.wav"import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';

export class Player {
    constructor(scene, camera, physicsWorld) {
        this.scene = scene;
        this.camera = camera;
        this.physicsWorld = physicsWorld;
        
        // Create player mesh
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        // Create physics body
        const rigidBodyDesc = physicsWorld.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(0, 5, 0);
        this.body = physicsWorld.world.createRigidBody(rigidBodyDesc);
        
        // Create collider
        const colliderDesc = physicsWorld.RAPIER.ColliderDesc.cuboid(0.5, 1, 0.5);
        this.collider = physicsWorld.world.createCollider(colliderDesc, this.body);
        
        // Movement parameters
        this.moveSpeed = 100.0; // Extremely high speed for instant movement
        this.jumpForce = 3.0; // Reduced jump force for better control
        this.acceleration = 10000.0; // Extremely high acceleration
        this.drag = 0.0; // No drag
        this.airResistance = 0.0; // No air resistance
        this.groundFriction = 0.0; // No ground friction
        this.maxSpeed = 100.0; // Extremely high maximum speed
        this.useDirectPosition = true; // Use direct position control instead of physics
        
        // Movement state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.jump = false;
        this.canJump = true;
        this.controlsEnabled = true;
        
        // Add to physics world
        physicsWorld.addBody(this.body, this.mesh);
        
        // Set up controls
        this.setupControls();
    }
    
    setupControls() {
        document.addEventListener('keydown', (event) => {
            if (!this.controlsEnabled) return;
            
            switch (event.code) {
                case 'KeyW':
                    this.moveForward = true;
                    break;
                case 'KeyS':
                    this.moveBackward = true;
                    break;
                case 'KeyA':
                    this.moveLeft = true;
                    break;
                case 'KeyD':
                    this.moveRight = true;
                    break;
                case 'Space':
                    if (this.canJump) {
                        this.jump = true;
                    }
                    break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch (event.code) {
                case 'KeyW':
                    this.moveForward = false;
                    break;
                case 'KeyS':
                    this.moveBackward = false;
                    break;
                case 'KeyA':
                    this.moveLeft = false;
                    break;
                case 'KeyD':
                    this.moveRight = false;
                    break;
                case 'Space':
                    this.jump = false;
                    break;
            }
        });
    }
    
    update(deltaTime) {
        if (!this.controlsEnabled) {
            return;
        }

        // Get current position
        const position = this.body.translation();
        
        // Calculate movement direction in world space
        const moveDirection = new THREE.Vector3();
        
        if (this.moveForward) moveDirection.z -= 1;
        if (this.moveBackward) moveDirection.z += 1;
        if (this.moveLeft) moveDirection.x -= 1;
        if (this.moveRight) moveDirection.x += 1;
        
        // Normalize movement direction
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
        }

        // Ultra-fast direct position control (like Call of Duty)
        if (moveDirection.length() > 0) {
            // Calculate new position directly
            const moveAmount = this.moveSpeed * deltaTime * 2.0; // Double the movement speed
            const newPosition = new THREE.Vector3(
                position.x + moveDirection.x * moveAmount,
                position.y,
                position.z + moveDirection.z * moveAmount
            );
            
            // Set position directly
            this.body.setTranslation(newPosition, true);
            this.body.wakeUp();
        }

        // Handle jumping with improved responsiveness
        if (this.canJump && this.jump) {
            const jumpImpulse = new THREE.Vector3(0, this.jumpForce, 0);
            this.body.applyImpulse(jumpImpulse, true);
            this.body.wakeUp();
            this.canJump = false;
        }

        // Update mesh position
        const currentPosition = this.body.translation();
        this.mesh.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
        
        // Update camera position
        if (this.camera) {
            this.camera.position.copy(this.mesh.position);
            this.camera.position.y += 2;
        }
    }
    
    enableControls() {
        this.controlsEnabled = true;
    }
    
    disableControls() {
        this.controlsEnabled = false;
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.jump = false;
    }
} 