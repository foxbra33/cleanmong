import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Inventory } from './Inventory.js';
import { PerkSystem } from './PerkSystem.js';
import { GameOver } from './GameOver.js';

export class PlayerController {
    constructor(camera, domElement, physicsWorld, audioManager) {
        this.camera = camera;
        this.domElement = domElement;
        this.physicsWorld = physicsWorld;
        this.audioManager = audioManager; // Store reference to AudioManager
        
        // ADD BACK Damage properties
        this.isTakingDamage = false; 
        this.damageEffectDuration = 150; 
        this.damageEffectTimeout = null;
        this.health = 100; 
        this.maxHealth = 100;
        this.isDead = false; // Track if player is dead
        
        // God mode flag
        this.godMode = false;
        
        // Kill streak system
        this.killStreak = 0;
        this.killsForHealthBoost = 3;
        this.healthBoostAmount = 10;
        
        // Player damage sound files
        this.damageSoundFiles = [
            'assets/sounds/FightGrunt_BW.54963.wav',
            'assets/sounds/FightGrunt_BW.54981.wav'
        ];
        
        // Movement sound files
        this.crouchSound = 'assets/sounds/cloth4.ogg';
        this.slideSound = 'assets/sounds/SS_SOA_perc_sandpaper_slide_single_alt.wav'; // Updated slide sound
        this.slideWhiteNoiseSource = null; // Track white noise sound source
        
        // Footstep sound files
        this.footstepSounds = ['assets/sounds/FootstepsCement_BW.7471.wav'];
        this.footstepTimer = null;
        this.footstepInterval = 500; // Default interval in ms
        this.lastFootstepTime = 0;
        this.footstepVelocityThreshold = 0.5; // Minimum velocity to trigger footsteps
        this.lastFootstepPan = 0.4; // Track last footstep panning to alternate sides (increased from 0.2)
        
        // Jump sound files
        this.jumpSounds = [
            'assets/sounds/ESM_ACV_Vocals_male_jump_hup_small_quick_hop_04.wav',
            'assets/sounds/ESM_ACV_Vocals_male_jump_aggressive_dodge_hop_02.wav',
            'assets/sounds/ESM_ACV_Vocals_male_jump_aggressive_dodge_hop_01.wav'
        ];
        
        // Player representation for AI targeting
        this.player = {
            mesh: { // Simulate a mesh object for position tracking
                position: new THREE.Vector3()
            },
            body: this.physicsWorld.getPlayerBody() // Store reference to the physics body
        };
        
        // Movement state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = true;
        
        // Movement parameters
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveSpeed = 10.388; // Reduced by another 5% from previous 10.935
        this.jumpForce = 14.14; // Increased to compensate for gravity (sqrt(2) * 10.0)
        
        // Sprint parameters
        this.isSprinting = false;
        this.sprintMultiplier = 1.365; // Increased by 5% from previous 1.3
        this.sprintDuration = 6000; // 6 seconds in milliseconds (2 seconds cooldown)
        this.sprintTimer = null;
        this.canSprint = true;
        this.sprintCooldown = false;
        this.sprintStartTime = 0; // Track when sprint started
        
        // Crouch parameters
        this.isCrouching = false;
        this.normalHeight = 1.8;
        this.crouchHeight = 0.9; // Half normal height
        this.playerHeight = this.normalHeight;
        
        // Slide parameters
        this.isSliding = false;
        this.slideHeight = 0.4; // Changed from 0.7 to 0.4 for a much lower slide
        this.slideDistance = 10.0; // Changed from 8.0 to 10.0 meters
        this.slideDuration = 850; // Increased from 750 to 850ms for slightly longer slide
        this.slideTimer = null;
        this.slideDirection = new THREE.Vector3();
        this.slideStartPosition = new THREE.Vector3();
        this.slideVelocity = 12.0; // Increased from 10.0 to 12.0 for a faster initial slide
        this.slideProgress = 0; // Track slide progress for smooth transitions
        this.slideEasing = true; // Enable easing for smooth slide start/end
        this.slideCooldown = false; // Track if slide is on cooldown
        this.slideCooldownDuration = 1000; // 1 second cooldown (normal)
        
        // Setup pointer lock controls
        this.controls = new PointerLockControls(camera, domElement);
        
        // Setup event listeners
        this.setupEventListeners();

        // ADD BACK Create Player Health Bar UI
        this.createHealthBarUI();
        
        // Create sprint indicator UI
        this.createSprintIndicatorUI();
        
        // Add inventory system
        this.inventory = new Inventory(this);
        
        // Interaction settings
        this.interactionDistance = 2.5;
        this.interactionRay = new THREE.Raycaster();
        this.nearestInteractable = null;

        // Add perk system
        this.perkSystem = new PerkSystem(this);
        
        // Fast reload perk
        this.fastReloadActive = false;
        this.superFastReloadActive = false;
        this.killsWithoutDamage = 0;
        this.requiredKillsForFastReload = 6;
        this.requiredKillsForSuperFastReload = 6; // Changed from 12 to 6 additional kills after stage 1
        this.killsAfterStage1 = 0; // Track kills after unlocking stage 1
        
        // Perk timer system
        this.perkTimers = {};
        this.perkMinimumDuration = 30000; // 30 seconds in milliseconds
        this.perkActivationTime = {};

        // Initialize game over handler
        this.gameOver = new GameOver(this);
    }
    
    setupEventListeners() {
        // Pointer lock controls
        this.domElement.addEventListener('click', () => {
            this.controls.lock();
        });
        
        // Movement controls
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
        
        // Prompt box for special features
        this.promptBox = null;
        this.isPromptVisible = false;
        
        // Add event listener for the = key to show the prompt box
        document.addEventListener('keydown', (event) => {
            if (event.key === '=') {
                event.preventDefault(); // Prevent the = character from being added to the input
                this.togglePromptBox();
            }
        });
    }
    
