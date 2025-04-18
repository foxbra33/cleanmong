import { Engine } from './core/Engine.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { GrassField } from './components/GrassField.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

// Array to store collider wireframes globally within this module
let colliderWireframes = [];
let collidersVisible = false; // Track visibility state

// Function to load the scene model
async function loadSceneModel(engine, physicsWorld) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const modelPath = 'assets/3d models/scene/resident_evil_code_veronica_20_gltf/resident_evil_code_veronica_20_gltf/scene.gltf';
        
        console.log(`Loading Resident Evil scene from: ${modelPath}`);
        
        loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                
                // Scale and position the model
                model.scale.set(1.43, 1.43, 1.43);
                model.position.set(0, -2, 0);
                model.updateMatrixWorld(true);

                // Add the model to the scene
                engine.addToScene(model);
                console.log('Resident Evil scene loaded successfully');

                // Create static colliders for each mesh in the model
                model.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        console.log(`Processing mesh for collider: ${child.name}`);
                        const geometry = child.geometry;
                        const vertices = geometry.attributes.position?.array;
                        const indices = geometry.index?.array;

                        if (vertices && indices) {
                             // Apply world transformation to vertices
                             const transformedVertices = [];
                             const tempVec = new THREE.Vector3();
                             for (let i = 0; i < vertices.length; i += 3) {
                                 tempVec.set(vertices[i], vertices[i + 1], vertices[i + 2]);
                                 tempVec.applyMatrix4(child.matrixWorld);
                                 transformedVertices.push(tempVec.x, tempVec.y, tempVec.z);
                             }
                             const floatVertices = new Float32Array(transformedVertices);
                             const uintIndices = new Uint32Array(indices);

                             const wireframeMesh = physicsWorld.createStaticMeshCollider(floatVertices, uintIndices);
                            
                             if (wireframeMesh) {
                                 wireframeMesh.visible = collidersVisible;
                                 engine.addToScene(wireframeMesh);
                                 colliderWireframes.push(wireframeMesh);
                             }
                        } else {
                            console.warn(`Mesh ${child.name} skipped: Missing vertices or indices.`);
                        }
                    }
                });
                console.log(`Generated ${colliderWireframes.length} collider wireframes.`);

                resolve(model);
            },
            (progress) => {
                console.log('Loading scene model:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
            },
            (error) => {
                console.error('Error loading Resident Evil scene:', error);
                reject(error);
            }
        );
    });
}

async function main() {
    // Initialize the engine
    const engine = new Engine();
    await engine.initialize();

    // Create and initialize physics world
    const physicsWorld = new PhysicsWorld();
    await physicsWorld.initialize();
    
    // Set engine reference in physics world for communication
    physicsWorld.engine = engine;

    // Connect physics world to engine
    engine.setPhysicsWorld(physicsWorld);

    // Add a ground plane
    const ground = physicsWorld.createGround();
    engine.addToScene(ground);
    
    // Create invisible perimeter barriers to prevent jumping over walls
    physicsWorld.createPerimeterBarriers();
    
    // Hide the ground plane (keep physics, hide visuals)
    ground.visible = false;

    // Add ground wireframe to scene if it exists
    if (physicsWorld.groundWireframe) {
        engine.addToScene(physicsWorld.groundWireframe);
    }

    // Add grass field to the ground
    const grassField = new GrassField(1000, 1000, 4500000);
    engine.addToScene(grassField);
    engine.grassField = grassField; // Store reference for updates
    
    // Hide the grass field
    grassField.visible = false;

    // Load the Resident Evil scene model
    try {
        const sceneModel = await loadSceneModel(engine, physicsWorld);
        console.log('Scene model loaded and added to the game world');
    } catch (error) {
        console.error('Failed to load scene model:', error);
    }

    // Buildings removed
    /*
    // Add some simple buildings
    const groundY = -2.0; // Base Y position for buildings
    const buildings = [
        { pos: { x: -20, z: -30 }, size: { x: 10, y: 15, z: 20 }, rot: Math.PI / 6 },
        { pos: { x: 15, z: -10 }, size: { x: 18, y: 10, z: 8 }, rot: -Math.PI / 4 },
        { pos: { x: 5, z: 35 }, size: { x: 12, y: 20, z: 12 }, rot: 0 },
        { pos: { x: -40, z: 10 }, size: { x: 8, y: 8, z: 25 }, rot: Math.PI / 2 },
    ];

    buildings.forEach(b => {
        const buildingMesh = physicsWorld.createStaticBox( 
             { x: b.pos.x, y: groundY, z: b.pos.z }, // Position base on ground
             b.size,
             b.rot
         );
         engine.addToScene(buildingMesh);
    });
    */

    // Create player character
    const player = physicsWorld.createPlayer({ x: 2.15, y: -1.50, z: 15.13 });
    
    // Game will start when the player clicks the Play button
    // engine.start() is now called from startGame() method
    
    // Add key listener for day/night toggle
    window.addEventListener('keydown', (event) => {
        // Press 'L' key to toggle between day and night
        if (event.key.toLowerCase() === 'l') {
            engine.toggleDayNight();
            console.log(`Switched to ${engine.isDaytime ? 'day' : 'night'} time`);
        }
        
        // Press 'V' key to toggle coordinates display (changed from 'C' which is now used for crouch)
        if (event.key.toLowerCase() === 'v') {
            engine.toggleCoordinatesDisplay();
            console.log(`Coordinates display ${engine.showCoordinates ? 'shown' : 'hidden'}`);
        }
        
        // Press 'M' key to toggle collider wireframes
        if (event.key.toLowerCase() === 'm') {
            // Toggle collider wireframes
            collidersVisible = !collidersVisible; // Toggle state
            console.log(`Toggling debug view: ${collidersVisible ? 'ON' : 'OFF'}`);
            
            // 1. Toggle wireframe colliders
            colliderWireframes.forEach(wf => {
                wf.visible = collidersVisible;
            });
            
            // 2. Signal weapon system about the toggle
            if (engine.playerController && engine.playerController.weaponSystem) {
                engine.playerController.weaponSystem.showHitboxes = collidersVisible;
            }
            
            // 3. Traverse scene to update all objects that need special handling
            if (engine.scene) {
                engine.scene.traverse(obj => {
                    // Always keep bullets, smoke, blood visible
                    if (obj.userData && (
                        obj.userData.type === 'bullet' || 
                        obj.userData.type === 'smoke' ||
                        obj.userData.type === 'blood' ||
                        obj.userData.isBullet === true
                    )) {
                        obj.visible = true;
                    }
                    
                    // Special handling for hitboxes
                    if (obj.userData && obj.userData.isHitbox) {
                        // CRITICAL: Always keep the object visible for raycasting
                        obj.visible = true;
                        
                        // But control transparency of material based on toggle state
                        if (obj.material) {
                            obj.material.transparent = true;
                            
                            if (collidersVisible) {
                                // Show hitboxes when toggle is ON
                                obj.material.opacity = 0.5;
                                obj.material.wireframe = true;
                            } else {
                                // Hide hitboxes visually (but keep object visible) when toggle is OFF
                                obj.material.opacity = 0;
                                obj.material.wireframe = false;
                            }
                        }
                    }
                });
            }
        }
    });
}

main().catch(console.error); 