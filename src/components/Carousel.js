import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { CarouselGUI } from './CarouselGUI';

export class Carousel {
    constructor(scene, camera, physicsWorld) {
        this.scene = scene;
        this.camera = camera;
        this.physicsWorld = physicsWorld;
        this.model = null;
        this.colliders = [];
        this.rotationSpeed = 0.5;
        this.isRotating = true;
        this.loader = new GLTFLoader();
        this.gui = new CarouselGUI();
        this.interactionDistance = 0.5; // Reduced from 3.0 to 0.5 units
        this.loadModel();
        
        // Add event listener for key presses
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        
        // Add event listener for carousel controls
        document.addEventListener('carouselControlsEnabled', this.onCarouselControlsEnabled.bind(this));
    }

    onKeyDown(event) {
        if (event.key === 'e' || event.key === 'E') {
            if (this.checkProximity()) {
                // Force exit pointer lock immediately
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                
                // Force the cursor to be visible
                document.body.style.cursor = 'auto';
                
                // Directly call the GUI's onKeyDown method
                this.gui.onKeyDown(event);
                
                // Force the cursor to be visible again after a short delay
                setTimeout(() => {
                    document.body.style.cursor = 'auto';
                }, 100);
            }
        }
    }

    onCarouselControlsEnabled(event) {
        // This method will be called when the carousel controls are enabled/disabled
        const enabled = event.detail.enabled;
        
        // If we have a reference to the player or weapon system, we can disable/enable controls here
        // For now, we'll just log the state change
        console.log(`Carousel controls ${enabled ? 'enabled' : 'disabled'}`);
    }

    loadModel() {
        this.loader.load(
            'assets/3d models/level objects/gltf (1)/horse_carousel.gltf',
            (gltf) => {
                this.model = gltf.scene;
                
                // Center and scale the model
                this.model.scale.set(0.015, 0.015, 0.015); // Increased from 0.01 to 0.015 (1.5x larger)
                
                // Position the carousel on the ground
                this.model.position.set(0, -2, -10);
                
                // Add the model to the scene
                this.scene.add(this.model);
                
                // Create physics colliders for the carousel
                this.createPhysicsColliders();
                
                console.log('Carousel model loaded successfully');
            },
            (progress) => {
                console.log('Loading carousel model:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading carousel model:', error);
            }
        );
    }

    createPhysicsColliders() {
        if (!this.model) return;
        
        // Create colliders for each mesh in the model
        this.model.traverse((child) => {
            if (child.isMesh) {
                const geometry = child.geometry;
                let colliderDesc;
                
                // Create appropriate collider based on geometry type
                if (geometry.type === 'BoxGeometry') {
                    // For box-shaped meshes
                    const size = new THREE.Vector3();
                    geometry.computeBoundingBox();
                    geometry.boundingBox.getSize(size);
                    
                    colliderDesc = this.physicsWorld.RAPIER.ColliderDesc.cuboid(
                        size.x / 2 * this.model.scale.x,
                        size.y / 2 * this.model.scale.y,
                        size.z / 2 * this.model.scale.z
                    );
                } else if (geometry.type === 'SphereGeometry') {
                    // For sphere-shaped meshes
                    const radius = geometry.parameters.radius * this.model.scale.x;
                    
                    colliderDesc = this.physicsWorld.RAPIER.ColliderDesc.ball(radius);
                } else if (geometry.type === 'CylinderGeometry') {
                    // For cylinder-shaped meshes
                    const radius = geometry.parameters.radiusTop * this.model.scale.x;
                    const height = geometry.parameters.height * this.model.scale.y;
                    
                    colliderDesc = this.physicsWorld.RAPIER.ColliderDesc.cylinder(
                        radius, 
                        height / 2
                    );
                } else {
                    // For other geometry types, create a convex hull collider
                    const vertices = geometry.attributes.position.array;
                    const indices = geometry.index ? geometry.index.array : null;
                    
                    colliderDesc = this.physicsWorld.RAPIER.ColliderDesc.convexHull(vertices, indices);
                }
                
                // Set the collider's position to match the mesh's world position
                const worldPosition = new THREE.Vector3();
                child.getWorldPosition(worldPosition);
                
                colliderDesc.setTranslation(
                    worldPosition.x,
                    worldPosition.y,
                    worldPosition.z
                );
                
                // Set the collider's rotation to match the mesh's world rotation
                const worldQuaternion = new THREE.Quaternion();
                child.getWorldQuaternion(worldQuaternion);
                
                colliderDesc.setRotation({
                    x: worldQuaternion.x,
                    y: worldQuaternion.y,
                    z: worldQuaternion.z,
                    w: worldQuaternion.w
                });
                
                // Set friction
                colliderDesc.setFriction(0.5);
                
                // Create the collider
                const collider = this.physicsWorld.world.createCollider(colliderDesc);
                this.colliders.push(collider);
            }
        });
    }

    checkProximity() {
        if (!this.model) return false;
        
        // Get the camera's position (player position)
        const playerPosition = this.camera.position;
        
        // Create a bounding box for the carousel model
        const boundingBox = new THREE.Box3().setFromObject(this.model);
        
        // Calculate the closest point on the bounding box to the player
        const closestPoint = new THREE.Vector3();
        closestPoint.copy(playerPosition).clamp(boundingBox.min, boundingBox.max);
        
        // Calculate the distance between the player and the closest point on the carousel
        const distance = playerPosition.distanceTo(closestPoint);
        
        // Check if the player is within the interaction distance
        const isNear = distance <= this.interactionDistance;
        
        // Update the GUI based on proximity
        this.gui.updateProximity(isNear);
        
        return isNear;
    }

    update() {
        if (this.model) {
            // Update rotation speed from GUI
            this.rotationSpeed = this.gui.getSpeedValue();
            
            // Rotate the carousel
            this.model.rotation.y += this.rotationSpeed;
            
            // Check proximity and update GUI
            this.checkProximity();
        }
    }
} 