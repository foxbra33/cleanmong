import * as THREE from 'three';
import { PlayerController } from '../components/PlayerController.js';
import { WeaponSystem } from '../components/WeaponSystem.js';
import { Compass } from '../components/Compass.js';
import { Lokito } from '../components/Lokito.js';
import { DNB } from '../components/DNB.js';
import { Crate } from '../components/Crate.js';
import { AudioManager } from '../audio/AudioManager.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Engine {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.isRunning = false;
        this.physicsWorld = null;
        this.playerController = null;
        this.weaponSystem = null;
        this.compass = null;
        this.clock = new THREE.Clock();
        this.enemies = [];
        this.maxEnemies = 10;
        this.spawnInterval = 5000;
        this.lastSpawnTime = 0;
        this.groundSize = 1000;
        this.spawnRadiusMax = 60;
        this.spawnRadiusMin = 20;
        this.audioManager = new AudioManager();
        
        // Rain system properties
        this.rainSystem = null;
        this.isRaining = false;
        this.rainParticles = [];
        this.rainIntensity = 0;
        this.rainSound = null;
        this.rainSoundPath = 'assets/sounds/si_rainsong_fx_rain_city_puddles_drips_patio_one_shot_zany.wav';
        this.rainCheckInterval = 30000; // Check every 30 seconds if rain should start/stop
        this.lastRainCheck = 0;
        this.rainDuration = {min: 20000, max: 60000}; // Rain duration between 20-60 seconds
        this.rainChance = 0.3; // 30% chance of rain when checked
        this.activeRainSounds = []; // Track active rain sound sources
        
        // Audio resources
        this.nightMusicPath = 'assets/sounds/ESM_SGAL_cinematic_fx_ambience_horror_loops_dark_street_full_sinister_soundscape_evil_cm.wav';
        this.dayMusicPath = 'assets/sounds/ept_syn_128_home_C.wav';
        this.nightMusicBuffer = null;
        this.dayMusicBuffer = null;
        
        // Day/night cycle properties
        this.isDaytime = false; // Start at night
        this.dayDuration = 120; // seconds for a full day (2 minutes)
        this.nightDuration = 120; // seconds for a full night (2 minutes)
        this.transitionDuration = 5; // seconds for transition (reduced for faster transition)
        this.timeOfDay = 0; // 0 = midnight, dayDuration/2 = noon
        this.dayObjects = [];
        this.nightObjects = [];
        
        // Survival timer properties
        this.survivalTimer = 0; // Tracks elapsed time in current phase
        this.isSurvivalTransitioning = false; // Flag for transition state
        this.enemyFadeStartTime = 0; // When enemy fade started
        this.enemyFadeDuration = 3; // Seconds to fade enemies
        this.fadingEnemies = []; // Store enemies being faded out
        
        // Crate properties
        this.crates = [];
        this.crateSpawnPositions = [
            new THREE.Vector3(1.41, -1.50, 12.95),
            new THREE.Vector3(1.71, -1.5, 7.74),
            new THREE.Vector3(0.87, -1.5, -8.03)
        ];
        this.crateDropSound = null;
        this.hasSpawnedCrates = false; // Flag to track if crates have been spawned in current day cycle
        this.crateSpawnDelay = 5; // Seconds to wait after day starts before spawning crates
        
        // Coordinate display properties
        this.showCoordinates = false;
        this.coordinatesElement = null;
        
        // UI elements for timer display
        this.timerElement = null;
        
        // Days survived counter
        this.daysSurvived = 1;
        this.daysSurvivedElement = null;
        this.scoreElement = null; // Add score element reference
        this.playerScore = 0; // Track player score
    }

    async initialize() {
        // Create scene
        this.scene = new THREE.Scene();
        
        // Initial background color (will be changed by day/night cycle)
        this.scene.background = new THREE.Color(0x0A0A1A); // Dark blue/black night sky

        // Initial fog (will be changed by day/night cycle)
        this.scene.fog = new THREE.FogExp2(0x0A0A1A, 0.015); // Dark fog

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 2, 0);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);

        // Add crosshair
        this.createCrosshair();

        // Create lighting, moon, stars, etc from the existing code
        this.createNightEnvironment();
        
        // Create daytime environment (initially hidden)
        this.createDayEnvironment();
        
        // Initialize rain system
        this.createRainSystem();
        
        // Set initial environment (night time)
        this.setEnvironment(false);

        // Load background music for night (initial state)
        this.loadNightMusic();

        // Also preload day music for smoother transition
        this.preloadDayMusic();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Add key event listener for displaying player coordinates
        window.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Create UI elements for timer
        this.createTimerDisplay();

        // Preload textures
        this.preloadTextures();
        
        // Create start screen with play button
        this.createStartScreen();
    }

    createCrosshair() {
        // Create crosshair element
        const crosshair = document.createElement('div');
        crosshair.style.position = 'absolute';
        crosshair.style.top = '50%';
        crosshair.style.left = '50%';
        crosshair.style.width = '20px';
        crosshair.style.height = '20px';
        crosshair.style.transform = 'translate(-50%, -50%)';
        crosshair.style.pointerEvents = 'none';
        crosshair.style.zIndex = '1000';
        crosshair.style.display = 'none'; // Initially hidden
        
        // Create crosshair lines
        const horizontalLine = document.createElement('div');
        horizontalLine.style.position = 'absolute';
        horizontalLine.style.width = '20px';
        horizontalLine.style.height = '2px';
        horizontalLine.style.backgroundColor = 'white';
        horizontalLine.style.top = '9px';
        horizontalLine.style.left = '0';
        
        const verticalLine = document.createElement('div');
        verticalLine.style.position = 'absolute';
        verticalLine.style.width = '2px';
        verticalLine.style.height = '20px';
        verticalLine.style.backgroundColor = 'white';
        verticalLine.style.left = '9px';
        verticalLine.style.top = '0';
        
        // Add lines to crosshair
        crosshair.appendChild(horizontalLine);
        crosshair.appendChild(verticalLine);
        
        // Add crosshair to document
        document.body.appendChild(crosshair);
        
        // Store reference to the crosshair
        this.crosshair = crosshair;
    }

    setPhysicsWorld(physicsWorld) {
        this.physicsWorld = physicsWorld;
        this.physicsWorld.scene = this.scene;
        
        // Create player controller after physics world is set
        this.playerController = new PlayerController(
            this.camera,
            this.renderer.domElement,
            this.physicsWorld,
            this.audioManager
        );
        
        // Set engine reference in player controller
        this.playerController.engine = this;

        // Create weapon system
        this.weaponSystem = new WeaponSystem(
            this.camera,
            this.physicsWorld
        );
        
        // Connect weapon system to player controller
        this.playerController.weaponSystem = this.weaponSystem;
        
        // Set the playerController reference in the weaponSystem
        this.weaponSystem.playerController = this.playerController;
        
        // Create compass
        this.compass = new Compass(
            this.camera,
            this.scene
        );

        // Add player wireframe to scene if it exists
        if (this.physicsWorld.playerWireframe) {
            this.scene.add(this.physicsWorld.playerWireframe);
        }
        
        // Add ground wireframe to scene if it exists
        if (this.physicsWorld.groundWireframe) {
            this.scene.add(this.physicsWorld.groundWireframe);
        }
        
        // Ensure player position is set correctly after the controller is created
        this.setInitialPlayerPosition();
    }
    
    // Method to properly set the initial player position
    setInitialPlayerPosition() {
        if (!this.physicsWorld || !this.playerController) return;
        
        // Get the player body
        const playerBody = this.physicsWorld.getPlayerBody();
        if (playerBody) {
            // Get the current position from the physics body
            const position = playerBody.translation();
            
            // Set the camera position to match the player body position
            // Add the player height to the Y coordinate
            this.camera.position.set(
                position.x,
                position.y + this.playerController.playerHeight,
                position.z
            );
            
            // Update the player mesh position
            this.playerController.player.mesh.position.set(
                position.x,
                position.y,
                position.z
            );
            
            console.log(`Initial player position set to: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
        }
    }

    addToScene(object) {
        this.scene.add(object);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        this.isRunning = true;
        if (this.physicsWorld && this.playerController) {
            this.spawnInitialEnemies(5);
        } else {
            console.warn("Could not spawn initial enemies: Physics or PlayerController not ready at start().");
        }
        this.animate();
    }

    stop() {
        this.isRunning = false;
    }

    animate() {
        if (!this.isRunning) return;

        requestAnimationFrame(this.animate.bind(this));
        
        // Calculate delta time
        const deltaTime = this.clock.getDelta();
        
        // Update survival timer
        this.survivalTimer += deltaTime;
        
        // Update the timer display
        this.updateTimerDisplay();
        
        // Update rain system
        this.updateRain(deltaTime);
        
        // Check crate spawning during day
        if (this.isDaytime && !this.hasSpawnedCrates && this.survivalTimer >= this.crateSpawnDelay) {
            this.spawnCrates();
            this.hasSpawnedCrates = true;
        }
        
        // Check if it's time to change cycle
        if (!this.isSurvivalTransitioning) {
            if (!this.isDaytime && this.survivalTimer >= this.nightDuration) {
                // Player survived night, fade out enemies and transition to day
                this.startEnemyFadeOut();
            } else if (this.isDaytime && this.survivalTimer >= this.dayDuration) {
                // Day is over, transition to night
                this.setEnvironment(false);
            }
        } else {
            // Handle enemy fade transition
            this.updateEnemyFade(deltaTime);
        }
        
        // Update day/night cycle
        if (this.moon) {
            this.moon.rotation.y += 0.0005;
        }
        
        // Update physics
        if (this.physicsWorld) {
            this.physicsWorld.update();
        }
        
        // Update player controller
        if (this.playerController) {
            this.playerController.update(deltaTime);
        }
        
        // Update weapon system
        if (this.weaponSystem) {
            this.weaponSystem.update(deltaTime);
        }
        
        // Update compass
        if (this.compass) {
            this.compass.update(deltaTime);
        }

        // Update grass field animation if it exists
        if (this.grassField) {
            this.grassField.update(deltaTime);
        }

        // Update coordinates display if enabled
        if (this.showCoordinates) {
            this.updateCoordinatesDisplay();
        }

        // Update Enemies (Lokito/DNB)
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.isInitialized && enemy.health <= 0) {
                enemy.cleanup();
                this.enemies.splice(i, 1);
            } else if (enemy.isInitialized) {
                enemy.update(deltaTime);
            } else {
                // Enemy might still be loading, do nothing
            }
        }
        
        // Update crates
        for (let i = this.crates.length - 1; i >= 0; i--) {
            const crate = this.crates[i];
            if (crate.isInitialized) {
                crate.update(deltaTime);
            }
        }

        // Periodic Enemy Spawning logic - only spawn during night and not during transition
        const currentTime = this.clock.elapsedTime * 1000;
        if (!this.isDaytime && !this.isSurvivalTransitioning && 
            currentTime - this.lastSpawnTime > this.spawnInterval && 
            this.enemies.length < this.maxEnemies) {
            this.spawnEnemy();
            this.lastSpawnTime = currentTime;
        }

        // Use direct renderer instead of composer
        this.renderer.render(this.scene, this.camera);
        
        // Removed HUD rendering - pistol is now updated in the scene directly
    }

    spawnInitialEnemies(count) {
        console.log(`Spawning ${count} initial enemies (Lokito/DNB)...`);
        for (let i = 0; i < count; i++) {
            this.spawnEnemy();
        }
    }

    spawnEnemy() {
        if (!this.physicsWorld || !this.playerController || !this.playerController.player) {
            console.warn("Cannot spawn enemy: Physics world or player controller not ready.");
            return;
        }

        if (this.enemies.length >= this.maxEnemies) {
            return;
        }

        // Choose between two fixed spawn positions
        const spawnPoints = [
            new THREE.Vector3(11.74, -1.5, -13.19),  // First spawn point
            new THREE.Vector3(-23.19, -1.50, -13.62) // Second spawn point
        ];
        
        // Randomly select one of the spawn points
        const spawnPosition = spawnPoints[Math.floor(Math.random() * spawnPoints.length)].clone();
        
        // Randomly choose enemy type
        let enemyInstance;
        
        // Check if player target is valid
        if (!this.playerController.player || !this.playerController.player.mesh) {
            console.error("Cannot spawn enemy: Player target is not valid!");
            return;
        }
        
        console.log("Player target for enemies:", this.playerController.player);
        
        // 50% chance for each enemy type
        if (Math.random() < 0.5) {
            // Create Lokito (ghost) - higher spawn point for floating ghost
            enemyInstance = new Lokito(this.scene, this.physicsWorld);
            spawnPosition.y += 1.0; // Spawn ghost slightly higher
            console.log(`Spawn initiated for Ghost Lokito #${this.enemies.length + 1}. Position: ${spawnPosition.x.toFixed(1)}, ${spawnPosition.y.toFixed(1)}, ${spawnPosition.z.toFixed(1)}`);
        } else {
            // Create DNB (zombie)
            enemyInstance = new DNB(this.scene, this.physicsWorld);
            console.log(`Spawn initiated for DNB #${this.enemies.length + 1}. Position: ${spawnPosition.x.toFixed(1)}, ${spawnPosition.y.toFixed(1)}, ${spawnPosition.z.toFixed(1)}`);
        }
        
        this.enemies.push(enemyInstance);

        enemyInstance.initialize(spawnPosition, this.playerController.player, this.playerController)
            .then(() => {
                // Initialization successful
                console.log(`Enemy initialized with target: ${enemyInstance.target ? 'YES' : 'NO'}`);
                
                // Validate target was properly set
                if (!enemyInstance.target) {
                    console.warn("Enemy initialized without a valid target!");
                    // Try to set it again
                    enemyInstance.target = this.playerController.player;
                }
            })
            .catch(error => {
                console.error("Failed to initialize enemy:", error);
                const index = this.enemies.indexOf(enemyInstance);
                if (index > -1) {
                    this.enemies.splice(index, 1);
                }
            });
    }

    createNightEnvironment() {
        // Create all night environment objects (moon, stars, blue lighting)
        
        // Add lights - Modified for Nighttime
        const ambientLight = new THREE.AmbientLight(0x404060, 0.3); // Dim, cool ambient light
        this.scene.add(ambientLight);
        this.nightObjects.push(ambientLight);

        // Add Moon Light (Directional Light)
        const moonLight = new THREE.DirectionalLight(0xDFE9FF, 1.2); // Brighter blue-white moonlight
        moonLight.position.set(50, 100, 30); // High up, angled slightly
        moonLight.castShadow = true;
        // Configure shadow map for better quality
        moonLight.shadow.mapSize.width = 2048;
        moonLight.shadow.mapSize.height = 2048;
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 500;
        moonLight.shadow.camera.left = -100; 
        moonLight.shadow.camera.right = 100;
        moonLight.shadow.camera.top = 100;
        moonLight.shadow.camera.bottom = -100;
        this.scene.add(moonLight);
        this.nightObjects.push(moonLight);
        
        // Add a secondary, softer fill light for better illumination
        const moonFillLight = new THREE.DirectionalLight(0x8897BF, 0.5); // Softer bluish fill light
        moonFillLight.position.set(-30, 50, -20); // Coming from opposite direction
        moonFillLight.castShadow = false; // No shadows from fill light
        this.scene.add(moonFillLight);
        this.nightObjects.push(moonFillLight);

        // Create a textured moon using NASA data
        const moonGeometry = new THREE.SphereGeometry(80, 32, 32);
        
        // Load NASA moon textures from the original source URLs
        const textureLoader = new THREE.TextureLoader();
        const moonTexture = textureLoader.load('https://s3-us-west-2.amazonaws.com/s.cdpn.io/17271/lroc_color_poles_1k.jpg');
        const moonBumpMap = textureLoader.load('https://s3-us-west-2.amazonaws.com/s.cdpn.io/17271/ldem_3_8bit.jpg');
        
        const moonMaterial = new THREE.MeshPhongMaterial({
            map: moonTexture,
            bumpMap: moonBumpMap,
            bumpScale: 0.04,
            shininess: 0,
            fog: false
        });
        
        const moon = new THREE.Mesh(moonGeometry, moonMaterial);
        // Position far in the distance and higher in the sky
        moon.position.set(0, 300, -800);
        
        // Set initial rotation to match the texture
        moon.rotation.x = 3.1415 * 0.02;
        moon.rotation.y = 3.1415 * 1.54;
        
        this.scene.add(moon);
        this.moon = moon; // Store reference
        this.nightObjects.push(moon);

        // Create enhanced stars with different sizes and colors
        const starCount = 3000;
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = [];
        const starColors = [];

        // Moon position to create a clearing around
        const moonPos = new THREE.Vector3(0, 300, -800);
        const moonClearingRadius = 120; // Area around moon with fewer stars
        const moonClearingRadiusSq = moonClearingRadius * moonClearingRadius;

        let starsAdded = 0;
        let attempts = 0;
        const maxAttempts = starCount * 2; // Prevent infinite loop

        while (starsAdded < starCount && attempts < maxAttempts) {
            attempts++;
            
            // Create random positions on a sphere
            const radius = 900; // Increased radius to ensure stars are very far away
            const phi = Math.random() * Math.PI * 2;
            
            // Use modified distribution to place fewer stars near the horizon
            // Horizon corresponds to theta near PI/2 (equator of the sphere)
            // This biases distribution toward the poles (zenith and nadir)
            let theta;
            const distribution = Math.random();
            if (distribution < 0.7) {
                // 70% of stars with bias away from equator
                // Use arcsin distribution to concentrate more stars at poles
                theta = Math.acos(Math.random() * 2 - 1);
            } else {
                // 30% of stars with reduced probability near equator
                theta = Math.random() * Math.PI;
                // Skip stars near the equator (horizon) with high probability
                if (Math.abs(theta - Math.PI/2) < Math.PI/6 && Math.random() < 0.8) {
                    continue;
                }
            }
            
            const x = radius * Math.sin(theta) * Math.cos(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(theta);
            
            // Check distance from moon
            const distSq = Math.pow(x - moonPos.x, 2) + 
                           Math.pow(y - moonPos.y, 2) + 
                           Math.pow(z - moonPos.z, 2);
            
            // Skip stars that are too close to the moon, or add with reduced probability
            if (distSq < moonClearingRadiusSq) {
                // Only add 1 in 15 stars inside the clearing radius
                if (Math.random() < 0.067) { // ~1/15 chance
                    // Add the star but make it dimmer
                    starPositions.push(x, y, z);
                    // Dimmer star near moon
                    starColors.push(0.5, 0.5, 0.6);
                    starsAdded++;
                }
                continue;
            }
            
            // Add regular star position
            starPositions.push(x, y, z);
            starsAdded++;
            
            // Vary star colors slightly (white to blue-white to yellow-white)
            const colorChoice = Math.random();
            if (colorChoice > 0.8) {
                // Blue-white stars
                starColors.push(0.8, 0.9, 1.0);
            } else if (colorChoice > 0.6) {
                // Yellow-white stars
                starColors.push(1.0, 0.9, 0.7);
            } else {
                // White stars
                starColors.push(1.0, 1.0, 1.0);
            }
        }
        
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
        
        // Use simple PointsMaterial with increased size and opacity
        const starMaterial = new THREE.PointsMaterial({
            size: 1.5,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.NormalBlending,
            depthWrite: true,
            depthTest: true,
            fog: false
        });
        
        const stars = new THREE.Points(starGeometry, starMaterial);
        
        // Add stars to scene but set them to not interact with other objects
        stars.renderOrder = -2000;
        stars.frustumCulled = true;
        this.scene.add(stars);
        
        // Store reference for later use
        this.stars = stars;
        this.nightObjects.push(stars);
    }
    
    createDayEnvironment() {
        // Create day environment with bright sun and blue sky
        
        // Day ambient light - brighter and warmer than night
        const dayAmbient = new THREE.AmbientLight(0x90A0FF, 0.8);
        this.scene.add(dayAmbient);
        this.dayObjects.push(dayAmbient);
        
        // Main sun directional light
        const sunLight = new THREE.DirectionalLight(0xFFFAF0, 1.5);
        sunLight.position.set(100, 200, 100);
        sunLight.castShadow = true;
        
        // Configure shadow quality
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        
        this.scene.add(sunLight);
        this.dayObjects.push(sunLight);
        
        // Secondary fill light from opposite direction
        const dayFill = new THREE.DirectionalLight(0xFFFDF5, 0.6);
        dayFill.position.set(-50, 50, -50);
        dayFill.castShadow = false;
        this.scene.add(dayFill);
        this.dayObjects.push(dayFill);
        
        // Create sun object
        const sunGeometry = new THREE.SphereGeometry(60, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFAA,
            fog: false,
            transparent: true,
            opacity: 1.0
        });
        
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.position.set(300, 500, 300);
        this.scene.add(sun);
        this.sun = sun;
        this.dayObjects.push(sun);
        
        // Create sun glow/halo
        const sunGlowGeometry = new THREE.SphereGeometry(90, 32, 32);
        const sunGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFF77,
            transparent: true,
            opacity: 0.3,
            fog: false,
            side: THREE.BackSide
        });
        
        const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
        sun.add(sunGlow);
        
        // Initially hide all day objects
        this.dayObjects.forEach(obj => obj.visible = false);
    }
    
    setEnvironment(isDaytime) {
        this.isDaytime = isDaytime;
        
        // Reset survival timer on mode change
        this.survivalTimer = 0;
        this.isSurvivalTransitioning = false;
        
        // Switch music based on time of day
        if (isDaytime) {
            // Immediately destroy all enemies when entering day mode
            this.destroyAllEnemies();
            
            // Switch to day music
            if (this.dayMusicBuffer) {
                console.log("Switching to day music");
                this.audioManager.playLoop(this.dayMusicBuffer);
            } else {
                // Try to load it if not already loaded
                this.audioManager.loadSound(this.dayMusicPath).then(buffer => {
                    if (buffer) {
                        this.dayMusicBuffer = buffer;
                        this.audioManager.playLoop(buffer);
                    }
                });
            }
            
            // Bright blue sky for day
            this.scene.background = new THREE.Color(0x87CEEB);
            this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.01);
            
            // Show day objects, hide night objects
            this.dayObjects.forEach(obj => obj.visible = true);
            this.nightObjects.forEach(obj => obj.visible = false);
            
            // During day, no new enemies spawn
            this.maxEnemies = 0;
            
            // Reset flag for crate spawning
            this.hasSpawnedCrates = false;
            
            console.log("Day mode activated - No enemies will spawn");
        } else {
            // Switch to night music
            if (this.nightMusicBuffer) {
                console.log("Switching to night music");
                this.audioManager.playLoop(this.nightMusicBuffer);
            } else {
                // Try to load it if not already loaded
                this.loadNightMusic();
            }
            
            // Cleanup any crates from previous day
            this.cleanupAllCrates();
            
            // Dark blue/black for night
            this.scene.background = new THREE.Color(0x0A0A1A);
            this.scene.fog = new THREE.FogExp2(0x0A0A1A, 0.015);
            
            // Show night objects, hide day objects
            this.dayObjects.forEach(obj => obj.visible = false);
            this.nightObjects.forEach(obj => obj.visible = true);
            
            // Reset enemy spawning for night
            this.maxEnemies = 10;
            
            // Spawn initial enemies at night start
            this.spawnInitialEnemies(5);
            
            console.log("Night mode activated - Enemies will spawn");
        }
    }
    
    toggleDayNight() {
        // If switching to day, destroy all enemies immediately
        if (!this.isDaytime) {
            console.log("Manual day toggle: Destroying all enemies");
            this.setEnvironment(true);
        } else {
            // Switching to night mode, just do it immediately
            this.setEnvironment(false);
        }
    }

    // Add a new method to immediately destroy all enemies with a dramatic effect
    destroyAllEnemies() {
        console.log(`Destroying all enemies: ${this.enemies.length} active enemies`);
        
        if (this.enemies.length === 0 && (!this.fadingEnemies || this.fadingEnemies.length === 0)) {
            console.log("No enemies to destroy");
            return;
        }
        
        // Create a dramatic flash of light when enemies vanish
        this.createDayLightFlash();
        
        // Apply a dramatic disappearing effect to all enemies
        this.enemies.forEach(enemy => {
            if (enemy && enemy.isInitialized && enemy.mesh) {
                // Create particle burst effect at enemy location
                this.createVanishingEffect(enemy.mesh.position);
                
                // Cleanup the enemy
                enemy.cleanup();
            }
        });
        
        // Also clean up any enemies that might be in the fading process
        if (this.fadingEnemies && this.fadingEnemies.length > 0) {
            this.fadingEnemies.forEach(enemy => {
                if (enemy && enemy.isInitialized && enemy.mesh) {
                    // Create particle burst effect at enemy location
                    this.createVanishingEffect(enemy.mesh.position);
                    
                    // Cleanup the enemy
                    enemy.cleanup();
                }
            });
            this.fadingEnemies = [];
        }
        
        // Clear the enemies array
        this.enemies = [];
        console.log("All enemies destroyed with dramatic effect");
    }
    
    // Create a bright flash of light when enemies vanish
    createDayLightFlash() {
        // Create a full-screen white flash overlay
        const flashOverlay = document.createElement('div');
        flashOverlay.style.position = 'fixed';
        flashOverlay.style.top = '0';
        flashOverlay.style.left = '0';
        flashOverlay.style.width = '100%';
        flashOverlay.style.height = '100%';
        flashOverlay.style.backgroundColor = 'white';
        flashOverlay.style.opacity = '0.8';
        flashOverlay.style.zIndex = '1000';
        flashOverlay.style.pointerEvents = 'none';
        flashOverlay.style.transition = 'opacity 0.6s ease-out';
        
        document.body.appendChild(flashOverlay);
        
        // Fade out the flash effect
        setTimeout(() => {
            flashOverlay.style.opacity = '0';
            // Remove the element after the transition completes
            setTimeout(() => {
                if (flashOverlay.parentNode) {
                    flashOverlay.parentNode.removeChild(flashOverlay);
                }
            }, 700);
        }, 100);
    }
    
    // Create a particle burst effect at the enemy's position when they vanish
    createVanishingEffect(position) {
        // Create a burst of particles
        const particleCount = 20;
        const particles = [];
        
        // Create particle geometry and material
        const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFF00,
            transparent: true,
            opacity: 0.8
        });
        
        // Create and position particles
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
            particle.position.copy(position);
            
            // Randomize initial velocity in all directions
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() * 5) + 3,
                (Math.random() - 0.5) * 10
            );
            
            this.scene.add(particle);
            particles.push({
                mesh: particle,
                velocity: velocity,
                life: 1.0,
                startTime: this.clock.getElapsedTime()
            });
        }
        
        // Create a clean-up function for these particles
        const cleanupParticles = () => {
            const currentTime = this.clock.getElapsedTime();
            let allDone = true;
            
            particles.forEach(p => {
                const elapsed = currentTime - p.startTime;
                if (elapsed < p.life) {
                    allDone = false;
                    // Update position
                    p.mesh.position.add(p.velocity.clone().multiplyScalar(0.016)); // Assume 60fps
                    
                    // Apply "gravity"
                    p.velocity.y -= 0.2;
                    
                    // Fade out
                    const opacity = 1.0 - (elapsed / p.life);
                    p.mesh.material.opacity = opacity;
                } else if (p.mesh.parent) {
                    // Remove expired particles
                    this.scene.remove(p.mesh);
                    p.mesh.material.dispose();
                    p.mesh.geometry.dispose();
                }
            });
            
            if (!allDone) {
                requestAnimationFrame(cleanupParticles);
            }
        };
        
        // Start particle animation
        cleanupParticles();
    }

    handleKeyDown(event) {
        // Check if 'V' key is pressed (changed from 'C' to avoid conflict with crouch)
        if (event.key.toLowerCase() === 'v' && this.playerController && this.playerController.player) {
            this.showCoordinates = !this.showCoordinates;
            
            if (this.showCoordinates) {
                // Create or show coordinates display
                this.createCoordinatesDisplay();
            } else {
                // Hide coordinates display
                this.hideCoordinatesDisplay();
            }
        }
        
        // Check if 'O' key is pressed to toggle rain (changed from 'R' to avoid reload conflict)
        if (event.key.toLowerCase() === 'o') {
            console.log("O key pressed to toggle rain");
            this.toggleRainManually();
        }
    }
    
    createCoordinatesDisplay() {
        // Remove any existing coordinate message
        this.hideCoordinatesDisplay();
        
        // Create new message element
        this.coordinatesElement = document.createElement('div');
        this.coordinatesElement.id = 'coordinates-message';
        this.coordinatesElement.style.position = 'absolute';
        this.coordinatesElement.style.bottom = '20px';
        this.coordinatesElement.style.left = '20px';
        this.coordinatesElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.coordinatesElement.style.color = 'white';
        this.coordinatesElement.style.padding = '10px';
        this.coordinatesElement.style.borderRadius = '5px';
        this.coordinatesElement.style.fontFamily = 'Arial, sans-serif';
        this.coordinatesElement.style.fontSize = '16px';
        this.coordinatesElement.style.zIndex = '1000';
        this.coordinatesElement.style.pointerEvents = 'none';
        
        // Add to document
        document.body.appendChild(this.coordinatesElement);
        
        // Update coordinates immediately
        this.updateCoordinatesDisplay();
    }
    
    hideCoordinatesDisplay() {
        if (this.coordinatesElement && this.coordinatesElement.parentNode) {
            this.coordinatesElement.parentNode.removeChild(this.coordinatesElement);
            this.coordinatesElement = null;
        }
    }
    
    updateCoordinatesDisplay() {
        if (this.showCoordinates && this.coordinatesElement && this.playerController && this.playerController.player) {
            const playerPos = this.playerController.player.mesh.position;
            this.coordinatesElement.textContent = `Player Position: X: ${playerPos.x.toFixed(2)}, Y: ${playerPos.y.toFixed(2)}, Z: ${playerPos.z.toFixed(2)}`;
        }
    }

    createTimerDisplay() {
        // Create timer UI element
        this.timerElement = document.createElement('div');
        this.timerElement.style.position = 'absolute';
        this.timerElement.style.top = '20px';
        this.timerElement.style.left = '50%';
        this.timerElement.style.transform = 'translateX(-50%)';
        this.timerElement.style.color = '#FF0000';
        this.timerElement.style.fontFamily = '"Creepster", "Chiller", cursive';
        this.timerElement.style.fontSize = '28px';
        this.timerElement.style.textShadow = '2px 2px 4px #000000, 0 0 10px #FF0000, 0 0 20px #800000';
        this.timerElement.style.letterSpacing = '2px';
        this.timerElement.style.zIndex = '1000';
        this.timerElement.textContent = 'NIGHT MODE - SURVIVE: 2:00';
        this.timerElement.style.display = 'none'; // Initially hidden
        document.body.appendChild(this.timerElement);
        
        // Create days survived counter
        this.daysSurvivedElement = document.createElement('div');
        this.daysSurvivedElement.style.position = 'absolute';
        this.daysSurvivedElement.style.bottom = '50px'; // Position above the score counter (was 20px)
        this.daysSurvivedElement.style.left = '20px';
        this.daysSurvivedElement.style.color = '#00FF00';
        this.daysSurvivedElement.style.fontFamily = '"Creepster", "Chiller", cursive';
        this.daysSurvivedElement.style.fontSize = '24px';
        this.daysSurvivedElement.style.textShadow = '2px 2px 4px #000000, 0 0 10px #00FF00, 0 0 20px #008000';
        this.daysSurvivedElement.style.letterSpacing = '2px';
        this.daysSurvivedElement.style.zIndex = '1000';
        this.daysSurvivedElement.textContent = 'DAY 1';
        this.daysSurvivedElement.style.display = 'none'; // Initially hidden
        document.body.appendChild(this.daysSurvivedElement);
        
        // Create score counter
        this.scoreElement = document.createElement('div');
        this.scoreElement.style.position = 'absolute';
        this.scoreElement.style.bottom = '20px'; // Position below the day counter (was 50px)
        this.scoreElement.style.left = '20px';
        this.scoreElement.style.color = '#FFD700'; // Yellow color
        this.scoreElement.style.fontFamily = '"Creepster", "Chiller", cursive';
        this.scoreElement.style.fontSize = '24px';
        this.scoreElement.style.textShadow = '2px 2px 4px #000000, 0 0 10px #FFD700, 0 0 20px #B8860B';
        this.scoreElement.style.letterSpacing = '2px';
        this.scoreElement.style.zIndex = '1000';
        this.scoreElement.textContent = 'SCORE: 0';
        this.scoreElement.style.display = 'none'; // Initially hidden
        document.body.appendChild(this.scoreElement);
    }

    updateTimerDisplay() {
        if (!this.timerElement) return;
        
        const timeLeft = this.isDaytime ? 
            this.dayDuration - this.survivalTimer : 
            this.nightDuration - this.survivalTimer;
            
        const minutes = Math.floor(timeLeft / 60);
        const seconds = Math.floor(timeLeft % 60);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        const modeText = this.isDaytime ? 'DAY MODE - RELAX' : 'NIGHT MODE - SURVIVE';
        this.timerElement.textContent = `${modeText}: ${timeString}`;
        
        // Change color based on mode
        if (this.isDaytime) {
            this.timerElement.style.color = '#FFD700';
            this.timerElement.style.textShadow = '2px 2px 4px #000000, 0 0 10px #FFD700, 0 0 20px #B8860B';
        } else {
            this.timerElement.style.color = '#FF0000';
            this.timerElement.style.textShadow = '2px 2px 4px #000000, 0 0 10px #FF0000, 0 0 20px #800000';
        }
        
        // Always display days survived
        if (this.daysSurvivedElement) {
            this.daysSurvivedElement.textContent = `DAY ${this.daysSurvived}`;
        }
    }

    startEnemyFadeOut() {
        if (this.enemies.length === 0) return;
        
        console.log("Starting enemy fade out transition");
        this.isSurvivalTransitioning = true;
        this.enemyFadeStartTime = this.clock.elapsedTime;
        
        // Store current enemies for fading
        this.fadingEnemies = [...this.enemies];
        
        // Remove enemies from active array so they're not updated normally
        this.enemies = [];
    }
    
    updateEnemyFade(deltaTime) {
        if (!this.isSurvivalTransitioning) return;
        
        const currentTime = this.clock.elapsedTime;
        const fadeProgress = (currentTime - this.enemyFadeStartTime) / this.enemyFadeDuration;
        
        if (fadeProgress >= 1.0) {
            // Transition complete, cleanup all fading enemies
            this.fadingEnemies.forEach(enemy => {
                enemy.cleanup();
            });
            this.fadingEnemies = [];
            this.isSurvivalTransitioning = false;
            
            // Increment the days survived counter when transitioning to day
            this.daysSurvived++;
            
            // Switch to day mode
            this.setEnvironment(true);
            return;
        }
        
        // Update opacity of all fading enemies
        for (const enemy of this.fadingEnemies) {
            if (!enemy.mesh) continue;
            
            const opacity = 1.0 - fadeProgress;
            
            enemy.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            material.transparent = true;
                            material.opacity = opacity;
                        });
                    } else {
                        child.material.transparent = true;
                        child.material.opacity = opacity;
                    }
                }
            });
        }
    }

    loadNightMusic() {
        this.audioManager.loadSound(this.nightMusicPath).then(buffer => {
            if (buffer) { 
                this.nightMusicBuffer = buffer;
                this.audioManager.musicBuffer = buffer;
                // Don't play the music immediately, just store the buffer
                // playLoop will be called when actually needed
            }
        });
    }
    
    preloadDayMusic() {
        this.audioManager.loadSound(this.dayMusicPath).then(buffer => {
            if (buffer) {
                this.dayMusicBuffer = buffer;
                console.log("Day music preloaded");
            }
        });
    }

    // Add crate spawning methods
    spawnCrates() {
        console.log("Spawning crates for daytime");
        
        // 50% chance to spawn 2-3 crates, otherwise spawn 1 crate
        const spawnMultiple = Math.random() < 0.5;
        const crateCount = spawnMultiple ? Math.floor(Math.random() * 2) + 2 : 1;
        console.log(`Spawning ${crateCount} crates`);
        
        // Make a copy of the positions to shuffle
        const positions = [...this.crateSpawnPositions];
        
        // Fisher-Yates shuffle algorithm to randomize positions
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        // Spawn the crates at the first crateCount positions
        for (let i = 0; i < crateCount; i++) {
            this.spawnCrate(positions[i]);
        }
    }
    
    spawnCrate(position) {
        if (!this.physicsWorld) {
            console.warn("Cannot spawn crate: Physics world not ready.");
            return;
        }
        
        console.log(`Spawning crate at position: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
        
        // Create a new crate
        const crate = new Crate(this.scene, this.physicsWorld);
        crate.initialize(position);
        
        // Add to crates array
        this.crates.push(crate);
        
        // Play drop sound if available
        // This can be implemented later
    }
    
    cleanupAllCrates() {
        console.log("Cleaning up all crates");
        
        // Cleanup each crate
        for (const crate of this.crates) {
            if (crate.isInitialized) {
                crate.cleanup();
            }
        }
        
        // Clear the array
        this.crates = [];
    }

    preloadTextures() {
        console.log("Preloading textures...");
        const textureLoader = new THREE.TextureLoader();
        
        // Preload crate textures
        const texturePaths = [
            'assets/textures/wooden_crate_diffuse.jpg',
            'assets/textures/wooden_crate_normal.jpg',
            'assets/textures/wooden_crate_roughness.jpg',
            'assets/textures/medikit.png'
        ];
        
        texturePaths.forEach(path => {
            textureLoader.load(path, 
                // Success callback
                (texture) => {
                    console.log(`Texture loaded: ${path}`);
                },
                // Progress callback
                undefined,
                // Error callback
                (err) => {
                    console.warn(`Error loading texture ${path}: ${err}`);
                    
                    // Create and save placeholder textures if they don't exist
                    if (path.includes('wooden_crate_diffuse')) {
                        this.createPlaceholderWoodTexture();
                    } else if (path.includes('medikit')) {
                        this.createPlaceholderMedikitTexture();
                    }
                }
            );
        });
    }
    
    createPlaceholderWoodTexture() {
        console.log("Creating placeholder wood textures...");
        
        // Create brown wooden texture canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Fill with brown color
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, 0, 256, 256);
        
        // Add wood grain pattern
        ctx.strokeStyle = '#704214';
        ctx.lineWidth = 4;
        for (let i = 0; i < 20; i++) {
            const y = i * 15;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(
                80, y + (Math.random() * 10 - 5),
                160, y + (Math.random() * 10 - 5),
                256, y + (Math.random() * 10 - 5)
            );
            ctx.stroke();
        }
        
        // Save the texture
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create download link for debugging
        const dataUrl = canvas.toDataURL('image/jpeg');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'wooden_crate_diffuse.jpg';
        // Uncomment to trigger download: link.click();
        
        // Use this as fallback
        THREE.TextureLoader.prototype._cache = THREE.TextureLoader.prototype._cache || {};
        THREE.TextureLoader.prototype._cache['assets/textures/wooden_crate_diffuse.jpg'] = texture;
    }
    
    createPlaceholderMedikitTexture() {
        console.log("Creating placeholder medikit texture...");
        
        // Create medikit texture canvas
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Green background
        ctx.fillStyle = '#00AA00';
        ctx.fillRect(0, 0, 128, 128);
        
        // White cross
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(48, 24, 32, 80);  // Vertical bar
        ctx.fillRect(24, 48, 80, 32);  // Horizontal bar
        
        // Border
        ctx.strokeStyle = '#006600';
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, 112, 112);
        
        // Save the texture
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create download link for debugging
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'medikit.png';
        // Uncomment to trigger download: link.click();
        
        // Use this as fallback
        THREE.TextureLoader.prototype._cache = THREE.TextureLoader.prototype._cache || {};
        THREE.TextureLoader.prototype._cache['assets/textures/medikit.png'] = texture;
    }

    // Add method to update score
    addScore(points) {
        this.playerScore += points;
        
        // Update score display
        if (this.scoreElement) {
            this.scoreElement.textContent = `SCORE: ${this.playerScore}`;
            
            // Add a visual effect to show score increasing
            this.scoreElement.style.transform = 'scale(1.2)';
            this.scoreElement.style.transition = 'transform 0.2s ease-out';
            
            setTimeout(() => {
                this.scoreElement.style.transform = 'scale(1.0)';
            }, 200);
        }
        
        console.log(`Score increased by ${points} points. New score: ${this.playerScore}`);
    }

    // Call this method when the game is over to clean up
    gameOver() {
        // Stop any active rain
        if (this.isRaining) {
            this.stopRain();
        }
        
        // Other game over cleanup logic
        this.isRunning = false;
        
        // Show game over UI, etc.
    }

    // Create a start screen with a spooky play button
    createStartScreen() {
        // Create black overlay
        this.startScreenOverlay = document.createElement('div');
        this.startScreenOverlay.style.position = 'fixed';
        this.startScreenOverlay.style.top = '0';
        this.startScreenOverlay.style.left = '0';
        this.startScreenOverlay.style.width = '100%';
        this.startScreenOverlay.style.height = '100%';
        this.startScreenOverlay.style.backgroundColor = 'black';
        this.startScreenOverlay.style.zIndex = '2000';
        this.startScreenOverlay.style.display = 'flex';
        this.startScreenOverlay.style.flexDirection = 'column';
        this.startScreenOverlay.style.justifyContent = 'center';
        this.startScreenOverlay.style.alignItems = 'center';
        
        // Create game title
        const titleElement = document.createElement('h1');
        titleElement.textContent = 'RESIDENT MONG';
        titleElement.style.fontFamily = '"Creepster", "Chiller", cursive';
        titleElement.style.fontSize = '72px';
        titleElement.style.color = '#FF0000';
        titleElement.style.textShadow = '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 10px #FF0000, 0 0 20px #800000';
        titleElement.style.marginBottom = '0px';
        titleElement.style.letterSpacing = '2px';
        
        // We'll control the animation with JS now instead of CSS
        // Store reference to the title for animation
        this.titleElement = titleElement;
        
        // Create spooky subtitle
        const subtitleElement = document.createElement('h2');
        subtitleElement.textContent = 'A NIGHT OF TERROR AWAITS';
        subtitleElement.style.fontFamily = '"Creepster", "Chiller", cursive';
        subtitleElement.style.fontSize = '24px';
        subtitleElement.style.color = '#AAAAAA';
        subtitleElement.style.textShadow = '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 4px #000000';
        subtitleElement.style.marginBottom = '50px';
        subtitleElement.style.letterSpacing = '2px';
        
        // Store reference to subtitle for animation
        this.subtitleElement = subtitleElement;
        
        // Create play button
        const playButton = document.createElement('button');
        playButton.textContent = 'PLAY';
        playButton.style.fontFamily = '"Creepster", "Chiller", cursive';
        playButton.style.fontSize = '36px';
        playButton.style.backgroundColor = '#8B0000'; // Dark red
        playButton.style.color = 'white';
        playButton.style.border = '2px solid #FF0000';
        playButton.style.borderRadius = '5px';
        playButton.style.padding = '15px 50px';
        playButton.style.cursor = 'pointer';
        playButton.style.textShadow = '2px 2px 4px #000000';
        playButton.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.7)';
        playButton.style.letterSpacing = '3px';
        playButton.style.transition = 'all 0.2s ease-in-out';
        
        // Add hover effects
        playButton.onmouseover = () => {
            playButton.style.backgroundColor = '#FF0000';
            playButton.style.transform = 'scale(1.05)';
        };
        
        playButton.onmouseout = () => {
            playButton.style.backgroundColor = '#8B0000';
            playButton.style.transform = 'scale(1.0)';
        };
        
        // Add click handler to start the game
        playButton.onclick = this.startGame.bind(this);
        
        // Create controls button
        const controlsButton = document.createElement('button');
        controlsButton.textContent = 'CONTROLS';
        controlsButton.style.fontFamily = '"Creepster", "Chiller", cursive';
        controlsButton.style.fontSize = '24px';
        controlsButton.style.backgroundColor = '#0066CC'; // Blue
        controlsButton.style.color = 'white';
        controlsButton.style.border = '2px solid #0099FF';
        controlsButton.style.borderRadius = '5px';
        controlsButton.style.padding = '10px 40px';
        controlsButton.style.cursor = 'pointer';
        controlsButton.style.textShadow = '2px 2px 4px #000000';
        controlsButton.style.boxShadow = '0 0 10px rgba(0, 150, 255, 0.7)';
        controlsButton.style.letterSpacing = '2px';
        controlsButton.style.transition = 'all 0.2s ease-in-out';
        controlsButton.style.marginTop = '20px';
        
        // Add hover effects
        controlsButton.onmouseover = () => {
            controlsButton.style.backgroundColor = '#0099FF';
            controlsButton.style.transform = 'scale(1.05)';
        };
        
        controlsButton.onmouseout = () => {
            controlsButton.style.backgroundColor = '#0066CC';
            controlsButton.style.transform = 'scale(1.0)';
        };
        
        // Add click handler to show controls
        controlsButton.onclick = this.showControls.bind(this);
        
        // Create editor button
        const editorButton = document.createElement('button');
        editorButton.textContent = 'HITBOX EDITOR';
        editorButton.style.fontFamily = '"Creepster", "Chiller", cursive';
        editorButton.style.fontSize = '24px';
        editorButton.style.backgroundColor = '#008833'; // Green
        editorButton.style.color = 'white';
        editorButton.style.border = '2px solid #00CC44';
        editorButton.style.borderRadius = '5px';
        editorButton.style.padding = '10px 40px';
        editorButton.style.cursor = 'pointer';
        editorButton.style.textShadow = '2px 2px 4px #000000';
        editorButton.style.boxShadow = '0 0 10px rgba(0, 204, 68, 0.7)';
        editorButton.style.letterSpacing = '2px';
        editorButton.style.transition = 'all 0.2s ease-in-out';
        editorButton.style.marginTop = '20px';
        
        // Add hover effects
        editorButton.onmouseover = () => {
            editorButton.style.backgroundColor = '#00AA44';
            editorButton.style.transform = 'scale(1.05)';
        };
        
        editorButton.onmouseout = () => {
            editorButton.style.backgroundColor = '#008833';
            editorButton.style.transform = 'scale(1.0)';
        };
        
        // Add click handler to show editor
        editorButton.onclick = this.showHitboxEditor.bind(this);
        
        // Add elements to overlay
        this.startScreenOverlay.appendChild(titleElement);
        this.startScreenOverlay.appendChild(subtitleElement);
        this.startScreenOverlay.appendChild(playButton);
        this.startScreenOverlay.appendChild(controlsButton);
        this.startScreenOverlay.appendChild(editorButton);
        
        // Add overlay to document
        document.body.appendChild(this.startScreenOverlay);
        
        // Don't start the game automatically
        this.isRunning = false;
        
        // Set up audio analyzer for visualization
        this.setupStartScreenAudio();
    }
    
    // Set up audio analyzer and start playing the percussion loop
    setupStartScreenAudio() {
        // Create CSS for smooth transitions
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .title-text {
                transition: transform 0.1s ease-out, text-shadow 0.1s ease-out, color 0.1s ease-out;
            }
            .subtitle-text {
                transition: transform 0.15s ease-out, opacity 0.2s ease-out;
            }
            @keyframes beatPulse {
                0% { transform: scale(1.3); text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 30px #FF0000, 0 0 40px #FF0000; }
                50% { transform: scale(1.4); text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 40px #FF0000, 0 0 50px #FF0000; }
                100% { transform: scale(1.3); text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 30px #FF0000, 0 0 40px #FF0000; }
            }
            .beat-pulse {
                animation: beatPulse 0.2s ease-out;
            }
        `;
        document.head.appendChild(styleSheet);
        
        // Add transition classes
        if (this.titleElement) {
            this.titleElement.classList.add('title-text');
            this.titleElement.style.transformOrigin = 'center';
        }
        
        if (this.subtitleElement) {
            this.subtitleElement.classList.add('subtitle-text');
            this.subtitleElement.style.transformOrigin = 'center';
        }
        
        // Create the visualization callback with enhanced audio data
        const visualizeAudio = (audioData) => {
            if (!this.titleElement || !this.subtitleElement) return;
            
            // Extract audio data
            const { volume, bassVolume, beatDetected } = audioData;
            
            // Enhance the volume response for more visual impact
            // Use bass volume for more impactful visualization
            const enhancedVolume = Math.pow(volume, 1.5);
            const enhancedBass = Math.pow(bassVolume, 1.2); // Less aggressive scaling for bass
            
            // When a beat is detected, trigger special animation
            if (beatDetected) {
                // Add and remove beat class to trigger animation
                this.titleElement.classList.add('beat-pulse');
                
                // Remove the class after animation completes
                setTimeout(() => {
                    if (this.titleElement) {
                        this.titleElement.classList.remove('beat-pulse');
                    }
                }, 200); // Match the animation duration
            }
            
            // Calculate scale based primarily on bass (for smoother motion)
            const minScale = 1.0;
            const maxScale = 1.3;
            const scale = minScale + (enhancedBass * (maxScale - minScale));
            
            // Calculate glow intensity based on overall volume
            const minBlur = 5;
            const maxBlur = 25;
            const blur = minBlur + (enhancedVolume * (maxBlur - minBlur));
            
            // Calculate color intensity based on volume
            const minColor = 200; // Base red color (darker)
            const maxColor = 255; // Full bright red
            const redValue = Math.floor(minColor + (enhancedVolume * (maxColor - minColor)));
            
            // Apply effects to title (if not currently in beat animation)
            if (!this.titleElement.classList.contains('beat-pulse')) {
                this.titleElement.style.transform = `scale(${scale})`;
                this.titleElement.style.textShadow = `-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 ${blur}px rgb(${redValue}, 0, 0), 0 0 ${blur * 1.5}px #800000`;
            }
            
            // Apply effects to subtitle - make it pulse with the bass
            const subtitleScale = 1.0 + (enhancedBass * 0.15);
            const subtitleOpacity = 0.7 + (enhancedBass * 0.3); // Fade in/out slightly with bass
            this.subtitleElement.style.transform = `scale(${subtitleScale})`;
            this.subtitleElement.style.opacity = subtitleOpacity;
        };
        
        // Start playing the percussion loop
        const percussionLoop = 'assets/sounds/PM_EN_90_Percussion_FX_Loop_Race.wav';
        
        // Mute all other sounds except the percussion loop
        this.audioManager.muteAllExcept([percussionLoop]);
        
        // Set up audio analyzer
        this.audioManager.setupAnalyser(visualizeAudio);
        
        // Start playing the percussion loop
        this.audioManager.playWithAnalyzer(percussionLoop);
    }
    
    // Handle the play button click
    startGame() {
        // Get the percussion loop path
        const percussionLoop = 'assets/sounds/PM_EN_90_Percussion_FX_Loop_Race.wav';
        const clickSound = 'assets/sounds/CoinFlipTossRing_S08FO.689.wav';
        
        // Close controls panel if it's open
        if (this.controlsPanel && this.controlsPanel.style.display === 'flex') {
            document.body.removeChild(this.controlsPanel);
            this.controlsPanel = null;
        }
        
        // Stop the audio visualization
        if (this.audioManager) {
            this.audioManager.stopVisualization();
            
            // Explicitly stop the percussion loop
            this.audioManager.stopSound(percussionLoop);
            
            // First, temporarily add the click sound to allowed sounds
            this.audioManager.allowedSounds.push(clickSound);
            
            console.log("Playing coin flip sound...");
            
            // Play the coin flip sound once
            this.audioManager.playOneShot(clickSound).then(source => {
                console.log("Coin flip sound started playing:", !!source);
                
                // After a small delay, unmute all audio
                setTimeout(() => {
                    // Unmute all audio for gameplay
                    this.audioManager.unmute();
                    
                    // Explicitly start the night music for gameplay
                    if (this.nightMusicBuffer) {
                        this.audioManager.playLoop(this.nightMusicBuffer);
                    }
                }, 500); // Wait 500ms for the click sound to be heard
            }).catch(err => {
                console.error("Error playing coin flip sound:", err);
                // Fallback - unmute immediately if there was an error
                this.audioManager.unmute();
                if (this.nightMusicBuffer) {
                    this.audioManager.playLoop(this.nightMusicBuffer);
                }
            });
        }
        
        // Remove the start screen
        if (this.startScreenOverlay && this.startScreenOverlay.parentNode) {
            this.startScreenOverlay.parentNode.removeChild(this.startScreenOverlay);
            this.startScreenOverlay = null;
        }
        
        // Show UI elements
        if (this.timerElement) this.timerElement.style.display = 'block';
        if (this.daysSurvivedElement) this.daysSurvivedElement.style.display = 'block';
        if (this.scoreElement) this.scoreElement.style.display = 'block';
        if (this.crosshair) this.crosshair.style.display = 'block';
        
        // Enable weapon system after game starts
        if (this.weaponSystem) {
            console.log("GAME STARTING: Activating weapon system and ensuring pistol visibility");
            this.weaponSystem.setGameActive(true);
            
            // Force pistol visibility with a delay to ensure it's properly initialized
            setTimeout(() => {
                if (this.weaponSystem.pistol && this.weaponSystem.pistol.pistolMesh) {
                    console.log("Forcing pistol visibility after game start");
                    this.weaponSystem.pistol.pistolMesh.visible = true;
                    // Force update of pistol position
                    this.weaponSystem.pistol.pistolMesh.position.set(0.6, -0.5, -0.9);
                    this.weaponSystem.pistol.pistolMesh.rotation.set(0, Math.PI * 0.15, Math.PI * 0.05);
                } else {
                    console.warn("Pistol mesh not found after game start!");
                }
            }, 500);
        }
        
        // Reset the clock to ensure timer starts from zero
        this.clock.start();
        this.survivalTimer = 0;
        
        // Start the game
        this.start();
        
        // Lock controls for the player to start playing
        if (this.playerController) {
            this.playerController.lock();
        }
    }

    // Rain system methods
    createRainSystem() {
        // Create a container for the rain particles - using line streaks for heavier rain effect
        const rainCount = 3500; // Increased from 1500 to 3500 for denser rain
        
        // Create the geometry for line segments
        const rainGeometry = new THREE.BufferGeometry();
        
        // For each raindrop, we need two vertices (start and end point)
        const rainPositions = new Float32Array(rainCount * 6); // 2 points × 3 coordinates each
        const rainVelocities = new Float32Array(rainCount);
        
        // Set up initial positions
        const spread = 80; // Increased area where rain can fall
        const dropLength = 0.6; // Length of each raindrop streak
        
        for (let i = 0; i < rainCount; i++) {
            const i6 = i * 6; // Index for position array (6 values per drop: x,y,z start and x,y,z end)
            
            // Random position for the bottom point of the raindrop streak
            const x = (Math.random() * spread * 2) - spread;
            const y = Math.random() * 40 + 10; // Y (above the player)
            const z = (Math.random() * spread * 2) - spread;
            
            // Set the bottom vertex of the streak
            rainPositions[i6] = x;
            rainPositions[i6 + 1] = y;
            rainPositions[i6 + 2] = z;
            
            // Set the top vertex of the streak (slightly above and offset due to falling angle)
            rainPositions[i6 + 3] = x + 0.1; // Slight offset for falling angle
            rainPositions[i6 + 4] = y + dropLength; // Above the bottom point
            rainPositions[i6 + 5] = z;
            
            // Increased fall speed for each drop - much faster rain
            rainVelocities[i] = 0.3 + Math.random() * 0.5;
        }
        
        rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
        
        // Create material for rain streaks - more visible and elongated
        const rainMaterial = new THREE.LineBasicMaterial({
            color: 0x6699cc, // Slightly darker blue for heavier rain
            transparent: true,
            opacity: 0.7,
            fog: true
        });
        
        // Create lines instead of points
        this.rainSystem = new THREE.LineSegments(rainGeometry, rainMaterial);
        this.rainSystem.visible = false; // Initially hidden
        this.rainSystem.frustumCulled = false; // Fix typo from frustrumCulled to frustumCulled
        // Prevent rain from interfering with bullet raycasts
        this.rainSystem.renderOrder = -1; // Render behind most objects
        this.rainSystem.userData.ignoreRaycast = true; // Custom flag to mark as non-raycastable

        // Keep the rain on the default layer so it's visible
        // this.rainSystem.layers.set(2); // This was causing the visibility issue

        // Make sure camera can see all layers
        if (this.camera) {
            this.camera.layers.enableAll();
        }

        this.scene.add(this.rainSystem);
        
        // Store reference to positions and velocities for animation
        this.rainPositions = rainPositions;
        this.rainVelocities = rainVelocities;
        
        // Preload rain sound
        this.audioManager.loadSound(this.rainSoundPath).then(buffer => {
            if (buffer) {
                this.rainSoundBuffer = buffer;
                console.log("Rain sound preloaded");
            }
        });
        
        console.log("Heavy rain system created using streaks");
    }
    
    updateRain(deltaTime) {
        if (!this.rainSystem) return;
        
        // Check if we should start/stop rain
        this.checkRainStatus(deltaTime);
        
        // If it's not raining, don't update particles
        if (!this.isRaining) return;
        
        // Update rain streak positions
        const positions = this.rainSystem.geometry.attributes.position.array;
        const playerPos = this.camera.position.clone();
        
        for (let i = 0; i < this.rainVelocities.length; i++) {
            const i6 = i * 6; // Each raindrop has 6 values (2 points × 3 coordinates)
            
            // Apply velocity to move the entire streak downward
            const moveAmount = this.rainVelocities[i] * 30 * deltaTime;
            
            // Move both points of the raindrop streak
            positions[i6 + 1] -= moveAmount; // Bottom point Y
            positions[i6 + 4] -= moveAmount; // Top point Y
            
            // Add slight horizontal drift for more realistic rain (wind effect)
            const windStrength = 0.5; // Subtle wind strength
            const windMove = windStrength * deltaTime;
            positions[i6] -= windMove; // Bottom point X
            positions[i6 + 3] -= windMove; // Top point X
            
            // If bottom point of rain drop goes below ground, reset the entire streak
            if (positions[i6 + 1] < -2) {
                // New random position around player
                const x = playerPos.x + (Math.random() * 120 - 60);
                const y = Math.random() * 40 + 20;
                const z = playerPos.z + (Math.random() * 120 - 60);
                const dropLength = 0.6;
                
                // Reset bottom point
                positions[i6] = x;
                positions[i6 + 1] = y;
                positions[i6 + 2] = z;
                
                // Reset top point
                positions[i6 + 3] = x + 0.1; // Slight angle
                positions[i6 + 4] = y + dropLength;
                positions[i6 + 5] = z;
            }
        }
        
        // Update the geometry
        this.rainSystem.geometry.attributes.position.needsUpdate = true;
    }
    
    checkRainStatus(deltaTime) {
        const currentTime = this.clock.elapsedTime * 1000;
        
        // Check if it's time to evaluate rain status
        if (!this.isRaining && currentTime - this.lastRainCheck > this.rainCheckInterval) {
            this.lastRainCheck = currentTime;
            
            // Random chance to start raining
            if (Math.random() < this.rainChance) {
                this.startRain();
                
                // Schedule rain to stop after random duration
                const rainDuration = this.rainDuration.min + Math.random() * (this.rainDuration.max - this.rainDuration.min);
                setTimeout(() => this.stopRain(), rainDuration);
            }
        }
    }
    
    startRain() {
        if (this.isRaining) return;
        
        console.log("Starting heavy rain");
        this.isRaining = true;
        
        // Show rain particles
        if (this.rainSystem) {
            console.log("Using existing rain system");
            this.rainSystem.visible = true;
        } else {
            console.log("No rain system found, creating new one");
            this.createRainSystem();
            if (this.rainSystem) {
                this.rainSystem.visible = true;
            } else {
                console.error("Failed to create rain system");
            }
        }
        
        // Create darker blue overlay for heavy rain effect
        const rainOverlay = document.createElement('div');
        rainOverlay.id = 'rain-overlay';
        rainOverlay.style.position = 'fixed';
        rainOverlay.style.top = '0';
        rainOverlay.style.left = '0';
        rainOverlay.style.width = '100%';
        rainOverlay.style.height = '100%';
        rainOverlay.style.backgroundColor = 'rgba(5, 20, 50, 0.25)'; // Darker, more intense overlay
        rainOverlay.style.pointerEvents = 'none';
        rainOverlay.style.zIndex = '1';
        rainOverlay.style.transition = 'opacity 1.5s ease-in';
        rainOverlay.style.opacity = '0';
        document.body.appendChild(rainOverlay);
        
        // Fade in the overlay
        setTimeout(() => {
            const overlay = document.getElementById('rain-overlay');
            if (overlay) overlay.style.opacity = '1';
        }, 50);
        
        // Play rain sound - use playOneShot for a one-time sound, repeat it more frequently for heavier rain
        this.playRainSound();
        
        // Schedule repeated rain sounds for continuous effect (more frequent for heavy rain)
        this.rainSoundInterval = setInterval(() => {
            this.playRainSound();
        }, 7000); // Play the sound every 7 seconds (reduced from 10 seconds)
    }
    
    // Helper method to play the rain sound
    playRainSound() {
        this.audioManager.playOneShot(this.rainSoundPath, { type: 'rain' }).then(source => {
            console.log("Playing rain sound");
        }).catch(err => {
            console.error("Error playing rain sound:", err);
        });
    }
    
    stopRain() {
        if (!this.isRaining) return;
        
        console.log("Stopping rain");
        this.isRaining = false;
        
        // Hide rain particles
        if (this.rainSystem) {
            this.rainSystem.visible = false;
        }
        
        // Fade out and remove the rain overlay
        const rainOverlay = document.getElementById('rain-overlay');
        if (rainOverlay) {
            rainOverlay.style.opacity = '0';
            setTimeout(() => {
                if (rainOverlay.parentNode) {
                    rainOverlay.parentNode.removeChild(rainOverlay);
                }
            }, 1500);
        }
        
        // Stop all rain sounds immediately
        this.audioManager.stopSoundsByType('rain');
        
        // Stop rain sound interval
        if (this.rainSoundInterval) {
            clearInterval(this.rainSoundInterval);
            this.rainSoundInterval = null;
        }
        
        // Reset last check time to add some delay before next possible rain
        this.lastRainCheck = this.clock.elapsedTime * 1000;
    }

    // Add a direct manual rain toggle method
    toggleRainManually() {
        console.log("Manual rain toggle requested");
        if (this.isRaining) {
            console.log("Rain is active, stopping rain manually");
            this.stopRain();
        } else {
            console.log("Rain is inactive, creating and starting rain manually");
            // Force create a new rain system
            if (this.rainSystem) {
                console.log("Removing existing rain system");
                this.scene.remove(this.rainSystem);
                this.rainSystem = null;
            }
            
            // Create a fresh rain system
            this.createRainSystem();
            console.log("Starting rain with newly created system");
            this.startRain();
        }
    }
    
    // Show the controls panel
    showControls() {
        // Play click sound
        const clickSound = 'assets/sounds/CoinFlipTossRing_S08FO.689.wav';
        if (this.audioManager) {
            this.audioManager.playOneShot(clickSound)
                .catch(error => console.error("Error playing click sound:", error));
        }
        
        // If controls panel already exists, toggle it
        if (this.controlsPanel) {
            if (this.controlsPanel.style.display === 'none') {
                this.controlsPanel.style.display = 'flex';
            } else {
                this.controlsPanel.style.display = 'none';
            }
            return;
        }
        
        // Create controls panel
        this.controlsPanel = document.createElement('div');
        this.controlsPanel.style.position = 'fixed';
        this.controlsPanel.style.top = '50%';
        this.controlsPanel.style.left = '50%';
        this.controlsPanel.style.transform = 'translate(-50%, -50%)';
        this.controlsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        this.controlsPanel.style.border = '2px solid #0099FF';
        this.controlsPanel.style.borderRadius = '10px';
        this.controlsPanel.style.padding = '30px';
        this.controlsPanel.style.zIndex = '3000';
        this.controlsPanel.style.display = 'flex';
        this.controlsPanel.style.flexDirection = 'column';
        this.controlsPanel.style.gap = '15px';
        this.controlsPanel.style.color = 'white';
        this.controlsPanel.style.fontFamily = 'Arial, sans-serif';
        this.controlsPanel.style.fontSize = '18px';
        this.controlsPanel.style.boxShadow = '0 0 20px rgba(0, 150, 255, 0.7)';
        this.controlsPanel.style.maxWidth = '500px';
        this.controlsPanel.style.maxHeight = '80vh';
        this.controlsPanel.style.overflowY = 'auto';
        
        // Add title
        const title = document.createElement('h2');
        title.textContent = 'GAME CONTROLS';
        title.style.textAlign = 'center';
        title.style.color = '#0099FF';
        title.style.fontFamily = '"Creepster", "Chiller", cursive';
        title.style.fontSize = '36px';
        title.style.margin = '0 0 20px 0';
        title.style.textShadow = '2px 2px 4px #000000';
        this.controlsPanel.appendChild(title);
        
        // Control mappings
        const controls = [
            { key: 'W, A, S, D', action: 'Movement' },
            { key: 'MOUSE', action: 'Look around' },
            { key: 'SPACE', action: 'Jump' },
            { key: 'LEFT SHIFT', action: 'Sprint' },
            { key: 'C', action: 'Crouch' },
            { key: 'T', action: 'Slide (while sprinting)' },
            { key: 'LEFT CLICK', action: 'Shoot' },
            { key: 'E', action: 'Interact with objects' },
            { key: 'Q', action: 'Use medikit' },
            { key: 'ESC', action: 'Pause game' }
        ];
        
        // Add controls to panel
        controls.forEach(control => {
            const controlRow = document.createElement('div');
            controlRow.style.display = 'flex';
            controlRow.style.justifyContent = 'space-between';
            controlRow.style.borderBottom = '1px solid #333';
            controlRow.style.paddingBottom = '10px';
            
            const keyElement = document.createElement('div');
            keyElement.textContent = control.key;
            keyElement.style.fontWeight = 'bold';
            keyElement.style.color = '#0099FF';
            keyElement.style.marginRight = '20px';
            keyElement.style.minWidth = '120px';
            keyElement.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
            
            const actionElement = document.createElement('div');
            actionElement.textContent = control.action;
            
            controlRow.appendChild(keyElement);
            controlRow.appendChild(actionElement);
            this.controlsPanel.appendChild(controlRow);
        });
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'CLOSE';
        closeButton.style.marginTop = '20px';
        closeButton.style.padding = '10px 20px';
        closeButton.style.backgroundColor = '#0066CC';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontFamily = '"Creepster", "Chiller", cursive';
        closeButton.style.fontSize = '20px';
        closeButton.style.alignSelf = 'center';
        closeButton.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
        
        closeButton.onmouseover = () => {
            closeButton.style.backgroundColor = '#0099FF';
        };
        
        closeButton.onmouseout = () => {
            closeButton.style.backgroundColor = '#0066CC';
        };
        
        closeButton.onclick = () => {
            document.body.removeChild(this.controlsPanel);
            this.controlsPanel = null;
            
            // Play click sound on close
            if (this.audioManager) {
                this.audioManager.playOneShot(clickSound)
                    .catch(error => console.error("Error playing click sound:", error));
            }
        };
        
        this.controlsPanel.appendChild(closeButton);
        
        // Add panel to document
        document.body.appendChild(this.controlsPanel);
    }

    // Show the hitbox editor interface
    showHitboxEditor() {
        // Play click sound
        const clickSound = 'assets/sounds/CoinFlipTossRing_S08FO.689.wav';
        if (this.audioManager) {
            this.audioManager.playOneShot(clickSound)
                .catch(error => console.error("Error playing click sound:", error));
                
            // Mute all background sounds when editor is open
            setTimeout(() => {
                // Mute all sounds
                this.audioManager.muteAll();
                
                // Specifically stop the startup music loops
                const percussionLoop = 'assets/sounds/PM_EN_90_Percussion_FX_Loop_Race.wav';
                this.audioManager.stopSound(percussionLoop);
                
                // Stop any music that might be playing
                this.audioManager.stopMusic();
                
                // Play hitbox editor music
                this.playHitboxEditorMusic();
            }, 300); // Short delay to allow click sound to play
        }
        
        // If editor panel already exists, toggle it
        if (this.editorPanel) {
            if (this.editorPanel.style.display === 'none') {
                this.editorPanel.style.display = 'flex';
                // Mute sounds when showing again
                if (this.audioManager) {
                    this.audioManager.muteAll();
                    // Also stop any music
                    this.audioManager.stopMusic();
                    
                    // Play hitbox editor music
                    this.playHitboxEditorMusic();
                }
            } else {
                this.editorPanel.style.display = 'none';
                // Unmute sounds when hiding
                if (this.audioManager) {
                    // Stop hitbox editor music
                    this.audioManager.stopMusic();
                    this.audioManager.unmute();
                    
                    // Restart the startup percussion loop
                    this.restartStartupMusic();
                }
            }
            return;
        }
        
        // Create editor panel
        this.editorPanel = document.createElement('div');
        this.editorPanel.style.position = 'fixed';
        this.editorPanel.style.top = '0';
        this.editorPanel.style.left = '0';
        this.editorPanel.style.width = '100%';
        this.editorPanel.style.height = '100%';
        this.editorPanel.style.backgroundColor = '#282828'; // Dark gray (Blender-like)
        this.editorPanel.style.zIndex = '3000';
        this.editorPanel.style.display = 'flex';
        this.editorPanel.style.flexDirection = 'column';
        this.editorPanel.style.color = 'white';
        this.editorPanel.style.fontFamily = 'Arial, sans-serif';
        
        // Create header with title and close button
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.padding = '10px 20px';
        header.style.backgroundColor = '#1A1A1A'; // Darker gray for header
        header.style.borderBottom = '1px solid #444';
        
        const title = document.createElement('h2');
        title.textContent = 'HITBOX EDITOR';
        title.style.margin = '0';
        title.style.color = '#00CC44'; // Green
        title.style.fontFamily = 'Arial, sans-serif';
        title.style.fontSize = '20px';
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.backgroundColor = '#444';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.width = '30px';
        closeButton.style.height = '30px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontSize = '16px';
        
        closeButton.onclick = () => {
            document.body.removeChild(this.editorPanel);
            this.editorPanel = null;
            
            // Play click sound on close
            if (this.audioManager) {
                this.audioManager.playOneShot(clickSound)
                    .catch(error => console.error("Error playing click sound:", error));
                
                // Unmute all background sounds when editor is closed
                setTimeout(() => {
                    // Stop hitbox editor music
                    this.audioManager.stopMusic();
                    
                    this.audioManager.unmute();
                    
                    // Restart the startup percussion loop
                    this.restartStartupMusic();
                }, 300); // Short delay to allow click sound to play
            }
        };
        
        header.appendChild(title);
        header.appendChild(closeButton);
        
        // Create main editor container (split into sidebar and viewport)
        const editorContainer = document.createElement('div');
        editorContainer.style.display = 'flex';
        editorContainer.style.flex = '1';
        editorContainer.style.overflow = 'hidden';
        
        // Sidebar for controls
        const sidebar = document.createElement('div');
        sidebar.style.width = '250px';
        sidebar.style.backgroundColor = '#333';
        sidebar.style.padding = '15px';
        sidebar.style.boxSizing = 'border-box';
        sidebar.style.overflowY = 'auto';
        
        // Create model selector
        const modelSelectContainer = document.createElement('div');
        modelSelectContainer.style.marginBottom = '20px';
        
        const modelLabel = document.createElement('label');
        modelLabel.textContent = 'Select Enemy Model:';
        modelLabel.style.display = 'block';
        modelLabel.style.marginBottom = '5px';
        modelLabel.style.color = '#CCC';
        
        const modelSelect = document.createElement('select');
        modelSelect.style.width = '100%';
        modelSelect.style.padding = '8px';
        modelSelect.style.backgroundColor = '#444';
        modelSelect.style.color = 'white';
        modelSelect.style.border = '1px solid #555';
        modelSelect.style.borderRadius = '4px';
        
        // Add enemy options to select - ONLY include the actual game enemies
        const enemyTypes = ['Lokito', 'DNB'];
        enemyTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.toLowerCase();
            option.textContent = type;
            modelSelect.appendChild(option);
        });
        
        modelSelectContainer.appendChild(modelLabel);
        modelSelectContainer.appendChild(modelSelect);
        
        // Create hitbox controls section
        const hitboxControlsSection = document.createElement('div');
        hitboxControlsSection.style.marginBottom = '20px';
        
        const hitboxTitle = document.createElement('h3');
        hitboxTitle.textContent = 'Hitbox Controls';
        hitboxTitle.style.color = '#00CC44'; // Green
        hitboxTitle.style.margin = '0 0 10px 0';
        hitboxTitle.style.fontSize = '16px';
        
        hitboxControlsSection.appendChild(hitboxTitle);
        
        // Create hitbox type selector
        const hitboxTypeContainer = document.createElement('div');
        hitboxTypeContainer.style.marginBottom = '15px';
        
        const hitboxLabel = document.createElement('label');
        hitboxLabel.textContent = 'Hitbox Type:';
        hitboxLabel.style.display = 'block';
        hitboxLabel.style.marginBottom = '5px';
        hitboxLabel.style.color = '#CCC';
        
        const hitboxSelect = document.createElement('select');
        hitboxSelect.id = 'hitbox-type-select';
        hitboxSelect.style.width = '100%';
        hitboxSelect.style.padding = '8px';
        hitboxSelect.style.backgroundColor = '#444';
        hitboxSelect.style.color = 'white';
        hitboxSelect.style.border = '1px solid #555';
        hitboxSelect.style.borderRadius = '4px';
        
        // Add hitbox type options
        const hitboxTypes = ['Default', 'Headshot', 'Weak Point', 'Armored'];
        hitboxTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.toLowerCase().replace(' ', '_');
            option.textContent = type;
            hitboxSelect.appendChild(option);
        });
        
        // Add change event to update the selected hitbox's type
        hitboxSelect.onchange = () => {
            if (this.selectedHitbox) {
                this.selectedHitbox.hitboxType = hitboxSelect.options[hitboxSelect.selectedIndex].textContent;
                this.updateHitboxTable();
            }
        };
        
        hitboxTypeContainer.appendChild(hitboxLabel);
        hitboxTypeContainer.appendChild(hitboxSelect);
        
        hitboxControlsSection.appendChild(hitboxTypeContainer);
        
        // Create hitbox shape selector
        const hitboxShapeContainer = document.createElement('div');
        hitboxShapeContainer.style.marginBottom = '15px';
        
        const hitboxShapeLabel = document.createElement('label');
        hitboxShapeLabel.textContent = 'Hitbox Shape:';
        hitboxShapeLabel.style.display = 'block';
        hitboxShapeLabel.style.marginBottom = '5px';
        hitboxShapeLabel.style.color = '#CCC';
        
        const hitboxShapeSelect = document.createElement('select');
        hitboxShapeSelect.id = 'hitbox-shape-select';
        hitboxShapeSelect.style.width = '100%';
        hitboxShapeSelect.style.padding = '8px';
        hitboxShapeSelect.style.backgroundColor = '#444';
        hitboxShapeSelect.style.color = 'white';
        hitboxShapeSelect.style.border = '1px solid #555';
        hitboxShapeSelect.style.borderRadius = '4px';
        
        // Add hitbox shape options
        const hitboxShapes = ['Box', 'Sphere', 'Cylinder'];
        hitboxShapes.forEach(shape => {
            const option = document.createElement('option');
            option.value = shape.toLowerCase();
            option.textContent = shape;
            hitboxShapeSelect.appendChild(option);
        });
        
        // Add change event to update the selected hitbox's shape
        hitboxShapeSelect.onchange = () => {
            if (this.selectedHitbox) {
                const selectedShape = hitboxShapeSelect.value;
                this.updateHitboxShape(this.selectedHitbox, selectedShape);
            }
        };
        
        hitboxShapeContainer.appendChild(hitboxShapeLabel);
        hitboxShapeContainer.appendChild(hitboxShapeSelect);
        
        hitboxControlsSection.appendChild(hitboxShapeContainer);
        
        // Create damage multiplier selector
        const hitboxDamageContainer = document.createElement('div');
        hitboxDamageContainer.style.marginBottom = '15px';
        
        const hitboxDamageLabel = document.createElement('label');
        hitboxDamageLabel.textContent = 'Damage Multiplier:';
        hitboxDamageLabel.style.display = 'block';
        hitboxDamageLabel.style.marginBottom = '5px';
        hitboxDamageLabel.style.color = '#CCC';
        
        const hitboxDamageSelect = document.createElement('select');
        hitboxDamageSelect.id = 'hitbox-damage-select';
        hitboxDamageSelect.style.width = '100%';
        hitboxDamageSelect.style.padding = '8px';
        hitboxDamageSelect.style.backgroundColor = '#444';
        hitboxDamageSelect.style.color = 'white';
        hitboxDamageSelect.style.border = '1px solid #555';
        hitboxDamageSelect.style.borderRadius = '4px';
        
        // Add damage multiplier options
        const damageMultipliers = ['1x', '1.5x', '2x', '5x'];
        damageMultipliers.forEach(multiplier => {
            const option = document.createElement('option');
            option.value = multiplier;
            option.textContent = multiplier;
            hitboxDamageSelect.appendChild(option);
        });
        
        // Add change event to update the selected hitbox's damage multiplier
        hitboxDamageSelect.onchange = () => {
            if (this.selectedHitbox) {
                this.selectedHitbox.damageMultiplier = hitboxDamageSelect.value;
                this.updateHitboxTable();
            }
        };
        
        hitboxDamageContainer.appendChild(hitboxDamageLabel);
        hitboxDamageContainer.appendChild(hitboxDamageSelect);
        
        hitboxControlsSection.appendChild(hitboxDamageContainer);
        
        // Create sliders for hitbox dimensions
        const createSlider = (name, min, max, value, step) => {
            const container = document.createElement('div');
            container.style.marginBottom = '15px';
            
            const label = document.createElement('label');
            label.textContent = `${name}:`;
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.style.color = '#CCC';
            
            const sliderContainer = document.createElement('div');
            sliderContainer.style.display = 'flex';
            sliderContainer.style.alignItems = 'center';
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = min;
            slider.max = max;
            slider.value = value;
            slider.step = step;
            slider.style.flex = '1';
            slider.style.marginRight = '10px';
            slider.style.accentColor = '#00CC44';
            
            // Add ID for easy selection
            slider.id = `hitbox-size-${name.toLowerCase()}`;
            
            const valueDisplay = document.createElement('span');
            valueDisplay.textContent = value;
            valueDisplay.style.minWidth = '40px';
            valueDisplay.style.textAlign = 'right';
            valueDisplay.id = `hitbox-size-${name.toLowerCase()}-display`;
            
            slider.oninput = () => {
                valueDisplay.textContent = slider.value;
                // Update hitbox dimensions in 3D view
                if (this.selectedHitbox && this.selectedHitbox.geometry) {
                    const value = parseFloat(slider.value);
                    
                    // Map slider name to scale property
                    if (name === 'Width') {
                        this.selectedHitbox.scale.x = value;
                    } else if (name === 'Height') {
                        this.selectedHitbox.scale.y = value;
                    } else if (name === 'Depth') {
                        this.selectedHitbox.scale.z = value;
                    }
                    
                    // Render scene immediately to show the change
                    if (this.editorRenderer && this.editorScene && this.editorCamera) {
                        this.editorRenderer.render(this.editorScene, this.editorCamera);
                    }
                    
                    // Update the hitbox table to reflect changes
                    this.updateHitboxTable();
                }
            };
            
            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(valueDisplay);
            
            container.appendChild(label);
            container.appendChild(sliderContainer);
            
            return container;
        };
        
        // Add dimension sliders
        hitboxControlsSection.appendChild(createSlider('Width', 0.1, 2, 1, 0.1));
        hitboxControlsSection.appendChild(createSlider('Height', 0.1, 2, 1, 0.1));
        hitboxControlsSection.appendChild(createSlider('Depth', 0.1, 2, 1, 0.1));
        
        // Add position controls (numeric inputs with arrow buttons)
        const createPositionControl = (name, defaultValue) => {
            const container = document.createElement('div');
            container.style.marginBottom = '10px';
            
            const label = document.createElement('label');
            label.textContent = `${name} Position:`;
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.style.color = '#CCC';
            
            const inputContainer = document.createElement('div');
            inputContainer.style.display = 'flex';
            inputContainer.style.alignItems = 'center';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.value = defaultValue;
            input.step = 0.1;
            input.style.width = '60px';
            input.style.padding = '5px';
            input.style.backgroundColor = '#444';
            input.style.color = 'white';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '4px';
            input.style.marginRight = '10px';
            
            // Add ID for easy selection
            input.id = `hitbox-position-${name.toLowerCase()}`;
            
            // Update hitbox position when input changes
            input.oninput = () => {
                if (this.selectedHitbox) {
                    const value = parseFloat(input.value) || 0;
                    const axis = name.toLowerCase(); // x, y, or z
                    this.selectedHitbox.position[axis] = value;
                    
                    // Render scene immediately to show the change
                    if (this.editorRenderer && this.editorScene && this.editorCamera) {
                        this.editorRenderer.render(this.editorScene, this.editorCamera);
                    }
                    
                    // Update the hitbox table to reflect changes
                    this.updateHitboxTable();
                }
            };
            
            // Arrow buttons
            const arrowContainer = document.createElement('div');
            arrowContainer.style.display = 'flex';
            
            const minusBtn = document.createElement('button');
            minusBtn.textContent = '←';
            minusBtn.style.width = '30px';
            minusBtn.style.height = '30px';
            minusBtn.style.backgroundColor = '#444';
            minusBtn.style.color = 'white';
            minusBtn.style.border = '1px solid #555';
            minusBtn.style.borderRadius = '4px 0 0 4px';
            minusBtn.style.cursor = 'pointer';
            
            const plusBtn = document.createElement('button');
            plusBtn.textContent = '→';
            plusBtn.style.width = '30px';
            plusBtn.style.height = '30px';
            plusBtn.style.backgroundColor = '#444';
            plusBtn.style.color = 'white';
            plusBtn.style.border = '1px solid #555';
            plusBtn.style.borderLeft = 'none';
            plusBtn.style.borderRadius = '0 4px 4px 0';
            plusBtn.style.cursor = 'pointer';
            
            minusBtn.onclick = () => {
                input.value = (parseFloat(input.value) - 0.1).toFixed(1);
                // Update hitbox position when button is clicked
                if (this.selectedHitbox) {
                    const value = parseFloat(input.value);
                    const axis = name.toLowerCase(); // x, y, or z
                    this.selectedHitbox.position[axis] = value;
                    
                    // Render scene immediately to show the change
                    if (this.editorRenderer && this.editorScene && this.editorCamera) {
                        this.editorRenderer.render(this.editorScene, this.editorCamera);
                    }
                }
            };
            
            plusBtn.onclick = () => {
                input.value = (parseFloat(input.value) + 0.1).toFixed(1);
                // Update hitbox position when button is clicked
                if (this.selectedHitbox) {
                    const value = parseFloat(input.value);
                    const axis = name.toLowerCase(); // x, y, or z
                    this.selectedHitbox.position[axis] = value;
                    
                    // Render scene immediately to show the change
                    if (this.editorRenderer && this.editorScene && this.editorCamera) {
                        this.editorRenderer.render(this.editorScene, this.editorCamera);
                    }
                }
            };
            
            arrowContainer.appendChild(minusBtn);
            arrowContainer.appendChild(plusBtn);
            
            inputContainer.appendChild(input);
            inputContainer.appendChild(arrowContainer);
            
            container.appendChild(label);
            container.appendChild(inputContainer);
            
            return container;
        };
        
        // Add position controls
        hitboxControlsSection.appendChild(createPositionControl('X', 0));
        hitboxControlsSection.appendChild(createPositionControl('Y', 0));
        hitboxControlsSection.appendChild(createPositionControl('Z', 0));
        
        // Add action buttons
        const actionButtonsContainer = document.createElement('div');
        actionButtonsContainer.style.marginTop = '20px';
        
        const createActionButton = (text, bgColor, action) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.style.width = '100%';
            button.style.padding = '10px';
            button.style.backgroundColor = bgColor;
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '4px';
            button.style.cursor = 'pointer';
            button.style.marginBottom = '10px';
            
            button.onclick = action;
            
            return button;
        };
        
        // Add buttons
        actionButtonsContainer.appendChild(createActionButton('Add Hitbox', '#00AA44', () => {
            console.log('Add hitbox clicked');
            this.addNewHitboxToModel();
        }));
        
        actionButtonsContainer.appendChild(createActionButton('Delete Hitbox', '#AA3333', () => {
            console.log('Delete hitbox clicked');
            if (this.selectedHitbox) {
                this.deleteSelectedHitbox();
            } else {
                alert('Please select a hitbox first');
            }
        }));
        
        actionButtonsContainer.appendChild(createActionButton('Save Changes', '#0066AA', () => {
            console.log('Save changes clicked');
            this.saveHitboxData();
        }));
        
        // Add load model button
        actionButtonsContainer.appendChild(createActionButton('Load Model', '#8800AA', () => {
            console.log('Load model clicked');
            const selectedModel = modelSelect.value;
            this.loadEnemyModelForEditor(selectedModel, viewport);
        }));
        
        // Append all controls to sidebar
        sidebar.appendChild(modelSelectContainer);
        sidebar.appendChild(hitboxControlsSection);
        sidebar.appendChild(actionButtonsContainer);
        
        // Create 3D viewport
        const viewport = document.createElement('div');
        viewport.style.flex = '1';
        viewport.style.backgroundColor = '#1E1E1E';
        viewport.style.position = 'relative';
        
        // Add placeholder text for viewport
        const viewportPlaceholder = document.createElement('div');
        viewportPlaceholder.textContent = '3D Viewport - Enemy Model Will Appear Here';
        viewportPlaceholder.style.position = 'absolute';
        viewportPlaceholder.style.top = '50%';
        viewportPlaceholder.style.left = '50%';
        viewportPlaceholder.style.transform = 'translate(-50%, -50%)';
        viewportPlaceholder.style.color = '#666';
        
        viewport.appendChild(viewportPlaceholder);
        
        // Add viewport controls overlay
        const viewportControls = document.createElement('div');
        viewportControls.style.position = 'absolute';
        viewportControls.style.bottom = '10px';
        viewportControls.style.right = '10px';
        viewportControls.style.backgroundColor = 'rgba(40, 40, 40, 0.8)';
        viewportControls.style.padding = '10px';
        viewportControls.style.borderRadius = '4px';
        viewportControls.style.fontSize = '12px';
        
        viewportControls.innerHTML = `
            <div style="margin-bottom: 5px;"><b>Mouse Controls:</b></div>
            <div>Middle Mouse - Rotate View</div>
            <div>Shift + Middle Mouse - Pan</div>
            <div>Mouse Wheel - Zoom</div>
            <div style="margin-top: 10px;"><b>Keyboard:</b></div>
            <div>G - Move Hitbox</div>
            <div>S - Scale Hitbox</div>
            <div>R - Rotate Hitbox</div>
        `;
        
        viewport.appendChild(viewportControls);
        
        // Add components to containers
        editorContainer.appendChild(sidebar);
        editorContainer.appendChild(viewport);
        
        this.editorPanel.appendChild(header);
        this.editorPanel.appendChild(editorContainer);
        
        // Add panel to document
        document.body.appendChild(this.editorPanel);
        
        // Initialize the 3D viewport (this would be implemented in a real game)
        this.initEditorViewport(viewport);
    }
    
    // Initialize the 3D viewport for the hitbox editor
    initEditorViewport(viewportElement) {
        // Create a separate scene for the editor
        const editorScene = new THREE.Scene();
        editorScene.background = new THREE.Color(0x1E1E1E);
        
        // Create camera for the editor
        const editorCamera = new THREE.PerspectiveCamera(
            75, // FOV
            viewportElement.clientWidth / viewportElement.clientHeight,
            0.1,
            1000
        );
        editorCamera.position.set(0, 1, 3); // Position for viewing model
        
        // Create renderer for the editor
        const editorRenderer = new THREE.WebGLRenderer({ antialias: true });
        editorRenderer.setSize(viewportElement.clientWidth, viewportElement.clientHeight);
        viewportElement.appendChild(editorRenderer.domElement);
        
        // Add lights to editor scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        editorScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        editorScene.add(directionalLight);
        
        // Create a grid helper
        const gridHelper = new THREE.GridHelper(10, 10);
        editorScene.add(gridHelper);
        
        // Create orbit controls for camera
        const controls = new OrbitControls(editorCamera, editorRenderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        
        // Store references in this object for access in other methods
        this.editorScene = editorScene;
        this.editorCamera = editorCamera;
        this.editorRenderer = editorRenderer;
        this.editorControls = controls;
        this.editorClock = new THREE.Clock(); // Add a clock for animation timing
        this.editorMixer = null; // Animation mixer
        this.editorHitboxes = []; // Array to store all hitboxes
        this.selectedHitbox = null; // Currently selected hitbox
        this.loadedModelMessage = null; // Reference to the "Load Model" message
        
        // Create hitbox table in top right corner
        this.createHitboxTable(viewportElement);
        
        // Animate editor scene
        const animateEditor = () => {
            if (!this.editorPanel || this.editorPanel.style.display === 'none') {
                return; // Stop animation if editor is closed
            }
            
            requestAnimationFrame(animateEditor);
            
            // Update orbit controls
            if (this.editorControls) {
                this.editorControls.update();
            }
            
            // Update animation mixer if it exists
            if (this.editorMixer) {
                const delta = this.editorClock.getDelta();
                this.editorMixer.update(delta);
            }
            
            // Render scene
            this.editorRenderer.render(this.editorScene, this.editorCamera);
        };
        
        // Start animation loop
        animateEditor();
        
        // Add window resize handler
        const editorResizeHandler = () => {
            if (!this.editorPanel || !this.editorCamera || !this.editorRenderer) return;
            
            const width = viewportElement.clientWidth;
            const height = viewportElement.clientHeight;
            
            this.editorCamera.aspect = width / height;
            this.editorCamera.updateProjectionMatrix();
            
            this.editorRenderer.setSize(width, height);
        };
        
        window.addEventListener('resize', editorResizeHandler);
        
        // Remove the default placeholder text since we're adding our own message
        const existingPlaceholder = viewportElement.querySelector('div:not(canvas)');
        if (existingPlaceholder) {
            viewportElement.removeChild(existingPlaceholder);
        }
        
        // Show a message to user that they need to load a model
        const messageElement = document.createElement('div');
        messageElement.textContent = 'Click "Load Model" to view the selected enemy model';
        messageElement.style.position = 'absolute';
        messageElement.style.top = '50%'; // Centered vertically
        messageElement.style.left = '50%';
        messageElement.style.transform = 'translate(-50%, -50%)';
        messageElement.style.color = '#00CC44';
        messageElement.style.fontSize = '16px';
        messageElement.style.padding = '10px';
        messageElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
        messageElement.style.borderRadius = '5px';
        messageElement.style.pointerEvents = 'none';
        messageElement.style.zIndex = '10'; // Ensure it's above the THREE.js canvas
        viewportElement.appendChild(messageElement);
        
        // Store reference to hide it later
        this.loadedModelMessage = messageElement;
        
        console.log("Editor viewport initialized");
    }
    
    // Create the hitbox table in the top right of the viewport
    createHitboxTable(viewportElement) {
        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.style.position = 'absolute';
        tableContainer.style.top = '10px';
        tableContainer.style.right = '10px';
        tableContainer.style.backgroundColor = 'rgba(40, 40, 40, 0.8)';
        tableContainer.style.borderRadius = '5px';
        tableContainer.style.padding = '10px';
        tableContainer.style.maxHeight = '40%';
        tableContainer.style.overflowY = 'auto';
        tableContainer.style.zIndex = '100';
        tableContainer.style.fontFamily = 'Arial, sans-serif';
        tableContainer.style.fontSize = '14px';
        tableContainer.style.color = 'white';
        tableContainer.style.backdropFilter = 'blur(2px)';
        
        // Add title
        const title = document.createElement('div');
        title.textContent = 'Active Hitboxes';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.color = '#00CC44';
        tableContainer.appendChild(title);
        
        // Create table element
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        const idHeader = document.createElement('th');
        idHeader.textContent = 'ID';
        idHeader.style.textAlign = 'left';
        idHeader.style.padding = '4px';
        idHeader.style.borderBottom = '1px solid #444';
        
        const typeHeader = document.createElement('th');
        typeHeader.textContent = 'Type';
        typeHeader.style.textAlign = 'left';
        typeHeader.style.padding = '4px';
        typeHeader.style.borderBottom = '1px solid #444';
        
        const damageHeader = document.createElement('th');
        damageHeader.textContent = 'Damage';
        damageHeader.style.textAlign = 'left';
        damageHeader.style.padding = '4px';
        damageHeader.style.borderBottom = '1px solid #444';
        
        const positionHeader = document.createElement('th');
        positionHeader.textContent = 'Position';
        positionHeader.style.textAlign = 'left';
        positionHeader.style.padding = '4px';
        positionHeader.style.borderBottom = '1px solid #444';
        
        const dimensionHeader = document.createElement('th');
        dimensionHeader.textContent = 'Dimension';
        dimensionHeader.style.textAlign = 'left';
        dimensionHeader.style.padding = '4px';
        dimensionHeader.style.borderBottom = '1px solid #444';
        
        headerRow.appendChild(idHeader);
        headerRow.appendChild(typeHeader);
        headerRow.appendChild(damageHeader);
        headerRow.appendChild(positionHeader);
        headerRow.appendChild(dimensionHeader);
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        
        // Add table to container
        tableContainer.appendChild(table);
        
        // Add to viewport
        viewportElement.appendChild(tableContainer);
        
        // Store reference
        this.hitboxTable = {
            container: tableContainer,
            body: tbody
        };
    }
    
    // Update the hitbox table with current hitboxes
    updateHitboxTable() {
        if (!this.hitboxTable || !this.hitboxTable.body) return;
        
        // Clear the table
        while (this.hitboxTable.body.firstChild) {
            this.hitboxTable.body.removeChild(this.hitboxTable.body.firstChild);
        }
        
        // Add rows for each hitbox
        this.editorHitboxes.forEach((hitbox, index) => {
            const row = document.createElement('tr');
            
            // Highlight the selected hitbox
            if (hitbox === this.selectedHitbox) {
                row.style.backgroundColor = 'rgba(0, 150, 0, 0.3)';
            }
            
            // Hover effect
            row.style.cursor = 'pointer';
            row.onmouseover = () => {
                if (hitbox !== this.selectedHitbox) {
                    row.style.backgroundColor = 'rgba(60, 60, 60, 0.7)';
                }
            };
            row.onmouseout = () => {
                if (hitbox !== this.selectedHitbox) {
                    row.style.backgroundColor = '';
                }
            };
            
            // Click to select
            row.onclick = () => {
                this.selectHitbox(hitbox);
                this.updateHitboxTable();
            };
            
            const idCell = document.createElement('td');
            idCell.textContent = `Hitbox ${index + 1}`;
            idCell.style.padding = '4px';
            idCell.style.borderBottom = '1px solid #333';
            
            const typeCell = document.createElement('td');
            typeCell.textContent = hitbox.hitboxType || 'Default';
            typeCell.style.padding = '4px';
            typeCell.style.borderBottom = '1px solid #333';
            
            const damageCell = document.createElement('td');
            damageCell.textContent = hitbox.damageMultiplier || '1x';
            damageCell.style.padding = '4px';
            damageCell.style.borderBottom = '1px solid #333';
            
            const positionCell = document.createElement('td');
            positionCell.textContent = `X: ${hitbox.position.x.toFixed(1)}, Y: ${hitbox.position.y.toFixed(1)}, Z: ${hitbox.position.z.toFixed(1)}`;
            positionCell.style.padding = '4px';
            positionCell.style.borderBottom = '1px solid #333';
            positionCell.style.fontSize = '12px';
            
            const dimensionCell = document.createElement('td');
            dimensionCell.textContent = `W: ${hitbox.scale.x.toFixed(1)}, H: ${hitbox.scale.y.toFixed(1)}, D: ${hitbox.scale.z.toFixed(1)}`;
            dimensionCell.style.padding = '4px';
            dimensionCell.style.borderBottom = '1px solid #333';
            dimensionCell.style.fontSize = '12px';
            
            row.appendChild(idCell);
            row.appendChild(typeCell);
            row.appendChild(damageCell);
            row.appendChild(positionCell);
            row.appendChild(dimensionCell);
            
            this.hitboxTable.body.appendChild(row);
        });
    }
    
    // Select a hitbox for editing
    selectHitbox(hitbox) {
        // Deselect current hitbox if any
        if (this.selectedHitbox) {
            const material = this.selectedHitbox.material;
            material.color.setHex(0x00CC44); // Back to default color
            material.opacity = 0.7;
            material.wireframe = true;
        }
        
        // Set new selection
        this.selectedHitbox = hitbox;
        
        // Update UI with hitbox details
        if (hitbox) {
            // Highlight selected hitbox
            const material = hitbox.material;
            material.color.setHex(0xffffff); // White for selected
            material.opacity = 0.5;
            material.wireframe = false;
            
            // Update UI controls with hitbox data
            
            // Update hitbox type dropdown
            const hitboxTypeSelect = document.getElementById('hitbox-type-select');
            if (hitboxTypeSelect) {
                // Find the option with matching text
                for (let i = 0; i < hitboxTypeSelect.options.length; i++) {
                    if (hitboxTypeSelect.options[i].textContent === hitbox.hitboxType) {
                        hitboxTypeSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            // Update hitbox shape dropdown
            const hitboxShapeSelect = document.getElementById('hitbox-shape-select');
            if (hitboxShapeSelect && hitbox.hitboxShape) {
                // Find the option with matching value
                for (let i = 0; i < hitboxShapeSelect.options.length; i++) {
                    if (hitboxShapeSelect.options[i].value === hitbox.hitboxShape) {
                        hitboxShapeSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            // Update damage multiplier dropdown
            const hitboxDamageSelect = document.getElementById('hitbox-damage-select');
            if (hitboxDamageSelect && hitbox.damageMultiplier) {
                // Find the option with matching value
                for (let i = 0; i < hitboxDamageSelect.options.length; i++) {
                    if (hitboxDamageSelect.options[i].value === hitbox.damageMultiplier) {
                        hitboxDamageSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            // Update position inputs
            const posX = document.getElementById('hitbox-position-x');
            const posY = document.getElementById('hitbox-position-y');
            const posZ = document.getElementById('hitbox-position-z');
            
            if (posX) posX.value = hitbox.position.x.toFixed(1);
            if (posY) posY.value = hitbox.position.y.toFixed(1);
            if (posZ) posZ.value = hitbox.position.z.toFixed(1);
            
            // Update dimension sliders
            const widthSlider = document.getElementById('hitbox-size-width');
            const heightSlider = document.getElementById('hitbox-size-height');
            const depthSlider = document.getElementById('hitbox-size-depth');
            
            const widthDisplay = document.getElementById('hitbox-size-width-display');
            const heightDisplay = document.getElementById('hitbox-size-height-display');
            const depthDisplay = document.getElementById('hitbox-size-depth-display');
            
            if (widthSlider) {
                widthSlider.value = hitbox.scale.x.toFixed(1);
                if (widthDisplay) widthDisplay.textContent = hitbox.scale.x.toFixed(1);
            }
            
            if (heightSlider) {
                heightSlider.value = hitbox.scale.y.toFixed(1);
                if (heightDisplay) heightDisplay.textContent = hitbox.scale.y.toFixed(1);
            }
            
            if (depthSlider) {
                depthSlider.value = hitbox.scale.z.toFixed(1);
                if (depthDisplay) depthDisplay.textContent = hitbox.scale.z.toFixed(1);
            }
        } else {
            // Clear UI controls if no hitbox is selected
            // Reset hitbox type
            const hitboxTypeSelect = document.getElementById('hitbox-type-select');
            if (hitboxTypeSelect) hitboxTypeSelect.selectedIndex = 0;
            
            // Reset hitbox shape
            const hitboxShapeSelect = document.getElementById('hitbox-shape-select');
            if (hitboxShapeSelect) hitboxShapeSelect.selectedIndex = 0;
            
            // Reset damage multiplier
            const hitboxDamageSelect = document.getElementById('hitbox-damage-select');
            if (hitboxDamageSelect) hitboxDamageSelect.selectedIndex = 0;
            
            // Reset position inputs
            const posX = document.getElementById('hitbox-position-x');
            const posY = document.getElementById('hitbox-position-y');
            const posZ = document.getElementById('hitbox-position-z');
            
            if (posX) posX.value = "0.0";
            if (posY) posY.value = "0.0";
            if (posZ) posZ.value = "0.0";
            
            // Reset dimension sliders
            const widthSlider = document.getElementById('hitbox-size-width');
            const heightSlider = document.getElementById('hitbox-size-height');
            const depthSlider = document.getElementById('hitbox-size-depth');
            
            const widthDisplay = document.getElementById('hitbox-size-width-display');
            const heightDisplay = document.getElementById('hitbox-size-height-display');
            const depthDisplay = document.getElementById('hitbox-size-depth-display');
            
            if (widthSlider) {
                widthSlider.value = "1.0";
                if (widthDisplay) widthDisplay.textContent = "1.0";
            }
            
            if (heightSlider) {
                heightSlider.value = "1.0";
                if (heightDisplay) heightDisplay.textContent = "1.0";
            }
            
            if (depthSlider) {
                depthSlider.value = "1.0";
                if (depthDisplay) depthDisplay.textContent = "1.0";
            }
        }
        
        // Update the hitbox table
        this.updateHitboxTable();
    }
    
    // Add new hitbox to model
    addNewHitboxToModel() {
        if (!this.editorEnemyModel) {
            alert('Please load a model first');
            return;
        }
        
        // Create a new hitbox with a different size
        const hitboxSize = 0.5 + Math.random() * 0.5; // Random size for variety
        const hitboxGeometry = new THREE.BoxGeometry(hitboxSize, hitboxSize, hitboxSize);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            color: 0x00CC44,
            wireframe: true,
            transparent: true,
            opacity: 0.7
        });
        
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        
        // Set position to 0,0,0 instead of random
        hitbox.position.set(0, 0, 0);
        
        // Add type property
        hitbox.hitboxType = 'Default';
        hitbox.hitboxShape = 'box';
        hitbox.damageMultiplier = '1x';
        
        // Add the hitbox to the model container
        this.editorEnemyModel.add(hitbox);
        
        // Store reference to the hitbox
        this.editorHitboxes.push(hitbox);
        
        // Select the new hitbox
        this.selectHitbox(hitbox);
        
        // Update the hitbox table
        this.updateHitboxTable();
    }
    
    // Delete selected hitbox
    deleteSelectedHitbox() {
        if (!this.selectedHitbox) return;
        
        // Remove from scene
        if (this.selectedHitbox.parent) {
            this.selectedHitbox.parent.remove(this.selectedHitbox);
        }
        
        // Remove from array
        const index = this.editorHitboxes.indexOf(this.selectedHitbox);
        if (index !== -1) {
            this.editorHitboxes.splice(index, 1);
        }
        
        // Clear selection
        this.selectedHitbox = null;
        
        // Update table
        this.updateHitboxTable();
    }
    
    // Save hitbox data
    saveHitboxData() {
        if (!this.editorEnemyModel || this.editorHitboxes.length === 0) {
            alert('No hitboxes to save');
            return;
        }
        
        // Get the model type
        const modelType = this.editorEnemyModel.userData.modelType || 'Unknown';
        
        // Create JSON representation of hitboxes
        const hitboxData = this.editorHitboxes.map(hitbox => {
            return {
                type: hitbox.hitboxType || 'Default',
                shape: hitbox.hitboxShape || 'box',
                damageMultiplier: hitbox.damageMultiplier || '1x',
                position: {
                    x: hitbox.position.x.toFixed(2),
                    y: hitbox.position.y.toFixed(2),
                    z: hitbox.position.z.toFixed(2)
                },
                scale: {
                    x: hitbox.scale.x.toFixed(2),
                    y: hitbox.scale.y.toFixed(2),
                    z: hitbox.scale.z.toFixed(2)
                }
            };
        });
        
        // Store the hitbox data in localStorage as a temporary backup
        this.saveHitboxConfigToLocalStorage(modelType, hitboxData);
        
        // Generate downloadable JSON file with the hitbox data
        this.downloadHitboxConfig(modelType, hitboxData);
        
        console.log(`Saved hitbox data for ${modelType}:`, hitboxData);
        
        // Show a brief success message
        this.showSaveSuccessMessage(modelType, hitboxData.length);
    }
    
    // Download hitbox config as a JSON file
    downloadHitboxConfig(modelType, hitboxData) {
        // Create a JSON string of the data with nice formatting
        const jsonData = JSON.stringify(hitboxData, null, 2);
        
        // Create a blob with the JSON data
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${modelType.toLowerCase()}_hitboxes.json`;
        
        // Append to document, click it to trigger download, then remove
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Small delay before cleanup
        setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        }, 100);
        
        console.log(`Downloaded hitbox configuration for ${modelType}`);
    }
    
    // Show a brief success message when changes are saved
    showSaveSuccessMessage(modelType, hitboxCount) {
        // Create a floating message element
        const messageElement = document.createElement('div');
        messageElement.textContent = `✓ Saved ${hitboxCount} hitboxes for ${modelType}`;
        messageElement.style.position = 'fixed';
        messageElement.style.bottom = '30px';
        messageElement.style.left = '50%';
        messageElement.style.transform = 'translateX(-50%)';
        messageElement.style.padding = '10px 20px';
        messageElement.style.backgroundColor = 'rgba(0, 204, 68, 0.9)';
        messageElement.style.color = 'white';
        messageElement.style.borderRadius = '5px';
        messageElement.style.fontFamily = 'Arial, sans-serif';
        messageElement.style.fontSize = '16px';
        messageElement.style.fontWeight = 'bold';
        messageElement.style.zIndex = '5000';
        messageElement.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
        messageElement.style.opacity = '0';
        messageElement.style.transition = 'opacity 0.3s ease-in-out';
        
        // Add more text explaining the download
        const additionalInfo = document.createElement('div');
        additionalInfo.textContent = `JSON file downloaded - copy to 'assets/hitboxes/' folder`;
        additionalInfo.style.fontSize = '12px';
        additionalInfo.style.marginTop = '5px';
        additionalInfo.style.fontWeight = 'normal';
        messageElement.appendChild(additionalInfo);
        
        // Add to document
        document.body.appendChild(messageElement);
        
        // Fade in
        setTimeout(() => {
            messageElement.style.opacity = '1';
        }, 50);
        
        // Remove after 4 seconds (longer to give time to read the additional message)
        setTimeout(() => {
            messageElement.style.opacity = '0';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300); // Wait for fade out animation
        }, 4000);
    }
    
    // Helper method to save hitbox data to localStorage
    saveHitboxConfigToLocalStorage(modelType, hitboxData) {
        // Create a storage key based on the model type
        const storageKey = `hitboxConfig_${modelType.toLowerCase()}`;
        
        // Save the data to localStorage
        try {
            localStorage.setItem(storageKey, JSON.stringify(hitboxData));
            console.log(`Hitbox data for ${modelType} saved to localStorage`);
        } catch (error) {
            console.error(`Error saving hitbox data to localStorage:`, error);
        }
    }
    
    // Helper method to load hitbox data from localStorage
    loadHitboxConfigFromLocalStorage(modelType) {
        if (!modelType) return null;
        
        // Create the same storage key format
        const storageKey = `hitboxConfig_${modelType.toLowerCase()}`;
        
        try {
            const savedDataString = localStorage.getItem(storageKey);
            if (savedDataString) {
                return JSON.parse(savedDataString);
            }
        } catch (error) {
            console.error(`Error loading hitbox data from localStorage:`, error);
        }
        
        return null; // Return null if no data or error
    }
    
    // Load enemy model for the editor
    loadEnemyModelForEditor(modelType, viewportElement) {
        if (!this.editorScene) {
            console.error("Editor scene not initialized");
            return;
        }
        
        // Remove any existing models
        if (this.editorEnemyModel) {
            this.editorScene.remove(this.editorEnemyModel);
            this.editorEnemyModel = null;
        }
        
        console.log(`*** EDITOR DEBUG: Loading ${modelType} model for editor`);
        
        // Create loading message
        const loadingMessage = document.createElement('div');
        loadingMessage.textContent = `Loading ${modelType} model...`;
        loadingMessage.style.position = 'absolute';
        loadingMessage.style.top = '50%';
        loadingMessage.style.left = '50%';
        loadingMessage.style.transform = 'translate(-50%, -50%)';
        loadingMessage.style.color = 'white';
        loadingMessage.style.fontSize = '16px';
        loadingMessage.style.padding = '10px';
        loadingMessage.style.backgroundColor = 'rgba(0,0,0,0.7)';
        loadingMessage.style.borderRadius = '5px';
        loadingMessage.style.zIndex = '100';
        viewportElement.appendChild(loadingMessage);
        
        // Create a reference object to act as the model container
        const modelContainer = new THREE.Object3D();
        modelContainer.userData.modelType = modelType; // Store model type for reference
        this.editorScene.add(modelContainer);
        this.editorEnemyModel = modelContainer;
        
        // Clear any existing hitboxes
        this.editorHitboxes = [];
        this.selectedHitbox = null;
        this.updateHitboxTable();
        
        // First try to load hitbox config from file
        this.loadHitboxConfigFromFile(modelType)
            .then(fileConfig => {
                console.log(`*** EDITOR DEBUG: Loaded hitbox config from file for ${modelType}:`, !!fileConfig ? "Found config" : "No config found");
                if (fileConfig) {
                    console.log(`*** EDITOR DEBUG: Hitbox config content:`, JSON.stringify(fileConfig));
                }
                const hitboxConfig = fileConfig || this.loadHitboxConfigFromLocalStorage(modelType);
                this.loadModelWithConfig(modelType, viewportElement, loadingMessage, modelContainer, hitboxConfig);
            })
            .catch(error => {
                console.warn(`*** EDITOR DEBUG: Could not load hitbox config from file: ${error}. Trying localStorage.`);
                const hitboxConfig = this.loadHitboxConfigFromLocalStorage(modelType);
                this.loadModelWithConfig(modelType, viewportElement, loadingMessage, modelContainer, hitboxConfig);
            });
    }
    
    // Helper method to load hitbox config from a file in assets/hitboxes/
    loadHitboxConfigFromFile(modelType) {
        return new Promise((resolve, reject) => {
            const filePath = `assets/hitboxes/${modelType.toLowerCase()}_hitboxes.json`;
            console.log(`Attempting to load hitbox config from: ${filePath}`);
            
            fetch(filePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log(`Successfully loaded hitbox config from file for ${modelType}`);
                    resolve(data);
                })
                .catch(error => {
                    console.warn(`Error loading hitbox config from file: ${error.message}`);
                    resolve(null); // Resolve with null to continue the flow rather than rejecting
                });
        });
    }
    
    // Helper method to load model with the provided hitbox config
    loadModelWithConfig(modelType, viewportElement, loadingMessage, modelContainer, hitboxConfig) {
        // Create a simple placeholder model in case loading fails
        this.createPlaceholderEnemyModel(modelContainer, modelType);
        
        // Determine model path based on enemy type
        let modelPath = '';
        let modelScale = 1.0;
        switch(modelType.toLowerCase()) {
            case 'lokito':
                // This is the actual path from Lokito.js
                modelPath = 'assets/3d models/zombie 2/132_necrozomb9.glb';
                modelScale = 2.0; // Same scale used in Lokito.js
                break;
            case 'dnb':
                // This is the actual path from DNB.js
                modelPath = 'assets/3d models/zombie 5/DNB4.glb';
                modelScale = 2.0; // Same scale used in DNB.js
                break;
            default:
                console.error(`Unknown model type: ${modelType}`);
                viewportElement.removeChild(loadingMessage);
                return;
        }
        
        // For debugging path issues, log the full attempted path
        console.log(`Attempting to load model from path: ${modelPath}`);
        
        // Load the model
        const loader = new GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => {
                // If there was a loading message, remove it
                if (loadingMessage.parentNode) {
                    viewportElement.removeChild(loadingMessage);
                }
                
                // Hide the load model message
                if (this.loadedModelMessage) {
                    this.loadedModelMessage.style.display = 'none';
                }
                
                // Remove the placeholder models
                while(modelContainer.children.length > 0) {
                    modelContainer.remove(modelContainer.children[0]);
                }
                
                // Add the model to the container
                modelContainer.add(gltf.scene);
                
                // Configure the model
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Special display handling for Lokito (ghost)
                        if (modelType.toLowerCase() === 'lokito') {
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
                    }
                });
                
                // Scale model appropriately for the editor view
                // Use 1.0 scale visually in the editor to match the game's appearance (where models are scaled by 2.0)
                gltf.scene.scale.set(1.0, 1.0, 1.0);
                console.log(`*** EDITOR DEBUG: Forcing editor visual scale to 1.0 for ${modelType}`);

                // Position model at center and the right height
                gltf.scene.position.set(0, 0, 0);
                
                // Set animations if available
                if (gltf.animations && gltf.animations.length > 0) {
                    // Clear any existing mixer
                    this.editorMixer = new THREE.AnimationMixer(gltf.scene);
                    
                    console.log(`[Editor] Available animations for ${modelType}:`, gltf.animations.map(clip => clip.name));
                    
                    // Find idle animation if available
                    let idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Idle') || 
                                  THREE.AnimationClip.findByName(gltf.animations, 'idle');
                    
                    // If no specific idle animation found, use the first one
                    if (!idleClip && gltf.animations.length > 0) {
                        idleClip = gltf.animations[0];
                    }
                    
                    // Play the animation if found
                    if (idleClip) {
                        const action = this.editorMixer.clipAction(idleClip);
                        action.play();
                        console.log(`[Editor] Playing animation: ${idleClip.name || 'default'}`);
                    }
                }
                
                // Show success message that disappears after a few seconds
                const successMessage = document.createElement('div');
                successMessage.textContent = `${modelType} model loaded successfully`;
                successMessage.style.position = 'absolute';
                successMessage.style.bottom = '20px';
                successMessage.style.left = '50%';
                successMessage.style.transform = 'translateX(-50%)';
                successMessage.style.color = '#00CC44';
                successMessage.style.fontSize = '16px';
                successMessage.style.padding = '10px';
                successMessage.style.backgroundColor = 'rgba(0,0,0,0.7)';
                successMessage.style.borderRadius = '5px';
                successMessage.style.zIndex = '100';
                viewportElement.appendChild(successMessage);
                
                // Remove success message after 3 seconds
                setTimeout(() => {
                    if (successMessage.parentNode) {
                        viewportElement.removeChild(successMessage);
                    }
                }, 3000);
                
                // Add hitboxes - either from saved config or a default one
                if (hitboxConfig && hitboxConfig.length > 0) {
                    // Add saved hitboxes
                    this.addSavedHitboxes(modelContainer, hitboxConfig);
                    
                    // Show message about the hitbox source
                    const hitboxSourceMsg = document.createElement('div');
                    hitboxSourceMsg.textContent = `Loaded ${hitboxConfig.length} hitboxes from config`;
                    hitboxSourceMsg.style.position = 'absolute';
                    hitboxSourceMsg.style.bottom = '60px';
                    hitboxSourceMsg.style.left = '50%';
                    hitboxSourceMsg.style.transform = 'translateX(-50%)';
                    hitboxSourceMsg.style.color = '#FFCC00';
                    hitboxSourceMsg.style.fontSize = '14px';
                    hitboxSourceMsg.style.padding = '5px 10px';
                    hitboxSourceMsg.style.backgroundColor = 'rgba(0,0,0,0.7)';
                    hitboxSourceMsg.style.borderRadius = '5px';
                    hitboxSourceMsg.style.zIndex = '100';
                    viewportElement.appendChild(hitboxSourceMsg);
                    
                    // Remove hitbox source message after 3 seconds
                    setTimeout(() => {
                        if (hitboxSourceMsg.parentNode) {
                            viewportElement.removeChild(hitboxSourceMsg);
                        }
                    }, 3000);
                } else {
                    // Add a default hitbox if no saved configuration
                    this.addInitialHitbox(modelContainer);
                }
                
                console.log(`${modelType} model loaded successfully`);
            },
            // Progress callback
            (xhr) => {
                if (xhr.lengthComputable) {
                    const percentComplete = (xhr.loaded / xhr.total) * 100;
                    loadingMessage.textContent = `Loading ${modelType} model... ${Math.round(percentComplete)}%`;
                } else {
                    loadingMessage.textContent = `Loading ${modelType} model... (size unknown)`;
                }
            },
            // Error callback
            (error) => {
                console.error(`Error loading ${modelType} model:`, error);
                
                if (loadingMessage.parentNode) {
                    viewportElement.removeChild(loadingMessage);
                }
                
                // Show error message with more details
                const errorMessage = document.createElement('div');
                errorMessage.innerHTML = `Error loading ${modelType} model:<br>${error.message || 'File not found'}<br><br>Using placeholder model instead.`;
                errorMessage.style.position = 'absolute';
                errorMessage.style.top = '50%';
                errorMessage.style.left = '50%';
                errorMessage.style.transform = 'translate(-50%, -50%)';
                errorMessage.style.color = '#FF4444';
                errorMessage.style.fontSize = '16px';
                errorMessage.style.padding = '10px';
                errorMessage.style.backgroundColor = 'rgba(0,0,0,0.7)';
                errorMessage.style.borderRadius = '5px';
                errorMessage.style.maxWidth = '80%';
                errorMessage.style.textAlign = 'center';
                viewportElement.appendChild(errorMessage);
                
                // Remove error message after 5 seconds
                setTimeout(() => {
                    if (errorMessage.parentNode) {
                        viewportElement.removeChild(errorMessage);
                    }
                }, 5000);
                
                // If we have saved hitbox data, add it to the placeholder model
                if (hitboxConfig && hitboxConfig.length > 0) {
                    this.addSavedHitboxes(modelContainer, hitboxConfig);
                } else {
                    // Otherwise add a default hitbox
                    this.addInitialHitbox(modelContainer);
                }
            }
        );
    }
    
    // New method to add saved hitboxes from config
    addSavedHitboxes(modelContainer, hitboxConfig) {
        console.log("Adding saved hitboxes:", hitboxConfig);
        
        // Clear any existing hitboxes
        this.editorHitboxes = [];
        
        // Create hitboxes from the saved configuration
        hitboxConfig.forEach(hitboxData => {
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
            
            // Create the material
            const material = new THREE.MeshBasicMaterial({
                color: 0x00CC44,
                wireframe: true,
                transparent: true,
                opacity: 0.7
            });
            
            // Create the hitbox mesh
            const hitbox = new THREE.Mesh(geometry, material);
            
            // Set position from saved data
            const position = hitboxData.position || { x: 0, y: 0, z: 0 };
            hitbox.position.set(
                parseFloat(position.x) || 0,
                parseFloat(position.y) || 0,
                parseFloat(position.z) || 0
            );
            
            // Set scale from saved data
            const scale = hitboxData.scale || { x: 1, y: 1, z: 1 };
            hitbox.scale.set(
                parseFloat(scale.x) || 1,
                parseFloat(scale.y) || 1,
                parseFloat(scale.z) || 1
            );
            
            // Set type property
            hitbox.hitboxType = hitboxData.type || 'Default';
            hitbox.hitboxShape = shape;
            hitbox.damageMultiplier = hitboxData.damageMultiplier || '1x';
            
            // Add the hitbox to the model container
            modelContainer.add(hitbox);
            
            // Store reference to the hitbox
            this.editorHitboxes.push(hitbox);
        });
        
        // Update the hitbox table
        this.updateHitboxTable();
        
        console.log(`Added ${this.editorHitboxes.length} hitboxes from saved configuration`);
    }
    
    // Add initial hitbox visualization to the model
    addInitialHitbox(modelContainer) {
        // Create a default hitbox as a wireframe box
        const hitboxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            color: 0x00CC44,
            wireframe: true,
            transparent: true,
            opacity: 0.7
        });
        
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.set(0, 0.5, 0); // Position at the center of the model
        hitbox.hitboxType = 'Default'; // Add type property
        
        // Add the hitbox to the model container
        modelContainer.add(hitbox);
        
        // Store reference to the hitbox
        this.editorHitbox = hitbox;
        
        // Add to hitboxes array
        this.editorHitboxes.push(hitbox);
        
        // Update the hitbox table
        this.updateHitboxTable();
    }
    
    // Create a placeholder model in case the actual model fails to load
    createPlaceholderEnemyModel(modelContainer, modelType) {
        // Remove previous content
        while(modelContainer.children.length > 0) {
            modelContainer.remove(modelContainer.children[0]);
        }
        
        // Create a simple shape based on the enemy type
        let geometry;
        let material;
        let mesh;
        
        switch(modelType) {
            case 'lokito':
                // Ghost-like shape (taller, more ethereal)
                geometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
                material = new THREE.MeshPhongMaterial({
                    color: 0xaabbff,
                    transparent: true,
                    opacity: 0.8,
                    emissive: 0x3344aa,
                    emissiveIntensity: 0.3
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.7; // Floating
                
                // Add eyes
                const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
                const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000022 });
                const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
                leftEye.position.set(0.15, 0.3, 0.35);
                const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
                rightEye.position.set(-0.15, 0.3, 0.35);
                mesh.add(leftEye);
                mesh.add(rightEye);
                
                break;
                
            case 'dnb':
                // Zombie-like shape
                geometry = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
                material = new THREE.MeshPhongMaterial({
                    color: 0x336633,
                    roughness: 0.8
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.5;
                
                // Add limbs
                const armGeo = new THREE.CapsuleGeometry(0.15, 0.6, 4, 8);
                const legGeo = new THREE.CapsuleGeometry(0.2, 0.8, 4, 8);
                const limbMat = new THREE.MeshPhongMaterial({ color: 0x336633 });
                
                // Left arm
                const leftArm = new THREE.Mesh(armGeo, limbMat);
                leftArm.position.set(0.7, 0.2, 0);
                leftArm.rotation.z = -Math.PI / 4;
                
                // Right arm
                const rightArm = new THREE.Mesh(armGeo, limbMat);
                rightArm.position.set(-0.7, 0.2, 0);
                rightArm.rotation.z = Math.PI / 4;
                
                mesh.add(leftArm);
                mesh.add(rightArm);
                break;
                
            case 'crawler':
                // Low, wide creature
                geometry = new THREE.BoxGeometry(0.8, 0.4, 1.2);
                material = new THREE.MeshPhongMaterial({
                    color: 0x773300,
                    roughness: 0.9
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.2;
                
                // Add legs/claws
                const clawGeo = new THREE.ConeGeometry(0.1, 0.4, 4);
                const clawMat = new THREE.MeshPhongMaterial({ color: 0x995500 });
                
                // Add 8 legs (4 on each side)
                for (let i = 0; i < 4; i++) {
                    const zPos = 0.4 - (i * 0.25);
                    
                    // Left leg
                    const leftLeg = new THREE.Mesh(clawGeo, clawMat);
                    leftLeg.position.set(0.5, 0, zPos);
                    leftLeg.rotation.z = -Math.PI / 2;
                    
                    // Right leg
                    const rightLeg = new THREE.Mesh(clawGeo, clawMat);
                    rightLeg.position.set(-0.5, 0, zPos);
                    rightLeg.rotation.z = Math.PI / 2;
                    
                    mesh.add(leftLeg);
                    mesh.add(rightLeg);
                }
                break;
                
            case 'ghost':
                // Wispy ghost shape
                geometry = new THREE.ConeGeometry(0.5, 1.5, 8);
                material = new THREE.MeshPhongMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.5,
                    emissive: 0x8888aa,
                    emissiveIntensity: 0.2
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.75;
                
                // Add wispy bottom extensions
                const wispGeo = new THREE.ConeGeometry(0.15, 0.5, 4);
                const wispMat = new THREE.MeshPhongMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.3
                });
                
                for (let i = 0; i < 3; i++) {
                    const angle = (i * Math.PI * 2) / 3;
                    const wisp = new THREE.Mesh(wispGeo, wispMat);
                    wisp.position.set(
                        Math.sin(angle) * 0.3,
                        -0.75,
                        Math.cos(angle) * 0.3
                    );
                    wisp.rotation.x = Math.PI;
                    mesh.add(wisp);
                }
                break;
                
            default:
                // Generic humanoid placeholder
                geometry = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
                material = new THREE.MeshPhongMaterial({
                    color: 0x888888
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.5;
        }
        
        // Add a label with the model name
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#00CC44';
        ctx.fillText(`Placeholder ${modelType}`, 128, 32);
        
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true
        });
        const label = new THREE.Sprite(labelMaterial);
        label.position.set(0, 1.5, 0);
        label.scale.set(2, 0.5, 1);
        
        // Add to model container
        modelContainer.add(mesh);
        modelContainer.add(label);
        
        console.log(`Created placeholder for ${modelType} model`);
    }

    // Update the hitbox shape
    updateHitboxShape(hitbox, shape) {
        if (!hitbox) return;
        
        // Store current scale
        const currentScale = {
            x: hitbox.scale.x,
            y: hitbox.scale.y,
            z: hitbox.scale.z
        };
        
        // Store current geometry for disposal
        const oldGeometry = hitbox.geometry;
        
        // Create new geometry based on shape
        let newGeometry;
        switch (shape) {
            case 'sphere':
                newGeometry = new THREE.SphereGeometry(0.5, 16, 16);
                break;
            case 'cylinder':
                newGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
                break;
            default: // 'box' is the default
                newGeometry = new THREE.BoxGeometry(1, 1, 1);
                break;
        }
        
        // Update hitbox with new geometry
        hitbox.geometry.dispose(); // Dispose of old geometry
        hitbox.geometry = newGeometry;
        
        // Apply original scale
        hitbox.scale.set(currentScale.x, currentScale.y, currentScale.z);
        
        // Store shape type on hitbox
        hitbox.hitboxShape = shape;
        
        // Render scene immediately to show the change
        if (this.editorRenderer && this.editorScene && this.editorCamera) {
            this.editorRenderer.render(this.editorScene, this.editorCamera);
        }
    }

    // Save hitbox data for current enemy model
    saveHitboxData() {
        if (!this.editorEnemyModel) {
            console.error("No enemy model loaded to save hitboxes for");
            this.showToast("Error: No enemy model loaded", "error");
            return;
        }
        
        // Get model type from the stored user data
        const modelType = this.editorEnemyModel.userData.modelType;
        if (!modelType) {
            console.error("Model type not found in user data");
            this.showToast("Error: Model type not found", "error");
            return;
        }
        
        // Get hitbox data in a serializable format
        const hitboxData = this.getSerializableHitboxData();
        
        // Save to localStorage as backup
        const storageKey = `hitboxConfig_${modelType}`;
        localStorage.setItem(storageKey, JSON.stringify(hitboxData));
        
        // Also download as a JSON file for permanent storage
        this.downloadHitboxConfig(modelType, hitboxData);
        
        // Also save to server if possible
        this.saveHitboxConfigToServer(modelType, hitboxData);
        
        this.showToast(`Hitbox configuration saved and downloaded for ${modelType}. Place the downloaded file in the "assets/hitboxes" directory to use it in the game.`, "success", 5000);
    }
    
    // Get serializable data from hitboxes
    getSerializableHitboxData() {
        if (!this.editorHitboxes || this.editorHitboxes.length === 0) {
            return [];
        }
        
        // Create JSON representation of hitboxes
        return this.editorHitboxes.map(hitbox => {
            return {
                type: hitbox.hitboxType || 'Default',
                shape: hitbox.hitboxShape || 'box',
                damageMultiplier: hitbox.damageMultiplier || '1x',
                position: {
                    x: hitbox.position.x.toFixed(2),
                    y: hitbox.position.y.toFixed(2),
                    z: hitbox.position.z.toFixed(2)
                },
                scale: {
                    x: hitbox.scale.x.toFixed(2),
                    y: hitbox.scale.y.toFixed(2),
                    z: hitbox.scale.z.toFixed(2)
                }
            };
        });
    }
    
    // Save hitbox config directly to server
    saveHitboxConfigToServer(modelType, hitboxData) {
        const jsonData = JSON.stringify(hitboxData, null, 2);
        const fileName = `${modelType.toLowerCase()}_hitboxes.json`;
        
        // Create a FormData object to send the file
        const formData = new FormData();
        formData.append('file', new Blob([jsonData], { type: 'application/json' }), fileName);
        formData.append('path', 'assets/hitboxes/');
        
        // Send the data to a server endpoint
        fetch('/api/save-hitbox-config', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Hitbox config saved to server:', data);
            this.showToast(`Hitbox configuration for ${modelType} saved to server!`, "success", 3000);
        })
        .catch(error => {
            console.error('Error saving hitbox config to server:', error);
            // Don't show error to user - the download is already a fallback
        });
    }
    
    // Download hitbox configuration as a JSON file
    downloadHitboxConfig(modelType, hitboxData) {
        // Create a JSON string with formatting for readability
        const jsonString = JSON.stringify(hitboxData, null, 2);
        
        // Create a blob from the JSON string
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link element to trigger the download
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${modelType.toLowerCase()}_hitboxes.json`;
        
        // Append the link to the document, click it, and then remove it
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up by revoking the URL
        URL.revokeObjectURL(url);
        
        console.log(`Hitbox config downloaded for ${modelType}`);
    }
    
    // Play hitbox editor music
    playHitboxEditorMusic() {
        if (!this.audioManager) return;
        
        const hitboxEditorMusicPath = "assets/sounds/KMRBI_SJ_68_music_loop_cosmicmayn_Fm.wav";
        
        // Load and play hitbox editor music
        fetch(hitboxEditorMusicPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error loading hitbox editor music: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                // Play the loaded buffer as a loop
                this.audioManager.playLoop(arrayBuffer);
                console.log("Hitbox editor music started");
            })
            .catch(error => {
                console.error("Failed to load hitbox editor music:", error);
            });
    }
    
    // Restart the startup music when exiting the editor
    restartStartupMusic() {
        if (!this.audioManager) return;
        
        const percussionLoop = 'assets/sounds/PM_EN_90_Percussion_FX_Loop_Race.wav';
        
        // Set up audio analyzer for visualization
        this.audioManager.setupAnalyser(this.visualizeAudio || ((audioData) => {
            // Default visualization if none exists
        }));
        
        // Start playing the percussion loop
        this.audioManager.playWithAnalyzer(percussionLoop);
        console.log("Restarted startup percussion loop");
    }
} 