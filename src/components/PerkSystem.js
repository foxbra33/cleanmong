import * as THREE from 'three';
import fastReloadIcon from '../../assets/inventory images/make-a-fast-reload-icon-for-a-doom-style-shooter-g.png';

export class PerkSystem {
    constructor(playerController) {
        this.playerController = playerController;
        
        // Perk slots
        this.perkSlots = [];
        this.maxPerks = 3;
        this.unlockedPerks = [];
        
        // Preload the perk unlock sound
        this.perkUnlockSound = new Audio('/assets/sounds/ESM_Retro_Game_Classic_Jump_22_8_Bit_Arcade_80s.wav');
        this.perkUnlockSound.volume = 0.8;
        // Preload the sound
        this.perkUnlockSound.load();
        
        // Create perk UI
        this.createPerkUI();
        
        // No longer automatically unlock fast-reload perk
    }
    
    createPerkUI() {
        // Create the perk container
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.top = '20px';
        this.container.style.right = '230px'; // Position to the left of the health bar
        this.container.style.display = 'flex';
        this.container.style.gap = '10px';
        this.container.style.padding = '5px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.borderRadius = '5px';
        this.container.style.zIndex = '1001';
        document.body.appendChild(this.container);
        
        // Create perk slots
        for (let i = 0; i < this.maxPerks; i++) {
            const slot = document.createElement('div');
            slot.style.width = '40px';
            slot.style.height = '40px';
            slot.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            slot.style.border = '2px solid #444';
            slot.style.borderRadius = '5px';
            slot.style.display = 'flex';
            slot.style.justifyContent = 'center';
            slot.style.alignItems = 'center';
            slot.style.position = 'relative';
            
            this.container.appendChild(slot);
            this.perkSlots.push(slot);
        }
    }
    
    // Unlock a new perk
    unlockPerk(perkType) {
        if (this.unlockedPerks.length >= this.maxPerks) {
            console.log("Maximum number of perks already unlocked");
            return false;
        }
        
        if (this.unlockedPerks.includes(perkType)) {
            console.log(`Perk ${perkType} already unlocked`);
            return false;
        }
        
        // Add to unlocked perks
        this.unlockedPerks.push(perkType);
        
        // Update UI
        const slotIndex = this.unlockedPerks.length - 1;
        this.updatePerkSlot(slotIndex, perkType);
        
        // Apply perk effect
        this.applyPerkEffect(perkType);
        
        // Play unlock sound using the preloaded sound
        this.perkUnlockSound.currentTime = 0; // Reset the sound to the beginning
        this.perkUnlockSound.play().catch(error => console.error("Error playing perk unlock sound:", error));
        
        // Create and show unlock text
        const unlockText = document.createElement('div');
        unlockText.textContent = 'PERK UNLOCKED';
        
        // Check if this is a stage 2 perk
        const isStage2 = perkType === 'fast-reload' && this.playerController && this.playerController.superFastReloadActive;
        
        // Set text color and glow based on stage
        if (isStage2) {
            unlockText.style.color = '#800080'; // Purple
            unlockText.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 0 10px #800080, 0 0 20px #800080';
        } else {
            unlockText.style.color = '#00ff00'; // Green
            unlockText.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 0 10px #00ff00, 0 0 20px #00ff00';
        }
        
        unlockText.style.position = 'fixed';
        unlockText.style.top = '20px';
        unlockText.style.right = '450px';
        unlockText.style.fontSize = '48px';
        unlockText.style.fontFamily = 'Creepster, cursive';
        unlockText.style.zIndex = '9999';
        unlockText.style.opacity = '0';
        unlockText.style.transition = 'opacity 1.0s ease-in-out';
        document.body.appendChild(unlockText);
        
        // Create particle container
        const particleContainer = document.createElement('div');
        particleContainer.style.position = 'fixed';
        particleContainer.style.top = '20px';
        particleContainer.style.right = '450px';
        particleContainer.style.width = '300px';
        particleContainer.style.height = '60px';
        particleContainer.style.zIndex = '9998';
        particleContainer.style.pointerEvents = 'none';
        document.body.appendChild(particleContainer);
        
        // Create particles
        const particleCount = 30;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.width = '10px';
            particle.style.height = '10px';
            particle.style.backgroundColor = isStage2 ? '#800080' : '#00ff00';
            particle.style.boxShadow = isStage2 ? '0 0 5px #800080' : '0 0 5px #00ff00';
            particle.style.borderRadius = '2px';
            particle.style.opacity = '0';
            particle.style.transition = 'all 0.5s ease-out';
            
            // Random position within container
            particle.style.left = Math.random() * 280 + 'px';
            particle.style.top = Math.random() * 40 + 'px';
            
            particleContainer.appendChild(particle);
            
            // Animate particle
            setTimeout(() => {
                particle.style.opacity = '1';
                particle.style.transform = `translate(${(Math.random() - 0.5) * 100}px, ${(Math.random() - 0.5) * 50}px) rotate(${Math.random() * 360}deg)`;
                
                // Fade out
                setTimeout(() => {
                    particle.style.opacity = '0';
                }, 300);
            }, Math.random() * 200);
        }
        
