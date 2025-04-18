import * as THREE from 'three';

export class Inventory {
    constructor(playerController) {
        this.playerController = playerController;
        
        // Inventory slots
        this.slots = [];
        // Track count of items in each slot (for stackable items like medikits)
        this.itemCounts = [];
        this.maxSlots = 6;
        this.selectedSlot = 0;
        
        // Medikit properties
        this.maxMedikitStack = 5;
        
        // Create inventory UI
        this.createInventoryUI();
        
        // Add pistol to slot 1
        this.addPistolToSlot1();
        
        // Usage prompt
        this.usePrompt = null;
        
        // Listen for number keys to switch slots
        window.addEventListener('keydown', this.onKeyDown.bind(this));
    }
    
    createInventoryUI() {
        // Create the inventory container
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.bottom = '20px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.display = 'flex';
        this.container.style.gap = '10px';
        this.container.style.padding = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.borderRadius = '10px';
        document.body.appendChild(this.container);
        
        // Create inventory slots
        for (let i = 0; i < this.maxSlots; i++) {
            const slot = document.createElement('div');
            slot.style.width = '60px';
            slot.style.height = '60px';
            slot.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            slot.style.border = '2px solid #444';
            slot.style.borderRadius = '5px';
            slot.style.display = 'flex';
            slot.style.justifyContent = 'center';
            slot.style.alignItems = 'center';
            slot.style.position = 'relative';
            
            // Add number label (1-6)
            const slotNumber = document.createElement('div');
            slotNumber.textContent = (i + 1).toString();
            slotNumber.style.position = 'absolute';
            slotNumber.style.bottom = '2px';
            slotNumber.style.right = '5px';
            slotNumber.style.fontSize = '12px';
            slotNumber.style.color = 'white';
            slot.appendChild(slotNumber);
            
            this.container.appendChild(slot);
            this.slots.push(slot);
            this.itemCounts.push(0);
        }
        
        // Highlight the first slot
        this.updateSelectedSlot();
    }
    
    createMedikitTextureWithCount(count) {
        // Create a wrapper div to hold both the image and count
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = '50px';
        wrapper.style.height = '50px';
        
        // Create the medikit image - use canvas instead of loading a file
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
        
        // Create an img element and set its src to the canvas data URL
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        wrapper.appendChild(img);
        
        // Add count overlay if count > 1
        if (count > 1) {
            const countElement = document.createElement('div');
            countElement.textContent = count.toString();
            countElement.style.position = 'absolute';
            countElement.style.top = '50%';
            countElement.style.left = '50%';
            countElement.style.transform = 'translate(-50%, -50%)';
            countElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            countElement.style.color = 'white';
            countElement.style.borderRadius = '50%';
            countElement.style.width = '20px';
            countElement.style.height = '20px';
            countElement.style.display = 'flex';
            countElement.style.justifyContent = 'center';
            countElement.style.alignItems = 'center';
            countElement.style.fontSize = '14px';
            countElement.style.fontWeight = 'bold';
            wrapper.appendChild(countElement);
        }
        
        return wrapper;
    }
    
