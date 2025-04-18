import * as THREE from 'three';
// Import Rapier using the correct method
import RAPIER from '@dimforge/rapier3d-compat';

// Define collision groups consistently
const GROUP_DEFAULT = 0;
const GROUP_LOKITO = 1 << 1;
const GROUP_ALL = -1;
const GROUP_NON_LOKITO = GROUP_ALL ^ GROUP_LOKITO;

export class PhysicsWorld {
    constructor() {
        this.world = null;
        this.eventQueue = null;
        this.bodies = new Map();
        this.colliders = new Map();
        this.playerBody = null;
        this.playerCollider = null;
        this.playerWireframe = null;
        this.groundWireframe = null;
        this.RAPIER = RAPIER; // Expose RAPIER
    }

    async initialize() {
        // Initialize Rapier
        await RAPIER.init();
        
        // Create physics world with gravity
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.world = new RAPIER.World(gravity);

        // Create event queue for collision detection
        this.eventQueue = new RAPIER.EventQueue(true); // true enables contact force events
    }

    createPlayer(position = { x: 0, y: 2, z: 0 }) {
        // Create player rigid body with mass
        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z)
            .setLinearDamping(0.5) // Add some damping to make movement smoother
            .setAngularDamping(0.5)
            .setGravityScale(2.4); // Increased from 2.0 to 2.4 (1.2x stronger)
            
        // Create the rigid body
        this.playerBody = this.world.createRigidBody(rigidBodyDesc);
        
        // Note: Mass is set to default value (1.0 kg) as setMass is not available
        // In Rapier 0.12.0, mass is determined by the collider's density and volume
        // We'll adjust the collider properties instead

        // Lock rotations to prevent tipping over
        this.playerBody.lockRotations(true);