        // Fade in
        setTimeout(() => {
            unlockText.style.opacity = '1';
        }, 10);
        
        // Fade out and remove after 1 second
        setTimeout(() => {
            unlockText.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(unlockText);
                document.body.removeChild(particleContainer);
            }, 1000);
        }, 1000);
        
        return true;
    }
    
    // Update the visual appearance of a perk slot
    updatePerkSlot(slotIndex, perkType) {
        const slot = this.perkSlots[slotIndex];
        if (!slot) return;
        
        // Clear the slot
        while (slot.firstChild) {
            slot.removeChild(slot.firstChild);
        }
        
        // Create perk icon
        const perkIcon = this.createPerkIcon(perkType);
        slot.appendChild(perkIcon);
        
        // Add perk name tooltip
        slot.title = this.getPerkName(perkType);
        
        // Add purple glow for fast-reload perk at max level (stage 2)
        if (perkType === 'fast-reload') {
            if (this.playerController && this.playerController.superFastReloadActive) {
                // Stage 2 - Purple glow effect
                slot.style.boxShadow = '0 0 10px #800080, 0 0 20px #800080';
                slot.style.border = '2px solid #800080';
                slot.title = 'Super Fast Reload (Stage 2)';
                
                // Add pulsing animation
                slot.style.animation = 'pulsePurple 1.5s infinite';
                
                // Add the animation keyframes if they don't exist
                if (!document.getElementById('purplePulseAnimation')) {
                    const style = document.createElement('style');
                    style.id = 'purplePulseAnimation';
                    style.textContent = `
                        @keyframes pulsePurple {
                            0% { 
                                box-shadow: 0 0 10px #800080, 0 0 20px #800080;
                                transform: scale(1);
                            }
                            50% { 
                                box-shadow: 0 0 20px #800080, 0 0 40px #800080;
                                transform: scale(1.05);
                            }
                            100% { 
                                box-shadow: 0 0 10px #800080, 0 0 20px #800080;
                                transform: scale(1);
                            }
                        }
                    `;
                    document.head.appendChild(style);
                }
            } else if (this.playerController && this.playerController.fastReloadActive) {
                // Stage 1 - Normal glow effect
                slot.style.boxShadow = '0 0 10px #00ff00, 0 0 20px #00ff00';
                slot.style.border = '2px solid #00ff00';
                slot.title = 'Fast Reload (Stage 1)';
            } else {
                // Reset to default style
                slot.style.boxShadow = 'none';
                slot.style.border = '2px solid #444';
                slot.style.animation = 'none';
            }
        }
    }
    
    // Create a visual icon for the perk
    createPerkIcon(perkType) {
        // Create a wrapper div
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = '35px';
        wrapper.style.height = '35px';
        
        // For fast-reload, use the provided image path
        if (perkType === 'fast-reload') {
            const img = document.createElement('img');
            img.src = fastReloadIcon;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            wrapper.appendChild(img);
            return wrapper;
        }
        
        // For other perks, use canvas drawings
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Draw different icons based on perk type
        switch(perkType) {
            case 'speed':
                // Speed perk (blue lightning bolt)
                ctx.fillStyle = '#0077CC';
                ctx.fillRect(0, 0, 128, 128);
                
                // Lightning bolt shape
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(64, 20);
                ctx.lineTo(40, 60);
                ctx.lineTo(60, 60);
                ctx.lineTo(50, 108);
                ctx.lineTo(90, 58);
                ctx.lineTo(70, 58);
                ctx.lineTo(80, 20);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'strength':
                // Strength perk (red muscle)
                ctx.fillStyle = '#CC0000';
                ctx.fillRect(0, 0, 128, 128);
                
                // Muscle arm symbol
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(30, 80);
                ctx.lineTo(50, 60);
                ctx.lineTo(60, 70);
                ctx.lineTo(70, 60);
                ctx.lineTo(90, 80);
                ctx.lineTo(80, 90);
                ctx.lineTo(60, 80);
                ctx.lineTo(40, 90);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'health':
                // Health perk (green cross)
                ctx.fillStyle = '#00AA00';
                ctx.fillRect(0, 0, 128, 128);
                
                // Cross shape
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(48, 24, 32, 80);  // Vertical bar
                ctx.fillRect(24, 48, 80, 32);  // Horizontal bar
                break;
                
            default:
                // Default placeholder (question mark)
                ctx.fillStyle = '#555555';
                ctx.fillRect(0, 0, 128, 128);
                
                // Question mark
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 90px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('?', 64, 64);
                break;
        }
        
        // Border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, 112, 112);
        
        // Create an img element and set its src to the canvas data URL
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        wrapper.appendChild(img);
        
        return wrapper;
    }
    
    // Get perk name for tooltip
    getPerkName(perkType) {
        switch(perkType) {
            case 'speed':
                return 'Speed Boost';
            case 'strength':
                return 'Increased Damage';
            case 'health':
                return 'Health Regeneration';
            case 'fast-reload':
                return 'Fast Reload';
            default:
                return 'Unknown Perk';
        }
    }
    
    // Apply the effect of a perk when unlocked
    applyPerkEffect(perkType) {
        // These effects would connect to actual game mechanics
        switch(perkType) {
            case 'speed':
                console.log('Applied speed boost perk');
                // Would connect to player movement speed
                break;
                
            case 'strength':
                console.log('Applied strength perk');
                // Would connect to weapon damage
                break;
                
            case 'health':
                console.log('Applied health regeneration perk');
                // Would enable health regeneration
                break;
                
            case 'fast-reload':
                console.log('Applied fast reload perk');
                if (this.playerController && this.playerController.weaponSystem) {
                    this.playerController.weaponSystem.setFastReload(true);
                }
                break;
                
            default:
                console.log(`Unknown perk type: ${perkType}`);
                break;
        }
    }
    
    // Remove a perk and its effects
    removePerk(perkType) {
        const index = this.unlockedPerks.indexOf(perkType);
        if (index === -1) return false;
        
        // Remove from unlocked perks
        this.unlockedPerks.splice(index, 1);
        
        // Clear the slot
        const slot = this.perkSlots[index];
        if (slot) {
            while (slot.firstChild) {
                slot.removeChild(slot.firstChild);
            }
        }
        
        // Remove perk effect
        this.removePerkEffect(perkType);
        
        return true;
    }
    
    // Remove the effect of a perk when it's removed
    removePerkEffect(perkType) {
        switch(perkType) {
            case 'speed':
                console.log('Removed speed boost perk');
                break;
                
            case 'strength':
                console.log('Removed strength perk');
                break;
                
            case 'health':
                console.log('Removed health regeneration perk');
                break;
                
            case 'fast-reload':
                console.log('Removed fast reload perk');
                if (this.playerController && this.playerController.weaponSystem) {
                    this.playerController.weaponSystem.setFastReload(false);
                }
                break;
                
            default:
                console.log(`Unknown perk type: ${perkType}`);
                break;
        }
    }
    
    // Clear all perks
    clearAllPerks() {
        // Create a copy of the array to avoid issues with splicing during iteration
        const perksToRemove = [...this.unlockedPerks];
        
        // Remove each perk
        for (const perkType of perksToRemove) {
            this.removePerk(perkType);
        }
        
        // Clear all slots
        for (const slot of this.perkSlots) {
            while (slot.firstChild) {
                slot.removeChild(slot.firstChild);
            }
        }
        
        // Reset unlocked perks array
        this.unlockedPerks = [];
        
        return true;
    }

    // Method to show perk unlocked text for stage 2 upgrades
    showPerkUnlockedText(perkType, isStage2 = false) {
        // Play unlock sound using the preloaded sound
        this.perkUnlockSound.currentTime = 0; // Reset the sound to the beginning
        this.perkUnlockSound.play().catch(error => console.error("Error playing perk unlock sound:", error));
        
        // Create and show unlock text
        const unlockText = document.createElement('div');
        unlockText.textContent = 'PERK UNLOCKED';
        
        // Set text color and glow based on stage
        if (isStage2) {
            unlockText.style.color = '#800080'; // Purple
            unlockText.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 0 10px #800080, 0 0 20px #800080';
        } else {
            unlockText.style.color = '#00ff00'; // Green
            unlockText.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 0 10px #00ff00, 0 0 20px #00ff00';
        }
        
        unlockText.style.position = 'fixed';
        unlockText.style.top = '20px';
        unlockText.style.right = '450px';
        unlockText.style.fontSize = '48px';
        unlockText.style.fontFamily = 'Creepster, cursive';
        unlockText.style.zIndex = '9999';
        unlockText.style.opacity = '0';
        unlockText.style.transition = 'opacity 1.0s ease-in-out';
        document.body.appendChild(unlockText);
        
        // Create particle container
        const particleContainer = document.createElement('div');
        particleContainer.style.position = 'fixed';
        particleContainer.style.top = '20px';
        particleContainer.style.right = '450px';
        particleContainer.style.width = '300px';
        particleContainer.style.height = '60px';
        particleContainer.style.zIndex = '9998';
        particleContainer.style.pointerEvents = 'none';
        document.body.appendChild(particleContainer);
        
        // Create particles
        const particleCount = 30;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.width = '10px';
            particle.style.height = '10px';
            particle.style.backgroundColor = isStage2 ? '#800080' : '#00ff00';
            particle.style.boxShadow = isStage2 ? '0 0 5px #800080' : '0 0 5px #00ff00';
            particle.style.borderRadius = '2px';
            particle.style.opacity = '0';
            particle.style.transition = 'all 0.5s ease-out';
            
            // Random position within container
            particle.style.left = Math.random() * 280 + 'px';
            particle.style.top = Math.random() * 40 + 'px';
            
            particleContainer.appendChild(particle);
            
            // Animate particle
            setTimeout(() => {
                particle.style.opacity = '1';
                particle.style.transform = `translate(${(Math.random() - 0.5) * 100}px, ${(Math.random() - 0.5) * 50}px) rotate(${Math.random() * 360}deg)`;
                
                // Fade out
                setTimeout(() => {
                    particle.style.opacity = '0';
                }, 300);
            }, Math.random() * 200);
        }
        
        // Fade in
        setTimeout(() => {
            unlockText.style.opacity = '1';
        }, 10);
        
        // Fade out and remove after 1 second
        setTimeout(() => {
            unlockText.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(unlockText);
                document.body.removeChild(particleContainer);
            }, 1000);
        }, 1000);
    }
} 