    addItem(itemType) {
        // For medikits, we check if we already have some and stack them
        if (itemType === 'medikit') {
            // Look for an existing medikit slot
            for (let i = 0; i < this.slots.length; i++) {
                if (this.slots[i].dataset.itemType === 'medikit' && this.itemCounts[i] < this.maxMedikitStack) {
                    // Increment the medikit count
                    this.itemCounts[i]++;
                    
                    // Update the medikit display with the new count
                    while (this.slots[i].firstChild) {
                        this.slots[i].removeChild(this.slots[i].firstChild);
                    }
                    
                    // Add slot number back
                    const slotNumber = document.createElement('div');
                    slotNumber.textContent = (i + 1).toString();
                    slotNumber.style.position = 'absolute';
                    slotNumber.style.bottom = '2px';
                    slotNumber.style.right = '5px';
                    slotNumber.style.fontSize = '12px';
                    slotNumber.style.color = 'white';
                    this.slots[i].appendChild(slotNumber);
                    
                    // Add medikit with count
                    this.slots[i].appendChild(this.createMedikitTextureWithCount(this.itemCounts[i]));
                    
                    // If this is the selected slot, update the use prompt
                    if (i === this.selectedSlot) {
                        this.updateUsePrompt();
                    }
                    
                    // Play item pickup sound
                    const pickupSound = new Audio('assets/sounds/ESM_Game_Item_or_Coin_11_Retro_Cartoon_Casino_Arcade_Kid_App_Mobile.wav');
                    pickupSound.play().catch(error => console.log("Error playing pickup sound:", error));
                    
                    return true;
                }
            }
        }
        
        // If we get here, either it's not a medikit or we don't have one yet
        // Find the first empty slot
        for (let i = 0; i < this.slots.length; i++) {
            if (!this.slots[i].dataset.itemType) {
                this.slots[i].dataset.itemType = itemType;
                
                // Clear the slot
                while (this.slots[i].firstChild) {
                    this.slots[i].removeChild(this.slots[i].firstChild);
                }
                
                // Add slot number back
                const slotNumber = document.createElement('div');
                slotNumber.textContent = (i + 1).toString();
                slotNumber.style.position = 'absolute';
                slotNumber.style.bottom = '2px';
                slotNumber.style.right = '5px';
                slotNumber.style.fontSize = '12px';
                slotNumber.style.color = 'white';
                this.slots[i].appendChild(slotNumber);
                
                if (itemType === 'medikit') {
                    // Add medikit with count
                    this.itemCounts[i] = 1;
                    this.slots[i].appendChild(this.createMedikitTextureWithCount(this.itemCounts[i]));
                } else {
                    // For other items, create a placeholder image
                    this.itemCounts[i] = 1;
                    
                    // Create a basic colored square with item name
                    const placeholder = document.createElement('div');
                    placeholder.style.width = '80%';
                    placeholder.style.height = '80%';
                    placeholder.style.backgroundColor = '#888'; // Gray background
                    placeholder.style.display = 'flex';
                    placeholder.style.justifyContent = 'center';
                    placeholder.style.alignItems = 'center';
                    placeholder.style.color = 'white';
                    placeholder.style.fontWeight = 'bold';
                    placeholder.style.fontSize = '12px';
                    placeholder.style.padding = '2px';
                    placeholder.style.textAlign = 'center';
                    placeholder.style.border = '2px solid #555';
                    placeholder.style.borderRadius = '4px';
                    placeholder.textContent = itemType;
                    
                    this.slots[i].appendChild(placeholder);
                }
                
                // If this is the selected slot, update the use prompt
                if (i === this.selectedSlot) {
                    this.updateUsePrompt();
                }
                
                // Play item pickup sound
                const pickupSound = new Audio('assets/sounds/ESM_Game_Item_or_Coin_11_Retro_Cartoon_Casino_Arcade_Kid_App_Mobile.wav');
                pickupSound.play().catch(error => console.log("Error playing pickup sound:", error));
                
                return true;
            }
        }
        
        return false; // No empty slots
    }
    
    onKeyDown(event) {
        // Handle number keys 1-6 to switch inventory slots
        if (event.code >= 'Digit1' && event.code <= 'Digit6') {
            const slotIndex = parseInt(event.code.charAt(5)) - 1;
            if (slotIndex < this.maxSlots) {
                this.selectedSlot = slotIndex;
                this.updateSelectedSlot();
                this.updateUsePrompt();
            }
        }
    }
    
    updateSelectedSlot() {
        // Update the visual appearance of all slots
        for (let i = 0; i < this.slots.length; i++) {
            if (i === this.selectedSlot) {
                this.slots[i].style.border = '2px solid #FFD700'; // Gold border for selected slot
                this.slots[i].style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
            } else {
                this.slots[i].style.border = '2px solid #444';
                this.slots[i].style.boxShadow = 'none';
            }
        }
        
        this.updateUsePrompt();
    }
    
    getSelectedItem() {
        return this.slots[this.selectedSlot].dataset.itemType || null;
    }
    
    updateUsePrompt() {
        // Remove existing prompt if it exists
        if (this.usePrompt) {
            document.body.removeChild(this.usePrompt);
            this.usePrompt = null;
        }
        
        const selectedItem = this.getSelectedItem();
        
        // Only show use prompt for medikit
        if (selectedItem === 'medikit') {
            this.createUsePrompt();
        }
    }
    
