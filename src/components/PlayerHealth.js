export class PlayerHealth {
    constructor() {
        this.health = 100;
        this.maxHealth = 100;
        this.createHealthBar();
    }
    
    createHealthBar() {
        // Create container div
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.bottom = '20px';
        this.container.style.right = '20px';
        this.container.style.width = '200px';
        this.container.style.height = '20px';
        this.container.style.backgroundColor = '#000000';
        this.container.style.border = '2px solid #ffffff';
        this.container.style.borderRadius = '10px';
        this.container.style.overflow = 'hidden';
        
        // Create health bar
        this.healthBar = document.createElement('div');
        this.healthBar.style.width = '100%';
        this.healthBar.style.height = '100%';
        this.healthBar.style.backgroundColor = '#00ff00';
        this.healthBar.style.transition = 'width 0.3s ease-in-out';
        
        // Create health text
        this.healthText = document.createElement('div');
        this.healthText.style.position = 'absolute';
        this.healthText.style.width = '100%';
        this.healthText.style.height = '100%';
        this.healthText.style.display = 'flex';
        this.healthText.style.alignItems = 'center';
        this.healthText.style.justifyContent = 'center';
        this.healthText.style.color = '#ffffff';
        this.healthText.style.fontFamily = 'Arial, sans-serif';
        this.healthText.style.fontWeight = 'bold';
        this.healthText.style.textShadow = '1px 1px 2px #000000';
        
        // Add elements to container
        this.container.appendChild(this.healthBar);
        this.container.appendChild(this.healthText);
        
        // Add to document
        document.body.appendChild(this.container);
        
        // Update initial display
        this.updateDisplay();
    }
    
    updateDisplay() {
        const healthRatio = this.health / this.maxHealth;
        this.healthBar.style.width = `${healthRatio * 100}%`;
        
        // Update color based on health
        if (healthRatio > 0.6) {
            this.healthBar.style.backgroundColor = '#00ff00'; // Green
        } else if (healthRatio > 0.3) {
            this.healthBar.style.backgroundColor = '#ffff00'; // Yellow
        } else {
            this.healthBar.style.backgroundColor = '#ff0000'; // Red
        }
        
        // Update text
        this.healthText.textContent = `${Math.ceil(this.health)} / ${this.maxHealth}`;
    }
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateDisplay();
        return this.health <= 0;
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.updateDisplay();
    }
    
    cleanup() {
        document.body.removeChild(this.container);
    }
} 