    onKeyDown(event) {
        // Process keyboard input
        switch(event.code) {
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
                    this.jump();
                }
                break;
            case 'ShiftLeft':
                this.activateSprint();
                break;
            case 'KeyC':
                // Only handle crouch if player is alive
                if (this.health > 0) {
                    this.startCrouch();
                }
                break;
            case 'KeyT':
                // Trigger slide if sprinting and not already sliding
                if (this.health > 0 && this.isSprinting && !this.isSliding && !this.isCrouching && !this.slideCooldown) {
                    this.startSlide();
                }
                break;
            case 'KeyE':
                // Check for crate interaction first
                if (this.nearestInteractable && this.nearestInteractable.userData.type === 'crate') {
                    // Cancel any ongoing reload
                    if (this.weaponSystem && this.weaponSystem.isReloading) {
                        this.weaponSystem.cancelReload();
                    }
                    // Handle crate interaction
                    this.interact();
                }
                break;
            case 'KeyQ':
                // Q key for using medikit
                if (this.inventory) {
                    this.inventory.useSelectedItem();
                }
                break;
        }
    }
    
    onKeyUp(event) {
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
            case 'ShiftLeft':
                // Only deactivate if still actively sprinting (not after timer ended)
                if (this.isSprinting) {
                    this.deactivateSprint();
                }
                break;
            case 'KeyC':
                // Only handle crouch release if player is alive and currently crouching
                if (this.health > 0 && this.isCrouching) {
                    this.endCrouch();
                }
                break;
        }
    }
    
    jump() {
        // Removed the check for this.canJump here, it's checked in onKeyDown
        // Apply jump force to the player's rigid body
        const playerBody = this.physicsWorld.getPlayerBody();
        if (playerBody) {
            // If crouching, end crouch first
            if (this.isCrouching) {
                this.endCrouch();
            }

            const jumpImpulse = { x: 0.0, y: this.jumpForce, z: 0.0 };
            playerBody.applyImpulse(jumpImpulse, true);
            this.canJump = false; // Prevent immediate re-jump until grounded check passes
            
            // Play random jump sound with panning and reverb
            if (this.jumpSounds && this.jumpSounds.length > 0) {
                // Get random jump sound from array
                const soundFile = this.jumpSounds[Math.floor(Math.random() * this.jumpSounds.length)];
                
                // Create random pan between -0.3 and 0.3
                const pan = (Math.random() * 0.6) - 0.3;
                
                // Setup audio options
                const options = {
                    playbackRate: 1.0,
                    type: 'jump',
                    pan: pan,
                    volume: 0.4,
                    reverb: 0.12 + (Math.random() * 0.08) // 0.12-0.2 reverb
                };
                
                // Play jump sound
                this.audioManager.playFootstepSound(soundFile, options);
            }
            
            // Cancel slide if player is sliding when they jump
            if (this.isSliding) {
                console.log("Jump during slide - cancelling slide");
                this.endSlide();
                
                // Start sprint bar regeneration if it was depleted during the slide
                if (this.getSprintBarPercentage() < 100) {
                    this.startSprintRefill();
                }
            }
            
            // If player is sprinting when they jump, deplete sprint bar and start cooldown
            if (this.isSprinting) {
                console.log("Jump during sprint - depleting sprint bar");
                
                // Clear any existing sprint update interval
                if (this.sprintUpdateInterval) {
                    clearInterval(this.sprintUpdateInterval);
                    this.sprintUpdateInterval = null;
                }
                
                // Set sprint bar to 0
                this.sprintBar.style.width = "0%";
                this.sprintBar.style.backgroundColor = '#ff0000'; // Red
                
                // End sprint state
                this.isSprinting = false;
                this.canSprint = false;
                this.sprintCooldown = true;
                
                // Start sprint refill process
                this.startSprintRefill();
            }
        }
        // Removed setTimeout for resetting canJump
    }
    
    createSprintIndicatorUI() {
        // Container for sprint indicator
        this.sprintContainer = document.createElement('div');
        this.sprintContainer.style.position = 'absolute';
        this.sprintContainer.style.bottom = '20px';
        this.sprintContainer.style.right = '20px';
        this.sprintContainer.style.width = '150px';
        this.sprintContainer.style.height = '20px';
        this.sprintContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.sprintContainer.style.borderRadius = '5px';
        
        // Sprint bar fill
        this.sprintBar = document.createElement('div');
        this.sprintBar.style.width = '100%';
        this.sprintBar.style.height = '100%';
        this.sprintBar.style.backgroundColor = 'rgba(60, 179, 113, 0.7)'; // Green color
        this.sprintBar.style.borderRadius = '5px';
        this.sprintBar.style.transition = 'width 0.1s ease-out';
        
        // Sprint label
        this.sprintLabel = document.createElement('div');
        this.sprintLabel.textContent = 'SPRINT';
        this.sprintLabel.style.position = 'absolute';
        this.sprintLabel.style.top = '0';
        this.sprintLabel.style.left = '0';
        this.sprintLabel.style.width = '100%';
        this.sprintLabel.style.height = '100%';
        this.sprintLabel.style.display = 'flex';
        this.sprintLabel.style.justifyContent = 'center';
        this.sprintLabel.style.alignItems = 'center';
        this.sprintLabel.style.color = 'white';
        this.sprintLabel.style.fontFamily = 'Arial, sans-serif';
        this.sprintLabel.style.fontSize = '12px';
        this.sprintLabel.style.fontWeight = 'bold';
        
        // Add elements to the DOM
        this.sprintContainer.appendChild(this.sprintBar);
        this.sprintContainer.appendChild(this.sprintLabel);
        document.body.appendChild(this.sprintContainer);
        
        // Initialize sprint indicator state
        this.updateSprintIndicator(100);
    }
    
    updateSprintIndicator(percentage) {
        if (this.sprintBar) {
            this.sprintBar.style.width = `${percentage}%`;
            
            // Change color based on state
            if (this.sprintCooldown) {
                this.sprintBar.style.backgroundColor = 'rgba(220, 20, 60, 0.7)'; // Red during cooldown
            } else if (this.isSprinting) {
                this.sprintBar.style.backgroundColor = 'rgba(255, 215, 0, 0.7)'; // Gold when active
            } else {
                this.sprintBar.style.backgroundColor = 'rgba(60, 179, 113, 0.7)'; // Green when available
            }
        }
    }

    activateSprint() {
        if (!this.canSprint || this.sprintCooldown || this.isSliding || this.isCrouching) {
            return;
        }

        this.isSprinting = true;
        this.canSprint = false;
        this.sprintStartTime = Date.now();
        
        // Get the current sprint percentage and adjust start time based on current percentage
        const currentPercentage = this.getSprintBarPercentage();
        if (currentPercentage < 100) {
            // Adjust start time to account for already depleted sprint bar
            const elapsedTimeFromPercentage = (1 - (currentPercentage / 100)) * this.sprintDuration;
            this.sprintStartTime = Date.now() - elapsedTimeFromPercentage;
        }
        
        this.sprintBar.style.display = 'block';
        this.sprintBar.style.backgroundColor = '#00ff00'; // Green when starting

        // Clear any existing refill interval
        if (this.sprintRefillInterval) {
            clearInterval(this.sprintRefillInterval);
            this.sprintRefillInterval = null;
        }

        // Create a single update function for the sprint bar
        const updateSprintBar = () => {
            if (!this.isSprinting) {
                return;
            }

            const elapsedTime = Date.now() - this.sprintStartTime;
            const remainingTime = Math.max(0, this.sprintDuration - elapsedTime);
            const percentage = (remainingTime / this.sprintDuration) * 100;

            // Update sprint bar
            this.sprintBar.style.width = `${percentage}%`;
            
            // Change color based on remaining stamina
            if (percentage > 66) {
                this.sprintBar.style.backgroundColor = '#00ff00'; // Green for high stamina
            } else if (percentage > 33) {
                this.sprintBar.style.backgroundColor = '#ffa500'; // Orange for medium stamina
            } else {
                this.sprintBar.style.backgroundColor = '#ff0000'; // Red for low stamina
            }

            // Check if sprint has ended
            if (remainingTime <= 0) {
                this.isSprinting = false;
                this.sprintCooldown = true;
                this.canSprint = false; // Can't sprint again until cooldown is over
                this.sprintBar.style.backgroundColor = '#ff0000'; // Red during cooldown
                
                // Start refilling the sprint bar
                this.startSprintRefill();
            }
        };

        // Update sprint bar every frame
        this.sprintUpdateInterval = setInterval(updateSprintBar, 16); // ~60fps
    }

    deactivateSprint() {
        if (!this.isSprinting) {
            return;
        }

        this.isSprinting = false;
        clearInterval(this.sprintUpdateInterval);
        
        // Set canSprint to true when deactivating sprinting
        // This allows player to sprint again from current stamina level
        this.canSprint = true;
        
        // Start refilling the sprint bar
        this.startSprintRefill();
    }
    
    // New method to handle sprint mechanics
    handleSprintMechanics() {
        // Get current sprint percentage
        const sprintPercentage = this.getSprintBarPercentage();
        
        // If sprint bar is at 0%, revert to normal speed
        if (sprintPercentage <= 0) {
            // Only change state if we were sprinting
            if (this.isSprinting) {
                console.log("Sprint depleted - reverting to normal speed");
                this.isSprinting = false;
                this.sprintCooldown = true;
                this.canSprint = false; // Can't sprint again until cooldown is over
                
                // Clear any existing sprint update interval
                if (this.sprintUpdateInterval) {
                    clearInterval(this.sprintUpdateInterval);
                    this.sprintUpdateInterval = null;
                }
                
                // Start refilling the sprint bar
                this.startSprintRefill();
            }
        }
    }
    
    // New method to start refilling the sprint bar
    startSprintRefill() {
        // Clear any existing refill interval
        if (this.sprintRefillInterval) {
            clearInterval(this.sprintRefillInterval);
        }
        
        // Get current sprint percentage
        const currentPercentage = this.getSprintBarPercentage();
        
        // If already at 100%, reset sprint state and allow fresh start
        if (currentPercentage >= 100) {
            this.canSprint = true;
            this.sprintCooldown = false;
            return;
        }
        
        // Calculate how much to increment per frame to refill in 1 second
        const incrementPerFrame = (100 - currentPercentage) / 60;
        
        // Set up refill interval
        this.sprintRefillInterval = setInterval(() => {
            const currentPercentage = this.getSprintBarPercentage();
            const newPercentage = Math.min(100, currentPercentage + incrementPerFrame);
            
            // Update sprint bar
            this.sprintBar.style.width = `${newPercentage}%`;
            
            // Change color based on remaining stamina
            if (newPercentage > 66) {
                this.sprintBar.style.backgroundColor = '#00ff00'; // Green
            } else if (newPercentage > 33) {
                this.sprintBar.style.backgroundColor = '#ffa500'; // Orange
            } else {
                this.sprintBar.style.backgroundColor = '#ff0000'; // Red
            }
            
            // If fully refilled, clear interval and update sprint cooldown state
            if (newPercentage >= 100) {
                clearInterval(this.sprintRefillInterval);
                this.sprintRefillInterval = null;
                this.canSprint = true;
                this.sprintCooldown = false;
            }
        }, 16); // Update every frame
    }

    update(deltaTime) {
        if (this.controls.isLocked) {
            // Check if player is grounded
            this.canJump = this.physicsWorld.isPlayerGrounded();

            // Get movement direction from camera
            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();
            
            // Handle sprint mechanics
            this.handleSprintMechanics();
            
            // Apply movement to the player's rigid body
            const playerBody = this.physicsWorld.getPlayerBody();
            if (playerBody) {
                // Get camera direction vectors
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                
                // Calculate forward and right vectors
                const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
                const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
                
                // Handle sliding motion
                if (this.isSliding) {
                    this.handleSlideMotion(playerBody);
                } 
                // Normal movement
                else {
                    // Calculate movement direction based on camera orientation
                    const moveDirection = new THREE.Vector3();
                    
                    // Forward/backward movement
                    if (this.moveForward) moveDirection.add(forward);
                    if (this.moveBackward) moveDirection.sub(forward);
                    
                    // Left/right movement
                    if (this.moveRight) moveDirection.add(right);
                    if (this.moveLeft) moveDirection.sub(right);
                    
                    // Normalize and apply speed
                    if (moveDirection.length() > 0) {
                        moveDirection.normalize();
                        
                        // Calculate current move speed
                        let currentMoveSpeed = this.moveSpeed;
                        
                        // Only apply sprint multiplier if actively sprinting and not in cooldown
                        if (this.isSprinting && !this.sprintCooldown) {
                            // Get current sprint percentage
                            const sprintPercentage = this.getSprintBarPercentage();
                            
                            // Apply different sprint multipliers based on sprint bar level
                            if (sprintPercentage > 66) {
                                // Full sprint speed (green bar)
                                currentMoveSpeed *= this.sprintMultiplier;
                            } else if (sprintPercentage > 33) {
                                // 80% sprint speed (yellow/orange bar)
                                currentMoveSpeed *= this.sprintMultiplier * 0.8;
                            } else {
                                // 60% sprint speed (red bar)
                                currentMoveSpeed *= this.sprintMultiplier * 0.6;
                            }
                        }
                        
                        // Reduce speed when crouching
                        if (this.isCrouching) {
                            currentMoveSpeed *= 0.6; // 60% of normal speed when crouched
                        }
                        
                        // Apply direct velocity for instant response (Call of Duty style)
                        const currentVelocity = playerBody.linvel();
                        const targetVelocity = new THREE.Vector3(
                            moveDirection.x * currentMoveSpeed * 1.05,
                            currentVelocity.y,
                            moveDirection.z * currentMoveSpeed * 1.05
                        );
                        
                        // Set velocity directly for instant response
                        playerBody.setLinvel(targetVelocity, true);
                        playerBody.wakeUp(); // Ensure the body is active
                    } else {
                        // Instant stop when no movement keys are pressed
                        const currentVelocity = playerBody.linvel();
                        playerBody.setLinvel(new THREE.Vector3(0, currentVelocity.y, 0), true);
                        playerBody.wakeUp(); // Ensure the body is active
                    }
                }
                
                // Update camera position to follow player
                const position = playerBody.translation();
                const cameraPos = new THREE.Vector3(position.x, position.y + this.playerHeight, position.z);
                
                this.camera.position.copy(cameraPos);

                // Update the player representation position
                this.player.mesh.position.set(position.x, position.y, position.z);

                // Get current velocity for footstep sounds
                const velocity = playerBody.linvel();
                const horizontalVelocity = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
                
                // Play footstep sounds if moving and grounded
                if (this.canJump && horizontalVelocity > this.footstepVelocityThreshold && !this.isSliding) {
                    this.handleFootstepSounds(horizontalVelocity);
                }
            }
        }

        // Check for nearby interactable objects
        this.checkInteractables();
    }
    
    lock() {
        this.controls.lock();
    }
    
    unlock() {
        this.controls.unlock();
    }

    // ADD BACK createHealthBarUI() method
    createHealthBarUI() {
        // Health Bar Container
        this.healthBarContainer = document.createElement('div');
        this.healthBarContainer.style.position = 'fixed';
        this.healthBarContainer.style.top = '20px';
        this.healthBarContainer.style.right = '20px';
        this.healthBarContainer.style.width = '200px';
        this.healthBarContainer.style.height = '25px';
        this.healthBarContainer.style.border = '2px solid #444'; 
        this.healthBarContainer.style.backgroundColor = '#222'; 
        this.healthBarContainer.style.borderRadius = '5px';
        this.healthBarContainer.style.overflow = 'hidden';
        this.healthBarContainer.style.zIndex = '1001'; 
        this.healthBarContainer.style.fontFamily = '"Creepster", sans-serif'; // Use fallback
        
        // Health Bar Foreground
        this.healthBarFill = document.createElement('div');
        this.healthBarFill.style.height = '100%';
        this.healthBarFill.style.width = '100%'; 
        this.healthBarFill.style.backgroundColor = '#228B22'; // Forest Green (Start Green)
        this.healthBarFill.style.transition = 'width 0.3s ease-in-out'; 
        this.healthBarContainer.appendChild(this.healthBarFill);
        
        // Health Text
        this.healthText = document.createElement('div');
        this.healthText.style.position = 'absolute';
        this.healthText.style.top = '0';
        this.healthText.style.left = '0';
        this.healthText.style.width = '100%';
        this.healthText.style.height = '100%';
        this.healthText.style.color = '#CCCCCC'; 
        this.healthText.style.textAlign = 'center';
        this.healthText.style.lineHeight = '25px'; 
        this.healthText.style.fontSize = '16px';
        this.healthText.style.textShadow = '1px 1px 2px black'; 
        this.healthText.textContent = `${this.health} / ${this.maxHealth}`;
        this.healthBarContainer.appendChild(this.healthText);

        document.body.appendChild(this.healthBarContainer);
    }

    // ADD BACK updateHealthBarUI() method
    updateHealthBarUI() {
        if (!this.healthBarFill || !this.healthText) return;
        
        const healthPercent = (this.health / this.maxHealth) * 100;
        this.healthBarFill.style.width = `${healthPercent}%`;
        
        // Set health bar color based on health percentage
        if (healthPercent > 70) {
            this.healthBarFill.style.backgroundColor = '#4CAF50'; // Green for healthy
        } else if (healthPercent > 30) {
            this.healthBarFill.style.backgroundColor = '#FF9800'; // Orange for warning
        } else {
            this.healthBarFill.style.backgroundColor = '#F44336'; // Red for critical
        }
        
        // Update health text with rounded value
        this.healthText.textContent = `${Math.round(this.health)}/${this.maxHealth}`;
    }

    // ADD BACK Player takes damage method
    takeDamage(amount) {
        // Don't take damage if already dead or in god mode
        if (this.health <= 0 || this.godMode) {
            return;
        }
        
        // Apply damage
        this.health -= amount;
        
        // Ensure health doesn't go below 0
        if (this.health < 0) {
            this.health = 0;
        }
        
        // Reset consecutive headshots if weapon system exists
        if (this.weaponSystem && typeof this.weaponSystem.resetHeadshotStreak === 'function') {
            this.weaponSystem.resetHeadshotStreak();
        }
        
        // Reset kills without damage counter
        if (this.killsWithoutDamage > 0) {
            console.log(`Kills without damage reset: ${this.killsWithoutDamage} -> 0`);
            this.killsWithoutDamage = 0;
        }
        
        // Reset fast reload perk progress
        this.killsWithoutDamage = 0;
        this.killsAfterStage1 = 0;
        
        // Check if fast reload perk should be removed
        if (this.fastReloadActive) {
            const activationTime = this.perkActivationTime['fast-reload'];
            const currentTime = Date.now();
            const elapsedTime = currentTime - activationTime;
            
            // Only remove the perk if the minimum duration has elapsed
            if (activationTime && elapsedTime >= this.perkMinimumDuration) {
                console.log(`Removing fast reload perk after ${elapsedTime}ms (minimum duration: ${this.perkMinimumDuration}ms)`);
                this.removeFastReloadPerk();
            } else {
                console.log(`Not removing fast reload perk yet (elapsed: ${elapsedTime}ms, minimum: ${this.perkMinimumDuration}ms)`);
            }
        }
        
        // Update health bar UI
        this.updateHealthBarUI();
        
        // Show damage effect
        this.triggerDamageFeedback();
        
        // Check if player is dead
        if (this.health <= 0) {
            this.gameOver.die();
        }
        
        // DO NOT reset sprint bar when taking damage
        // The sprint bar should continue depleting at its normal rate
    }

    // ADD BACK Visual/Audio feedback for taking damage method
    triggerDamageFeedback() {
        // Play damage sound
        if (this.audioManager && this.damageSoundFiles.length > 0) {
            const randomSoundIndex = Math.floor(Math.random() * this.damageSoundFiles.length);
            const soundFile = this.damageSoundFiles[randomSoundIndex];
            this.audioManager.playOneShot(soundFile)
                .catch(error => console.error("Error playing player damage sound:", error));
        }
        
        // 1. Screen Flash (Red Overlay)
        
        // Create overlay element
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1000';
        document.body.appendChild(overlay);
        
        // 2. Camera Shake
        let shakeTimer = 0;
        const shakeDuration = 0.4; // seconds
        const shakeIntensity = 0.05; // how much to shake
        
        const shakeUpdate = () => {
             if (shakeTimer < shakeDuration && this.health > 0) { // Stop shake if dead
                 const shakeX = (Math.random() - 0.5) * shakeIntensity;
                 const shakeY = (Math.random() - 0.5) * shakeIntensity;
                 const currentPos = this.physicsWorld.getPlayerBody().translation();
                 this.camera.position.set(currentPos.x + shakeX, currentPos.y + this.playerHeight + shakeY, currentPos.z);
                 shakeTimer += 1 / 60; 
                 requestAnimationFrame(shakeUpdate);
             } else if (this.health > 0) {
                 // Reset position after shake (only if alive)
                 const finalPos = this.physicsWorld.getPlayerBody().translation();
                 this.camera.position.set(finalPos.x, finalPos.y + this.playerHeight, finalPos.z);
             }
         };
         if (this.health > 0) requestAnimationFrame(shakeUpdate);

        // Remove overlay after duration
        const removeOverlay = () => {
            if (document.body.contains(overlay)) {
                 document.body.removeChild(overlay);
            }
        };
        setTimeout(removeOverlay, this.damageEffectDuration);
    }

    checkInteractables() {
        if (!this.player || !this.camera) return;
        
        // Get player position
        const playerPosition = this.player.mesh.position.clone();
        
        // Set raycaster from camera
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        this.interactionRay.set(this.camera.position, direction);
        
        // Find all interactable objects in the scene
        let nearestObject = null;
        let shortestDistance = this.interactionDistance;
        
        // Find objects tagged as interactable
        this.physicsWorld.scene.traverse((object) => {
            if (object.userData && object.userData.isInteractable) {
                // Check distance to player
                const distance = playerPosition.distanceTo(object.position);
                
                if (distance < shortestDistance) {
                    nearestObject = object;
                    shortestDistance = distance;
                }
            }
        });
        
        // Show/hide interaction prompts
        if (this.nearestInteractable && this.nearestInteractable !== nearestObject) {
            // Hide previous prompt
            if (this.nearestInteractable.userData.instance && 
                typeof this.nearestInteractable.userData.instance.hideInteractionPrompt === 'function') {
                this.nearestInteractable.userData.instance.hideInteractionPrompt();
            }
        }
        
        this.nearestInteractable = nearestObject;
        
        if (this.nearestInteractable) {
            // Show prompt
            if (this.nearestInteractable.userData.instance && 
                typeof this.nearestInteractable.userData.instance.showInteractionPrompt === 'function') {
                this.nearestInteractable.userData.instance.showInteractionPrompt();
            }
        }
    }

    interact() {
        if (!this.nearestInteractable) return;
        
        const interactable = this.nearestInteractable;
        
        // Check if it's a crate
        if (interactable.userData.type === 'crate' && interactable.userData.instance) {
            const item = interactable.userData.instance.interact();
            
            if (item) {
                // Add item to inventory
                this.inventory.addItem(item);
            }
        }
    }

    // Crouch mechanics
    startCrouch() {
        // Regular crouch
        if (!this.isCrouching) {
            this.isCrouching = true;
            this.playerHeight = this.crouchHeight;
            
            // Play crouch sound
            if (this.audioManager) {
                this.audioManager.playOneShot(this.crouchSound)
                    .catch(error => console.error("Error playing crouch sound:", error));
            }
            
            // Adjust player collider
            this.updatePlayerCollider();
            
            console.log("Player crouched");
        }
    }
    
    endCrouch() {
        // Regular uncrouch
        if (this.isCrouching) {
            this.isCrouching = false;
            this.playerHeight = this.normalHeight;
            
            // Play crouch sound again for standing up
            if (this.audioManager) {
                this.audioManager.playOneShot(this.crouchSound)
                    .catch(error => console.error("Error playing stand sound:", error));
            }
            
            // Adjust player collider
            this.updatePlayerCollider();
            
            console.log("Player stood up");
        }
    }
    
    updatePlayerCollider() {
        // This method adjusts the player's physics collider when crouching/standing
        const playerBody = this.physicsWorld.getPlayerBody();
        if (!playerBody) return;
        
        // Remove the old collider
        if (this.physicsWorld.playerCollider) {
            this.physicsWorld.world.removeCollider(this.physicsWorld.playerCollider, true);
        }
        
        // Determine collider size based on crouch state
        const radius = 0.5; // Keep radius the same
        const halfHeight = this.isCrouching ? 0.25 : 0.5; // Half height when crouched
        
        // Create new collider
        const colliderDesc = this.physicsWorld.RAPIER.ColliderDesc.capsule(radius, halfHeight)
            .setTranslation(0.0, halfHeight + 0.1, 0.0) // Adjust offset based on new size
            .setFriction(0.1)
            .setRestitution(0.0)
            .setDensity(1.0);
            
        // Set collision groups (same as original)
        const GROUP_DEFAULT = 0;
        const GROUP_ALL = -1;
        colliderDesc.setCollisionGroups((GROUP_DEFAULT << 16) | GROUP_ALL)
                    .setSolverGroups((GROUP_DEFAULT << 16) | GROUP_ALL);
                    
        // Create the new collider
        this.physicsWorld.playerCollider = this.physicsWorld.world.createCollider(colliderDesc, playerBody);
        this.physicsWorld.playerCollider.userData = { type: 'player' };
        
        // Only update wireframe if debug visualization is enabled (checking if it already exists)
        if (this.physicsWorld.playerWireframe) {
            // Remove old wireframe from scene
            if (this.physicsWorld.scene && this.physicsWorld.scene.children.includes(this.physicsWorld.playerWireframe)) {
                this.physicsWorld.scene.remove(this.physicsWorld.playerWireframe);
                
                // Properly dispose of geometry and materials to prevent memory leaks
                if (this.physicsWorld.playerWireframe.geometry) {
                    this.physicsWorld.playerWireframe.geometry.dispose();
                }
                if (this.physicsWorld.playerWireframe.material) {
                    this.physicsWorld.playerWireframe.material.dispose();
                }
            }
            
            // Create new wireframe with updated dimensions
            const capsuleGeometry = new THREE.CapsuleGeometry(radius, halfHeight * 2, 4, 8);
            const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                wireframe: true,
                transparent: true,
                opacity: 0.0 // Changed from 0.3 to 0.0 to make wireframe completely invisible
            });
            const wireframeMesh = new THREE.Mesh(capsuleGeometry, wireframeMaterial);
            wireframeMesh.position.y = halfHeight + 0.1; // Match the collider's offset
            wireframeMesh.visible = false; // Explicitly set wireframe to be invisible
            
            // Update the reference to the new wireframe
            this.physicsWorld.playerWireframe = wireframeMesh;
            
            // Only add to scene if we have a valid scene reference
            if (this.physicsWorld.scene) {
                this.physicsWorld.scene.add(wireframeMesh);
            }
        }
    }

    // Reset method
    cleanup() {
        // Reset crouch state
        if (this.isCrouching) {
            this.isCrouching = false;
            this.playerHeight = this.normalHeight;
        }
        
        // Reset slide state
        if (this.isSliding) {
            this.isSliding = false;
            this.playerHeight = this.normalHeight;
            
            // Clear slide timer
            if (this.slideTimer) {
                clearTimeout(this.slideTimer);
                this.slideTimer = null;
            }
        }
        
        // Reset FOV to normal
        if (this.camera) {
            this.camera.fov = 75; // Default FOV value
            this.camera.updateProjectionMatrix();
        }
        
        // Log cleanup
        console.log("Player controller cleanup: reset crouch and slide states");
    }

    // Start slide movement
    startSlide() {
        if (this.isSliding) return;
        
        console.log("Player sliding");
        this.isSliding = true;
        
        // Smooth transition to slide height
        this.smoothHeightTransition(this.normalHeight, this.slideHeight, 150);
        
        // Get the player's current position
        const playerBody = this.physicsWorld.getPlayerBody();
        if (!playerBody) return;
        
        const position = playerBody.translation();
        this.slideStartPosition.set(position.x, position.y, position.z);
        
        // Reset slide progress
        this.slideProgress = 0;
        
        // Store the slide direction (based on camera facing direction)
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        this.slideDirection.set(cameraDirection.x, 0, cameraDirection.z).normalize();
        
        // Play slide sound
        if (this.audioManager) {
            // Play initial sandpaper slide sound
            this.audioManager.playOneShot(this.slideSound, {
                playbackRate: 0.5,  // One octave lower
                volume: 0.8
            })
            .catch(error => console.error("Error playing slide sound:", error));
            
            // Start white noise that continues for the slide duration
            this.slideWhiteNoiseSource = this.audioManager.playWhiteNoise({
                volume: 0.11,  // Reduced by another 10% from 0.12 to 0.11
                fadeIn: 100,  // Short fade in (ms)
                pan: 0,       // Center channel
                type: 'slide_noise'
            });
        }
        
        // Update player collider for sliding
        this.updatePlayerCollider();
        
        // Only use sprint stamina if already sprinting
        if (this.isSprinting) {
            // Calculate how much sprint stamina to use for the slide
            const slideStaminaCost = this.sprintDuration * 0.3; // 30% of sprint stamina
            
            // If we have enough stamina, use it
            if (this.getSprintBarPercentage() > 0) {
                // Start a timer to deplete sprint stamina during the slide
                this.slideStaminaTimer = setInterval(() => {
                    const currentPercentage = this.getSprintBarPercentage();
                    const newPercentage = Math.max(0, currentPercentage - 1);
                    
                    // Update sprint bar
                    this.sprintBar.style.width = `${newPercentage}%`;
                    
                    // Change color based on remaining stamina
                    if (newPercentage > 66) {
                        this.sprintBar.style.backgroundColor = '#00ff00'; // Green
                    } else if (newPercentage > 33) {
                        this.sprintBar.style.backgroundColor = '#ffa500'; // Orange
                    } else {
                        this.sprintBar.style.backgroundColor = '#ff0000'; // Red
                    }
                    
                    // If stamina is depleted, end the slide
                    if (newPercentage <= 0) {
                        this.endSlide();
                    }
                }, 16); // Update every frame
            } else {
                // Not enough stamina, end the slide immediately
                this.endSlide();
                return;
            }
        }
        
        // Set timer to end slide
        this.slideTimer = setTimeout(() => {
            this.endSlide();
        }, this.slideDuration);
    }

    // End slide movement
    endSlide() {
        if (!this.isSliding) return;
        
        console.log("Player slide ended");
        this.isSliding = false;
        
        // Stop white noise sound for slide (should already be faded to near-zero by now)
        if (this.slideWhiteNoiseSource && this.audioManager) {
            // Just stop the sound immediately since it should be nearly silent already
            this.audioManager.stopSound(this.slideWhiteNoiseSource);
            this.slideWhiteNoiseSource = null;
        }
        
        // Clear slide stamina timer if it exists
        if (this.slideStaminaTimer) {
            clearInterval(this.slideStaminaTimer);
            this.slideStaminaTimer = null;
        }
        
        // Smooth height transition
        this.smoothHeightTransition(this.slideHeight, this.normalHeight, 250);
        
        // Update player collider (will be called again after height transition completes)
        this.updatePlayerCollider();
        
        // Clear slide timer
        if (this.slideTimer) {
            clearTimeout(this.slideTimer);
            this.slideTimer = null;
        }
        
        // Check if sprint bar is empty and apply 2x penalty to slide cooldown if it is
        if (this.sprintTimer && this.isSprinting) {
            const sprintBarPercentage = this.getSprintBarPercentage();
            if (sprintBarPercentage <= 0) {
                console.log("Sprint bar empty - applying 2x penalty to slide cooldown");
                // Apply 2x penalty to slide cooldown
                this.slideCooldown = true;
                this.slideCooldownDuration = 2000; // 2 seconds cooldown (2x normal)
                
                // Set a timer to end the slide cooldown
                setTimeout(() => {
                    this.slideCooldown = false;
                }, this.slideCooldownDuration);
            }
        }
        
        // If not sprinting and stamina was used, start refilling
        if (!this.isSprinting && this.slideStaminaTimer) {
            this.startSprintRefill();
        }
    }
    
    // Helper method to get current sprint bar percentage
    getSprintBarPercentage() {
        // If we have a sprint timer, calculate based on elapsed time
        if (this.sprintTimer) {
            const startTime = this.sprintStartTime || Date.now();
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, this.sprintDuration - elapsed);
            return (remaining / this.sprintDuration) * 100;
        }
        
        // If we're in the process of refilling, calculate based on the current width
        if (this.sprintBar && this.sprintBar.style.width) {
            // Extract the percentage from the width style (e.g., "50%" -> 50)
            const widthStr = this.sprintBar.style.width;
            const percentage = parseFloat(widthStr);
            return isNaN(percentage) ? 0 : percentage;
        }
        
        // Default to 0 if we can't determine the percentage
        return 0;
    }

    // Smooth transition for player height
    smoothHeightTransition(startHeight, endHeight, duration) {
        const startTime = Date.now();
        const heightDiff = endHeight - startHeight;
        
        const updateHeight = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1.0, elapsed / duration);
            
            // Smooth easing function
            const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
            
            // Update player height with easing
            this.playerHeight = startHeight + heightDiff * easedProgress;
            
            // Update player collider to match new height
            this.updatePlayerCollider();
            
            // Continue animation if not complete
            if (progress < 1.0) {
                requestAnimationFrame(updateHeight);
            }
        };
        
        // Start the animation
        requestAnimationFrame(updateHeight);
    }

    // New method to record an enemy kill and track kill streak
    recordKill() {
        this.killStreak++;
        console.log(`Kill streak: ${this.killStreak}`);
        
        // Track kills without taking damage for fast reload perk
        this.killsWithoutDamage++;
        console.log(`Kills without damage: ${this.killsWithoutDamage}/${this.requiredKillsForFastReload}`);
        
        // Check if player has earned the fast reload perk (stage 1)
        if (this.killsWithoutDamage >= this.requiredKillsForFastReload && !this.fastReloadActive) {
            console.log("Unlocking stage 1 (fast reload)");
            this.unlockFastReloadPerk();
        }
        // Check if player has earned the super fast reload perk (stage 2)
        else if (this.fastReloadActive && !this.superFastReloadActive) {
            // Increment kills after stage 1
            this.killsAfterStage1++;
            console.log(`Kills after stage 1: ${this.killsAfterStage1}/${this.requiredKillsForSuperFastReload}`);
            
            // Check if player has earned enough additional kills for stage 2
            if (this.killsAfterStage1 >= this.requiredKillsForSuperFastReload) {
                console.log("Unlocking stage 2 (super fast reload)");
                this.unlockSuperFastReloadPerk();
            }
        }
        
        // Check if we reached the required streak for health boost
        if (this.killStreak >= this.killsForHealthBoost) {
            // Apply health boost
            const oldHealth = this.health;
            this.health = Math.min(this.maxHealth, this.health + this.healthBoostAmount);
            
            console.log(`KILL STREAK BONUS! Health boosted: ${oldHealth} -> ${this.health}`);
            
            // Show health boost message
            this.showHealthBoostMessage();
            
            // Play health boost sound
            if (this.audioManager) {
                this.audioManager.playOneShot('assets/sounds/CoinFlipTossRing_S08FO.689.wav')
                    .catch(error => console.error("Error playing health boost sound:", error));
            }
            
            // Reset kill streak after applying bonus
            this.killStreak = 0;
            
            // Update health bar UI
            this.updateHealthBarUI();
        }
    }
    
    // Display a temporary message for health boost
    showHealthBoostMessage() {
        // Create health boost message
        const message = document.createElement('div');
        message.textContent = `+${this.healthBoostAmount} HEALTH BONUS!`;
        message.style.position = 'fixed';
        message.style.top = '50px'; // Position it below the health bar which is at top: 20px
        message.style.right = '20px'; // Align with the health bar's right position
        message.style.color = '#00ff00';
        message.style.fontFamily = '"Creepster", "Chiller", cursive';
        message.style.fontSize = '20px'; // Slightly smaller than before
        message.style.textShadow = '2px 2px 4px #000000';
        message.style.zIndex = '1000';
        message.style.pointerEvents = 'none';
        message.style.transition = 'opacity 0.5s ease-in-out';
        message.style.opacity = '0';
        message.style.textAlign = 'right'; // Align text to the right
        message.style.width = '200px'; // Match the width of health bar
        
        // Add to document
        document.body.appendChild(message);
        
        // Animate in
        setTimeout(() => {
            message.style.opacity = '1';
        }, 10);
        
        // Animate out and remove
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(message)) {
                    document.body.removeChild(message);
                }
            }, 500);
        }, 2000);
    }

    // Method to unlock a perk
    unlockPerk(perkType) {
        if (this.perkSystem) {
            const success = this.perkSystem.unlockPerk(perkType);
            
            if (success) {
                // Record the activation time
                this.perkActivationTime[perkType] = Date.now();
                
                // Clear any existing timer for this perk
                if (this.perkTimers[perkType]) {
                    clearTimeout(this.perkTimers[perkType]);
                    this.perkTimers[perkType] = null;
                }
                
                // Set a timer to mark the perk as "minimum duration elapsed"
                this.perkTimers[perkType] = setTimeout(() => {
                    console.log(`Minimum duration elapsed for ${perkType} perk`);
                    // The perk will now stay until the player takes damage
                }, this.perkMinimumDuration);
            }
            
            return success;
        }
        return false;
    }

    // Method to unlock the fast reload perk (Stage 1)
    unlockFastReloadPerk() {
        console.log("Fast reload perk unlocked (Stage 1)!");
        this.fastReloadActive = true;
        this.killsAfterStage1 = 0; // Reset kills after stage 1 counter
        
        // Add the perk to the UI
        if (this.perkSystem) {
            this.unlockPerk('fast-reload');
        }
        
        // Enable fast reload in weapon system
        if (this.weaponSystem) {
            this.weaponSystem.setFastReload(true, false);
        }
        
        // Set minimum duration timer
        this.perkTimers['fast-reload'] = setTimeout(() => {
            console.log("Fast reload minimum duration elapsed - will remain until damaged");
            // The perk will now stay until the player takes damage
        }, this.perkMinimumDuration);
    }
    
    // Method to unlock the super fast reload perk (Stage 2)
    unlockSuperFastReloadPerk() {
        console.log("Super fast reload perk unlocked (Stage 2)!");
        this.superFastReloadActive = true;
        
        // Update the weapon system with super fast reload
        if (this.weaponSystem) {
            this.weaponSystem.setFastReload(true, true);
        }
        
        // Update the perk UI to show the purple glow
        if (this.perkSystem) {
            // Find the index of the fast-reload perk
            const perkIndex = this.perkSystem.unlockedPerks.indexOf('fast-reload');
            if (perkIndex !== -1) {
                // Update the perk slot to show the purple glow
                this.perkSystem.updatePerkSlot(perkIndex, 'fast-reload');
                
                // Show the purple "PERK UNLOCKED" text for stage 2 upgrade
                this.perkSystem.showPerkUnlockedText('fast-reload', true);
            }
        }
        
        // Show upgrade message
        this.showMessage('Fast Reload Upgraded to Stage 2!', 'perk');
    }
    
    // Method to remove the fast reload perk
    removeFastReloadPerk() {
        console.log("Fast reload perk removed!");
        
        // Reset both stages
        this.fastReloadActive = false;
        this.superFastReloadActive = false;
        this.killsWithoutDamage = 0;
        this.killsAfterStage1 = 0;
        
        // Remove the perk from the UI
        if (this.perkSystem) {
            this.perkSystem.removePerk('fast-reload');
        }
        
        // Clear the timer if exists
        if (this.perkTimers['fast-reload']) {
            clearTimeout(this.perkTimers['fast-reload']);
            this.perkTimers['fast-reload'] = null;
        }
        
        // Reset the weapon system
        if (this.weaponSystem) {
            this.weaponSystem.setFastReload(false);
        }
    }

    // Toggle the prompt box
    togglePromptBox() {
        if (this.isPromptVisible) {
            this.hidePromptBox();
        } else {
            this.showPromptBox();
        }
    }
    
    // Show the prompt box
    showPromptBox() {
        if (this.promptBox) {
            this.promptBox.style.display = 'block';
            this.isPromptVisible = true;
            
            // Focus the input field if it exists
            const input = this.promptBox.querySelector('input');
            if (input) {
                input.focus();
            }
            return;
        }
        
        // Create prompt box
        this.promptBox = document.createElement('div');
        this.promptBox.style.position = 'fixed';
        this.promptBox.style.top = '50%';
        this.promptBox.style.left = '50%';
        this.promptBox.style.transform = 'translate(-50%, -50%)';
        this.promptBox.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.promptBox.style.color = 'white';
        this.promptBox.style.padding = '20px';
        this.promptBox.style.borderRadius = '10px';
        this.promptBox.style.fontFamily = 'Arial, sans-serif';
        this.promptBox.style.fontSize = '18px';
        this.promptBox.style.zIndex = '2000';
        this.promptBox.style.width = '300px';
        this.promptBox.style.textAlign = 'center';
        
        // Add title
        const title = document.createElement('div');
        title.textContent = 'Special Features';
        title.style.fontSize = '24px';
        title.style.marginBottom = '15px';
        title.style.fontWeight = 'bold';
        this.promptBox.appendChild(title);
        
        // Add input field
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter command...';
        input.style.width = '80%';
        input.style.padding = '8px';
        input.style.marginBottom = '15px';
        input.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        input.style.border = '1px solid #444';
        input.style.color = 'white';
        input.style.borderRadius = '5px';
        this.promptBox.appendChild(input);
        
        // Add instructions
        const instructions = document.createElement('div');
        instructions.textContent = 'Available commands: god1, god2, nogod';
        instructions.style.fontSize = '14px';
        instructions.style.marginBottom = '15px';
        instructions.style.color = '#aaa';
        this.promptBox.appendChild(instructions);
        
        // Add event listener for input
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const command = input.value.trim().toLowerCase();
                this.processCommand(command);
                input.value = '';
                this.hidePromptBox();
            } else if (event.key === 'Escape') {
                this.hidePromptBox();
            }
        });
        
        // Add to document
        document.body.appendChild(this.promptBox);
        this.isPromptVisible = true;
        
        // Focus input immediately
        input.focus();
    }
    
    // Hide the prompt box
    hidePromptBox() {
        if (this.promptBox) {
            this.promptBox.style.display = 'none';
            this.isPromptVisible = false;
        }
    }
    
    // Process commands entered in the prompt box
    processCommand(command) {
        switch (command) {
            case 'god1':
                // Unlock all perks at stage 1 and enable god mode
                this.unlockAllPerksStage1();
                this.godMode = true;
                this.showMessage('God Mode Stage 1 activated!', 'godmode');
                break;
            case 'god2':
                // Unlock all perks at stage 2 and enable god mode
                this.unlockAllPerksStage2();
                this.godMode = true;
                this.showMessage('God Mode Stage 2 activated!', 'godmode');
                break;
            case 'nogod':
                // Deactivate god mode
                this.deactivateGodMode();
                break;
            default:
                console.log(`Unknown command: ${command}`);
                break;
        }
    }
    
    // Method to unlock all perks at stage 1
    unlockAllPerksStage1() {
        console.log("Unlocking all perks at stage 1");
        
        // Unlock fast reload perk at stage 1
        if (this.perkSystem) {
            this.unlockPerk('fast-reload');
            this.fastReloadActive = true;
            this.superFastReloadActive = false;
            
            // Enable fast reload in weapon system
            if (this.weaponSystem) {
                this.weaponSystem.setFastReload(true, false);
            }
            
            // Show the green "PERK UNLOCKED" text for stage 1
            this.perkSystem.showPerkUnlockedText('fast-reload', false);
        }
        
        // Show message
        this.showMessage('All perks unlocked at Stage 1!', 'godmode');
    }
    
    // Method to unlock all perks at stage 2
    unlockAllPerksStage2() {
        console.log("Unlocking all perks at stage 2");
        
        // Unlock fast reload perk at stage 2
        if (this.perkSystem) {
            // First set the stage 2 state
            this.fastReloadActive = true;
            this.superFastReloadActive = true;
            
            // Then unlock the perk to trigger the visual effects
            this.unlockPerk('fast-reload');
            
            // Enable super fast reload in weapon system
            if (this.weaponSystem) {
                this.weaponSystem.setFastReload(true, true);
            }
            
            // Update the perk UI to show the purple glow
            const perkIndex = this.perkSystem.unlockedPerks.indexOf('fast-reload');
            if (perkIndex !== -1) {
                this.perkSystem.updatePerkSlot(perkIndex, 'fast-reload');
                
                // Show the purple "PERK UNLOCKED" text for stage 2 upgrade
                this.perkSystem.showPerkUnlockedText('fast-reload', true);
            }
        }
        
        // Show message
        this.showMessage('All perks unlocked at Stage 2!', 'godmode');
    }
    
    // Method to deactivate god mode
    deactivateGodMode() {
        this.godMode = false;
        this.showMessage('God Mode deactivated!', 'godmode');
        
        // Reset perks to default state
        if (this.perkSystem) {
            this.removeFastReloadPerk();
        }
    }
    
    // Show a message on screen
    showMessage(text, duration = 3000) {
        // Remove existing message if any
        if (this.messageElement) {
            document.body.removeChild(this.messageElement);
        }
        
        // Create message element
        this.messageElement = document.createElement('div');
        this.messageElement.textContent = text;
        this.messageElement.style.position = 'fixed';
        this.messageElement.style.top = '20%';
        this.messageElement.style.left = '50%';
        this.messageElement.style.transform = 'translateX(-50%)';
        this.messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.messageElement.style.color = 'white';
        this.messageElement.style.padding = '10px 20px';
        this.messageElement.style.borderRadius = '5px';
        this.messageElement.style.fontFamily = 'Arial, sans-serif';
        this.messageElement.style.fontSize = '18px';
        this.messageElement.style.zIndex = '2000';
        
        // Add to document
        document.body.appendChild(this.messageElement);
        
        // Remove after duration
        setTimeout(() => {
            if (this.messageElement && document.body.contains(this.messageElement)) {
                document.body.removeChild(this.messageElement);
                this.messageElement = null;
            }
        }, duration);
    }

    // Method to add score points, delegating to the engine
    addScore(points) {
        if (this.engine && typeof this.engine.addScore === 'function') {
            this.engine.addScore(points);
            // Also record the kill for streak tracking
            this.recordKill();
        } else {
            console.warn("Engine reference missing or addScore not available in PlayerController");
        }
    }

    // Handle footstep sounds based on movement speed
    handleFootstepSounds(speed) {
        const currentTime = performance.now();
        
        // Adjust interval based on speed (faster movement = faster footsteps)
        let interval = this.footstepInterval;
        
        // Calculate dynamic interval based on movement speed and sprint state
        if (this.isSprinting) {
            // Get sprint percentage to adjust footstep timing
            const sprintPercentage = this.getSprintBarPercentage();
            
            if (sprintPercentage > 66) {
                // Full sprint speed (green bar)
                interval = 300 - (speed * 10); // Faster footsteps when sprinting (minimum 200ms)
            } else if (sprintPercentage > 33) {
                // 80% sprint speed (yellow/orange bar) - slower footsteps
                interval = 350 - (speed * 8);
            } else {
                // 60% sprint speed (red bar) - even slower footsteps
                interval = 400 - (speed * 6);
            }
            interval = Math.max(200, interval);
        } else if (this.isCrouching) {
            interval = 700; // Slower footsteps when crouching
        } else {
            interval = 500 - (speed * 5); // Normal walking (minimum 350ms)
            interval = Math.max(350, interval);
        }
        
        // Check if enough time has passed since last footstep
        if (currentTime - this.lastFootstepTime > interval) {
            this.playFootstepSound(speed);
            this.lastFootstepTime = currentTime;
        }
    }

    // Play footstep sound with realistic panning and variation
    playFootstepSound(speed) {
        if (!this.footstepSounds || this.footstepSounds.length === 0) return;
        
        // Get random footstep sound from array
        const soundFile = this.footstepSounds[Math.floor(Math.random() * this.footstepSounds.length)];
        
        // Calculate sound parameters based on movement
        let playbackRate = this.calculateFootstepPlaybackRate(speed);
        
        // Add random pitch variation of ±3%
        const pitchVariation = 1.0 + ((Math.random() * 0.06) - 0.03); // Random value between 0.97 and 1.03
        playbackRate *= pitchVariation;
        
        // Alternate panning between left and right speakers (increased range)
        this.lastFootstepPan = -this.lastFootstepPan; // Flip between positive and negative
        const pan = this.lastFootstepPan; // Pan value of +/-0.4 (80% total range)
        
        // Setup audio effects
        const options = {
            playbackRate: playbackRate,
            type: 'footstep',
            pan: pan,
            volume: 1.5,  // Increased from 0.75 to 1.5 (2x louder)
            positionY: 0  // Position at ground level
        };
        
        // Add reverb but no delay effect
        options.reverb = 0.15 + (Math.random() * 0.15); // 0.15-0.3 reverb
        options.noDelay = true; // Signal that we don't want any delay, just reverb
        
        // Play the sound through AudioManager
        this.audioManager.playFootstepSound(soundFile, options);
    }

    // Calculate footstep sound playback rate based on speed
    calculateFootstepPlaybackRate(speed) {
        if (this.isSprinting) {
            // Slightly higher pitch when sprinting (0.95-1.1) - reduced from previous values
            return 0.95 + (Math.min(speed, 10) / 40);
        } else if (this.isCrouching) {
            // Lower pitch when crouching (0.7-0.8) - reduced from previous values
            return 0.7 + (Math.random() * 0.1);
        } else {
            // Normal walking (0.8-0.95) - reduced from previous values
            return 0.8 + (Math.min(speed, 8) / 50);
        }
    }

    // Handle sliding motion
    handleSlideMotion(playerBody) {
        // Calculate slide progress (0 to 1)
        const position = playerBody.translation();
        const currentPos = new THREE.Vector3(position.x, position.y, position.z);
        const distanceSlid = currentPos.distanceTo(this.slideStartPosition);
        this.slideProgress = Math.min(1.0, distanceSlid / this.slideDistance);
        
        // Update white noise volume based on slide progress - gradually fade out
        if (this.slideWhiteNoiseSource && this.audioManager) {
            // Calculate remaining volume (start at 100%, fade to 0%)
            const remainingVolumePercentage = 1.0 - this.slideProgress;
            this.audioManager.updateSoundVolume(this.slideWhiteNoiseSource, 0.11 * remainingVolumePercentage);
        }
        
        // Calculate current velocity with easing
        let currentSlideVelocity = this.slideVelocity;
        
        if (this.slideEasing) {
            // Simple deceleration curve - start fast, gradually slow down
            // Use a quadratic easing out function (1 - progress^2)
            const decelerationFactor = 1 - (this.slideProgress * this.slideProgress);
            currentSlideVelocity = this.slideVelocity * Math.max(0.2, decelerationFactor);
        }
        
        // Apply slide velocity in the slide direction
        const slideVelocity = new THREE.Vector3(
            this.slideDirection.x * currentSlideVelocity,
            playerBody.linvel().y,
            this.slideDirection.z * currentSlideVelocity
        );
        
        // Apply the slide velocity
        playerBody.setLinvel(slideVelocity, true);
        playerBody.wakeUp();
        
        // Check if we've slid the required distance
        if (distanceSlid >= this.slideDistance) {
            // End slide if we've gone the desired distance
            this.endSlide();
        }
    }
} 