    createUsePrompt() {
        this.usePrompt = document.createElement('div');
        this.usePrompt.textContent = 'Press Q to use MediKit';
        this.usePrompt.style.position = 'fixed';
        this.usePrompt.style.bottom = '100px';
        this.usePrompt.style.left = '50%';
        this.usePrompt.style.transform = 'translateX(-50%)';
        this.usePrompt.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.usePrompt.style.color = 'white';
        this.usePrompt.style.padding = '8px 15px';
        this.usePrompt.style.borderRadius = '5px';
        this.usePrompt.style.fontSize = '16px';
        document.body.appendChild(this.usePrompt);
    }
    
    useSelectedItem() {
        const selectedItem = this.getSelectedItem();
        
        if (selectedItem === 'medikit') {
            // Heal the player
            if (this.playerController.health < this.playerController.maxHealth) {
                // Add up to 50 health, but cap at max health
                const oldHealth = this.playerController.health;
                this.playerController.health = Math.min(this.playerController.health + 50, this.playerController.maxHealth);
                
                // Only use the medikit if healing was done
                if (this.playerController.health > oldHealth) {
                    // Play medikit use sound
                    const medikitSound = new Audio('assets/sounds/ESM_Positive_Casino_Hit_Sound_FX_Arcade_Kids_Mobile_App.wav');
                    medikitSound.play().catch(error => console.log("Error playing medikit sound:", error));
                    
                    // Decrement the medikit count
                    this.itemCounts[this.selectedSlot]--;
                    
                    // Update the health bar display
                    this.playerController.updateHealthBarUI();
                    
                    if (this.itemCounts[this.selectedSlot] <= 0) {
                        // Remove the medikit if count reaches 0
                        this.slots[this.selectedSlot].dataset.itemType = '';
                        while (this.slots[this.selectedSlot].firstChild) {
                            this.slots[this.selectedSlot].removeChild(this.slots[this.selectedSlot].firstChild);
                        }
                        
                        // Add slot number back
                        const slotNumber = document.createElement('div');
                        slotNumber.textContent = (this.selectedSlot + 1).toString();
                        slotNumber.style.position = 'absolute';
                        slotNumber.style.bottom = '2px';
                        slotNumber.style.right = '5px';
                        slotNumber.style.fontSize = '12px';
                        slotNumber.style.color = 'white';
                        this.slots[this.selectedSlot].appendChild(slotNumber);
                        
                        // Remove the use prompt
                        this.updateUsePrompt();
                    } else {
                        // Update the medikit display with the new count
                        const slotContent = this.slots[this.selectedSlot].querySelector('div:not(:last-child)');
                        if (slotContent) {
                            this.slots[this.selectedSlot].removeChild(slotContent);
                        }
                        this.slots[this.selectedSlot].appendChild(this.createMedikitTextureWithCount(this.itemCounts[this.selectedSlot]));
                    }
                    
                    return true;
                }
            }
        }
        
        return false;
    }

    createPistolIcon() {
        // Create a wrapper div
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = '50px';
        wrapper.style.height = '50px';
        
        // Create an img element for the pistol icon
        const img = document.createElement('img');
        img.src = 'assets/inventory images/make-a-gun-icon-for-a-doom-style-first-person-shoo.png';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        wrapper.appendChild(img);
        
        return wrapper;
    }

    addPistolToSlot1() {
        // Clear slot 1
        while (this.slots[0].firstChild) {
            this.slots[0].removeChild(this.slots[0].firstChild);
        }
        
        // Add slot number
        const slotNumber = document.createElement('div');
        slotNumber.textContent = '1';
        slotNumber.style.position = 'absolute';
        slotNumber.style.bottom = '2px';
        slotNumber.style.right = '5px';
        slotNumber.style.fontSize = '12px';
        slotNumber.style.color = 'white';
        this.slots[0].appendChild(slotNumber);
        
        // Add pistol icon
        this.slots[0].appendChild(this.createPistolIcon());
        this.slots[0].dataset.itemType = 'pistol';
        this.itemCounts[0] = 1;
    }
} 