        // Create player collider (capsule shape for better character movement)
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.5) // radius, half-height
            .setTranslation(0.0, 0.5, 0.0) // Offset to align with player's feet
            .setFriction(0.05) // Reduced friction further to prevent sticking
            .setRestitution(0.0) // No bounce
            .setDensity(1.0) // Set density to 1.0 kg/m³ for a more reasonable mass
            .setContactForceEventThreshold(0.0); // Disable contact force events to prevent sticking

        // Explicitly set player collision groups to default (collide with ALL) - RE-ENABLE
        colliderDesc.setCollisionGroups((GROUP_DEFAULT << 16) | GROUP_ALL) // Group: 0 (default), Filter: ALL
                    .setSolverGroups((GROUP_DEFAULT << 16) | GROUP_ALL);   // Also apply to solver groups

        this.playerCollider = this.world.createCollider(colliderDesc, this.playerBody);

        // Create wireframe visualization of the collision capsule
        const capsuleGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.0 // Changed from 0.5 to 0.0 to make wireframe completely invisible
        });
        const wireframeMesh = new THREE.Mesh(capsuleGeometry, wireframeMaterial);
        wireframeMesh.position.y = 0.5; // Match the collider's offset
        wireframeMesh.visible = false; // Explicitly set wireframe to be invisible
        this.playerWireframe = wireframeMesh;

        // Store references
        this.bodies.set('player', this.playerBody);
        this.colliders.set('player', this.playerCollider);
        // Add userData to player collider for identification
        this.playerCollider.userData = { type: 'player' };

        return this.playerBody;
    }

    isPlayerGrounded() {
        if (!this.world || !this.playerBody) {
            return false;
        }

        const playerPosition = this.playerBody.translation();
        // Adjust ray origin to be centered and slightly inside the capsule to avoid missing the ground
        const rayOrigin = { 
            x: playerPosition.x, 
            y: playerPosition.y - 0.4, // Moved up slightly (was -0.45)
            z: playerPosition.z 
        }; 
        const rayDirection = { x: 0, y: -1, z: 0 }; // Cast downwards
        const maxDistance = 0.4; // Increased from 0.3 to 0.4 to detect ground more reliably
        const solid = true; // Hit solid objects
        
        // Use debug to test ray hits
        console.log(`Casting ground ray from y=${rayOrigin.y} for distance ${maxDistance}`);
        
        const ray = new RAPIER.Ray(rayOrigin, rayDirection);
        const hit = this.world.castRayAndGetNormal(
            ray, 
            maxDistance, 
            solid, 
            (GROUP_DEFAULT << 16) | GROUP_ALL, // Collide with everything
            undefined, 
            this.playerCollider // Exclude the player's own collider
        );

        // If we hit something, log the collision point for debugging
        if (hit) {
            console.log(`Ground detection: hit at distance ${hit.toi}`);
            return true;
        }
        
        return false;
    }

    getPlayerBody() {
        return this.playerBody;
    }

    createGround() {
        // Create ground
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000); // Increased from 100x100 to 1000x1000
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x269926,  // Lighter green color
            roughness: 1.0, // Maximum roughness to prevent reflections
            metalness: 0.0, // No metalness (no reflections)
            transparent: false, // Make fully opaque
            opacity: 1.0 // Full opacity
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -2;
        ground.receiveShadow = true;

        // Create ground collider
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(500.0, 0.1, 500.0) 
            .setTranslation(0.0, -2.1, 0.0) 
            .setFriction(0.5)
            // Explicitly set default group (0) and filter (ALL)
            .setCollisionGroups((GROUP_DEFAULT << 16) | GROUP_ALL)
            .setSolverGroups((GROUP_DEFAULT << 16) | GROUP_ALL);
        const groundCollider = this.world.createCollider(groundColliderDesc);

        // Create wireframe visualization for ground collider
        const groundWireframeGeometry = new THREE.BoxGeometry(1000, 0.2, 1000); // Increased to match visual size
        const groundWireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000ff,
            wireframe: true,
            transparent: true,
            opacity: 0.0 // Hide wireframe completely
        });
        const groundWireframe = new THREE.Mesh(groundWireframeGeometry, groundWireframeMaterial);
        groundWireframe.position.y = -2.1; // Adjusted to match ground position
        this.groundWireframe = groundWireframe;

        // Store references
        this.colliders.set(ground.uuid, groundCollider);

        return ground;
    }

    // Create invisible walls around the perimeter to prevent players from jumping over the boundaries
    createPerimeterBarriers() {
        if (!this.RAPIER || !this.world) {
            console.error("Cannot create perimeter barriers: Physics world not initialized");
            return;
        }

        console.log("Creating invisible perimeter barriers to prevent jumping over walls");
        
        // Define the perimeter dimensions - make them larger to ensure coverage
        const perimeterWidth = 150; // Increased from 90 to 150 (half-width of the playable area)
        const perimeterDepth = 150; // Increased from 90 to 150 (half-depth of the playable area)
        const wallHeight = 500; // Dramatically increased from 100 to 500 (to catch high jumps)
        const wallThickness = 10; // Increased from 2 to 10 (thicker barriers)
        const wallY = -50; // Start walls below ground level
        
        // Create four invisible walls around the perimeter - wider and with overlap at corners
        // North wall (positive Z)
        this.createInvisibleWall(0, wallY, perimeterDepth, perimeterWidth * 2 + wallThickness, wallHeight, wallThickness);
        
        // South wall (negative Z)
        this.createInvisibleWall(0, wallY, -perimeterDepth, perimeterWidth * 2 + wallThickness, wallHeight, wallThickness);
        
        // East wall (positive X)
        this.createInvisibleWall(perimeterWidth, wallY, 0, wallThickness, wallHeight, perimeterDepth * 2 + wallThickness);
        
        // West wall (negative X)
        this.createInvisibleWall(-perimeterWidth, wallY, 0, wallThickness, wallHeight, perimeterDepth * 2 + wallThickness);
        
        // Add extra ceiling barrier to prevent extreme jumps or glitches
        this.createInvisibleWall(0, 80, 0, perimeterWidth * 2, wallThickness, perimeterDepth * 2);
        
        console.log("Enhanced perimeter barriers created");
    }
    
    // Helper method to create a single invisible wall
    createInvisibleWall(x, y, z, width, height, depth) {
        // Create static rigid body (fixed)
        const rigidBodyDesc = this.RAPIER.RigidBodyDesc.fixed()
            .setTranslation(x, y, z);
        const rigidBody = this.world.createRigidBody(rigidBodyDesc);

        // Create collider
        const colliderDesc = this.RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2)
            .setCollisionGroups((GROUP_DEFAULT << 16) | GROUP_ALL)
            .setSolverGroups((GROUP_DEFAULT << 16) | GROUP_ALL);
            
        const collider = this.world.createCollider(colliderDesc, rigidBody);
        
        // Add userData to identify this as a perimeter wall
        collider.userData = { type: 'perimeter_wall' };
        
        // Create a unique ID for this wall for reference
        const wallId = `wall_${x}_${y}_${z}`;
        this.bodies.set(wallId, rigidBody);
        this.colliders.set(wallId, collider);
        
        return rigidBody;
    }

    createDynamicCube(position = { x: 0, y: 0, z: 0 }) {
        // Create cube mesh
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const cubeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            roughness: 0.7,
            metalness: 0.3
        });
        const cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cubeMesh.position.set(position.x, position.y, position.z);
        cubeMesh.castShadow = true;
        cubeMesh.receiveShadow = true;

        // Create rigid body
        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z);
        const rigidBody = this.world.createRigidBody(rigidBodyDesc);

        // Create collider
        const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
        const collider = this.world.createCollider(colliderDesc, rigidBody);

        // Create wireframe visualization for cube collider
        const cubeWireframeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const cubeWireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const cubeWireframe = new THREE.Mesh(cubeWireframeGeometry, cubeWireframeMaterial);
        cubeWireframe.position.copy(cubeMesh.position);
        cubeMesh.userData.wireframe = cubeWireframe;

        // Store references
        this.bodies.set(cubeMesh.uuid, rigidBody);
        this.colliders.set(cubeMesh.uuid, collider);

        return cubeMesh;
    }

    // NEW: Create a static box (building placeholder)
    createStaticBox(position, size, rotationY = 0) {
        const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const boxMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x555566, // Dark grey/blue
            roughness: 0.8,
            metalness: 0.1 
        });
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        boxMesh.position.set(position.x, position.y + size.y / 2, position.z); // Position base at y
        boxMesh.rotation.y = rotationY;
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;

        // Create static rigid body (fixed)
        const rigidBodyDesc = this.RAPIER.RigidBodyDesc.fixed()
            .setTranslation(boxMesh.position.x, boxMesh.position.y, boxMesh.position.z)
            .setRotation({ x: 0, y: Math.sin(rotationY / 2), z: 0, w: Math.cos(rotationY / 2) }); // Convert Y rotation to quaternion
        const rigidBody = this.world.createRigidBody(rigidBodyDesc);

        // Create collider
        const colliderDesc = this.RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
            // Explicitly set default group (0) and filter (ALL)
            .setCollisionGroups((GROUP_DEFAULT << 16) | GROUP_ALL)
            .setSolverGroups((GROUP_DEFAULT << 16) | GROUP_ALL);
            
        const collider = this.world.createCollider(colliderDesc, rigidBody);

        // Store references (using mesh UUID)
        this.bodies.set(boxMesh.uuid, rigidBody);
        this.colliders.set(boxMesh.uuid, collider);
        // Add userData to identify as non-enemy for raycasting if needed
        collider.userData = { type: 'static_obstacle' };

        return boxMesh;
    }

    createStaticMeshCollider(vertices, indices) {
        if (!this.RAPIER || !this.world) {
            console.error("Rapier physics world not initialized.");
            return null;
        }
        try {
            // Create static rigid body (fixed)
            const rigidBodyDesc = this.RAPIER.RigidBodyDesc.fixed();
            const rigidBody = this.world.createRigidBody(rigidBodyDesc);

            // Ensure vertices are Float32Array and indices are Uint32Array
            const floatVertices = (vertices instanceof Float32Array) ? vertices : new Float32Array(vertices);
            const uintIndices = (indices instanceof Uint32Array) ? indices : new Uint32Array(indices);

            // Use trimesh collider for more precise collision detection
            const colliderDesc = this.RAPIER.ColliderDesc.trimesh(floatVertices, uintIndices)
                .setCollisionGroups((GROUP_DEFAULT << 16) | GROUP_ALL)
                .setSolverGroups((GROUP_DEFAULT << 16) | GROUP_ALL)
                .setFriction(0.1) // Significantly reduced friction for smoother movement
                .setRestitution(0.0); // No bounce

            const collider = this.world.createCollider(colliderDesc, rigidBody);
            collider.userData = { type: 'scene_static_mesh' };

            // Create wireframe visualization (using the same transformed vertices/indices)
            const wireframeGeometry = new THREE.BufferGeometry();
            wireframeGeometry.setAttribute('position', new THREE.BufferAttribute(floatVertices, 3));
            wireframeGeometry.setIndex(new THREE.BufferAttribute(uintIndices, 1));

            const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff00, // Yellow
                wireframe: true,
                depthTest: false, // Render wireframe on top
                transparent: true,
                opacity: 0.3 // Make slightly transparent
            });
            const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
            wireframeMesh.renderOrder = 1; // Ensure it renders after the main scene

            console.log(`Created trimesh collider and wireframe.`);
            return wireframeMesh; // Return the wireframe for toggling visibility

        } catch (error) {
            console.error("Error creating static mesh collider:", error);
            console.error(`Vertices count: ${vertices ? vertices.length / 3 : 'N/A'}, Indices count: ${indices ? indices.length : 'N/A'}`);
            if (vertices && indices) {
                 console.error("Vertices (first 12):", Array.from(vertices.slice(0, 12)));
                 console.error("Indices (first 12):", Array.from(indices.slice(0, 12)));
            }
            return null;
        }
    }

    createBullet(position = { x: 0, y: 0, z: 0 }) {
        // Create rigid body for bullet
        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z)
            .setLinearDamping(0.5) // Increased damping to slow bullets down
            .setGravityScale(0.1); // <-- ADDED: Reduce gravity effect on bullets

        const rigidBody = this.world.createRigidBody(rigidBodyDesc);
        
        // Create collider for bullet - cylinder shape
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.05, 0.15) // radius, half-height
            .setFriction(0.1)
            .setRestitution(0.5) // Some bounce
            .setDensity(1.0);
            
        const collider = this.world.createCollider(colliderDesc, rigidBody);
        
        // Store references with a unique ID
        const bulletId = 'bullet_' + Date.now();
        this.bodies.set(bulletId, rigidBody);
        this.colliders.set(bulletId, collider);
        
        // Store the ID in the rigid body for later reference
        rigidBody.userData = { id: bulletId };
        
        return rigidBody;
    }
    
    removeBody(body) {
        if (body && body.userData && body.userData.id) {
            const id = body.userData.id;
            
            // Remove collider if it exists
            if (this.colliders.has(id)) {
                const collider = this.colliders.get(id);
                this.world.removeCollider(collider, true);
                this.colliders.delete(id);
            }
            
            // Remove rigid body
            this.world.removeRigidBody(body);
            this.bodies.delete(id);
        }
    }

    // New method to remove body/collider using the stored UUID
    removeBodyByUUID(uuid) {
        if (this.colliders.has(uuid)) {
            const collider = this.colliders.get(uuid);
            try {
                this.world.removeCollider(collider, true); // true to wake up potentially sleeping islands
            } catch (e) {
                 console.error(`Error removing collider with UUID ${uuid}:`, e);
            }
            this.colliders.delete(uuid);
        } else {
             console.warn(`Collider with UUID ${uuid} not found for removal.`);
        }

        if (this.bodies.has(uuid)) {
            const body = this.bodies.get(uuid);
             try {
                 this.world.removeRigidBody(body);
             } catch (e) {
                 console.error(`Error removing rigid body with UUID ${uuid}:`, e);
             }
            this.bodies.delete(uuid);
        } else {
             console.warn(`Rigid body with UUID ${uuid} not found for removal.`);
        }
    }

    update() {
        if (!this.world) return;

        // Step the physics world and pass the event queue
        this.world.step(this.eventQueue);

        // Update mesh positions based on physics bodies
        this.bodies.forEach((body, uuid) => {
            if (uuid === 'player') {
                // Update player wireframe position
                if (this.playerWireframe && this.playerBody) {
                    const position = this.playerBody.translation();
                    this.playerWireframe.position.set(position.x, position.y, position.z);
                }
                return; // Skip player body as it's handled by PlayerController
            }
            
            // Check if this is a bullet (has userData.id that starts with 'bullet_')
            if (body.userData && body.userData.id && body.userData.id.startsWith('bullet_')) {
                // Find the bullet mesh in the scene
                const bulletId = body.userData.id;
                const bulletMesh = this.scene.children.find(child => 
                    child.userData && child.userData.bulletId === bulletId
                );
                
                if (bulletMesh) {
                    // Update bullet mesh position based on physics body
                    const position = body.translation();
                    bulletMesh.position.set(position.x, position.y, position.z);
                }
                return;
            }
            
            const mesh = this.scene.getObjectByProperty('uuid', uuid);
            if (mesh) {
                const position = body.translation();
                const rotation = body.rotation();
                
                mesh.position.set(position.x, position.y, position.z);
                mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
                
                // Update wireframe position if it exists
                if (mesh.userData.wireframe) {
                    mesh.userData.wireframe.position.copy(mesh.position);
                    mesh.userData.wireframe.quaternion.copy(mesh.quaternion);
                }
            }
        });
    }

    handleCollisionEvent(handle1, handle2, started) {
        let playerColliderData = null;
        let enemyColliderData = null;

        if (data1.type === 'player' && (data2.type === 'lokito' || data2.type === 'dnb')) {
            playerColliderData = data1;
            enemyColliderData = data2;
        } else if ((data1.type === 'lokito' || data1.type === 'dnb') && data2.type === 'player') {
            playerColliderData = data2;
            enemyColliderData = data1;
        }

        if (playerColliderData && enemyColliderData && this.playerDamageCallback) {
            console.log(`[PhysicsWorld] Player-${enemyColliderData.type} collision STARTED.`);
            const enemyInstance = enemyColliderData.instance;
            if (enemyInstance && enemyInstance.isInitialized && enemyInstance.health > 0) {
                const now = Date.now();
                const timeSinceLastAttack = now - enemyInstance.lastAttackTime;
                const cooldownMet = timeSinceLastAttack >= enemyInstance.proximityDamageInterval;
                console.log(`[PhysicsWorld] Cooldown check (on collision start) for ${enemyColliderData.type}: ${timeSinceLastAttack}ms >= ${enemyInstance.proximityDamageInterval}ms ? ${cooldownMet}`);
                
                if (cooldownMet) {
                    this.playerDamageCallback(enemyInstance.damagePerHit);
                    enemyInstance.lastAttackTime = now;
                } 
            }
        }
    }
} // End of PhysicsWorld class 