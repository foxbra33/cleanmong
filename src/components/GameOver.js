/**
 * GameOver.js
 * Handles the game over screen and functionality
 */

export class GameOver {
    constructor(playerController) {
        this.playerController = playerController;
        this.audioManager = playerController.audioManager;
        this.weaponSystem = playerController.weaponSystem;
        this.physicsWorld = playerController.physicsWorld;
        this.controls = playerController.controls;
        this.isDead = false;
    }

    /**
     * Trigger the game over sequence
     */
    die() {
        // Prevent multiple calls to die()
        if (this.isDead) {
            return;
        }
        this.isDead = true;
        
        console.log("Player died!");
        
        // Create game over overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)'; // Start transparent
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '1000';
        overlay.style.transition = 'background-color 1s ease-in-out';
        
        // Create game over text
        const gameOverText = document.createElement('div');
        gameOverText.textContent = 'GAME OVER';
        gameOverText.style.color = '#FF0000';
        gameOverText.style.fontSize = '72px';
        gameOverText.style.fontFamily = '"Creepster", "Chiller", cursive';
        gameOverText.style.fontWeight = 'bold';
        gameOverText.style.textShadow = '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 10px #FF0000, 0 0 20px #800000';
        gameOverText.style.marginBottom = '20px';
        gameOverText.style.letterSpacing = '2px';
        gameOverText.style.opacity = '0';
        gameOverText.style.transition = 'opacity 1s ease-in-out';
        
        // Create restart button
        const restartButton = document.createElement('button');
        restartButton.textContent = 'RESTART';
        restartButton.style.padding = '15px 30px';
        restartButton.style.fontSize = '24px';
        restartButton.style.backgroundColor = '#8B0000';
        restartButton.style.color = 'white';
        restartButton.style.border = '2px solid #FF0000';
        restartButton.style.borderRadius = '5px';
        restartButton.style.cursor = 'pointer';
        restartButton.style.fontFamily = '"Creepster", "Chiller", cursive';
        restartButton.style.opacity = '0';
        restartButton.style.transition = 'opacity 1s ease-in-out';
        
        // Add hover effects
        restartButton.onmouseover = () => {
            restartButton.style.backgroundColor = '#FF0000';
        };
        restartButton.onmouseout = () => {
            restartButton.style.backgroundColor = '#8B0000';
        };
        
        // Add restart functionality
        restartButton.onclick = () => {
            window.location.reload();
        };
        
        // Add elements to overlay
        overlay.appendChild(gameOverText);
        overlay.appendChild(restartButton);
        
        // Add overlay to document
        document.body.appendChild(overlay);
        
        // Fade to black and show elements
        setTimeout(() => {
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 1)';
            gameOverText.style.opacity = '1';
            restartButton.style.opacity = '1';
        }, 100);
        
        // Play game over sounds
        this.playGameOverSounds();
        
        // Unlock pointer controls
        this.controls.unlock();
        
        // Notify weapon system of game over
        if (this.weaponSystem) {
            this.weaponSystem.setGameOver(true);
        }
        
        // Notify engine of game over
        if (this.physicsWorld && this.physicsWorld.engine) {
            this.physicsWorld.engine.gameOver();
        }
    }

    /**
     * Play the game over sound sequence
     */
    playGameOverSounds() {
        if (this.audioManager) {
            this.audioManager.muteAllExcept([
                'assets/sounds/ESM_Retro_Game_Over_v2_Sound_FX_Arcade_Casino_Kids_Mobile_App.wav',
                'assets/sounds/LNG_GamingPhrases_Game-over_Conversation.wav'
            ]);
            
            // Play first game over sound
            this.audioManager.playOneShot('assets/sounds/ESM_Retro_Game_Over_v2_Sound_FX_Arcade_Casino_Kids_Mobile_App.wav')
                .then(() => {
                    // Play second game over sound after 1 second with slightly lower pitch
                    setTimeout(() => {
                        this.audioManager.playOneShot('assets/sounds/LNG_GamingPhrases_Game-over_Conversation.wav', { playbackRate: 0.85 });
                    }, 1000);
                });
        }
    }

    /**
     * Check if the player is dead
     * @returns {boolean} True if the player is dead
     */
    isPlayerDead() {
        return this.isDead;
    }
} 