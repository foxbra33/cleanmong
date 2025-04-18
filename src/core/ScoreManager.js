export class ScoreManager {
    constructor(engine) {
        this.engine = engine; // Reference to the main engine for UI updates
        this.score = 0;
        this.scoreElement = null;
        this.initScoreDisplay();
    }

    initScoreDisplay() {
        // Find or create the score display element
        this.scoreElement = document.getElementById('score-display');
        if (!this.scoreElement) {
            this.scoreElement = document.createElement('div');
            this.scoreElement.id = 'score-display';
            this.scoreElement.style.position = 'absolute';
            this.scoreElement.style.top = '10px';
            this.scoreElement.style.right = '10px';
            this.scoreElement.style.color = 'white';
            this.scoreElement.style.fontSize = '2em';
            this.scoreElement.style.fontFamily = '"Creepster", cursive'; // Use spooky font
            this.scoreElement.style.textShadow = '1px 1px 2px black';
            this.scoreElement.style.zIndex = '1000';
            document.body.appendChild(this.scoreElement);
        }
        this.updateScoreDisplay();
    }

    addScore(points) {
        if (points > 0) {
            this.score += points;
            console.log(`Added ${points} points. Total score: ${this.score}`);
            this.updateScoreDisplay();
            // Optional: Add a visual effect for score increase
            this.showScorePopup(`+${points}`);
        }
    }

    getScore() {
        return this.score;
    }

    resetScore() {
        this.score = 0;
        console.log("Score reset.");
        this.updateScoreDisplay();
    }

    updateScoreDisplay() {
        if (this.scoreElement) {
            this.scoreElement.textContent = `Score: ${this.score}`;
        }
    }
    
    // Optional: Display a small popup showing points added
    showScorePopup(text) {
        const popup = document.createElement('div');
        popup.textContent = text;
        popup.style.position = 'absolute';
        popup.style.right = '20px'; // Position near score display
        popup.style.top = '50px'; 
        popup.style.fontSize = '1.5em';
        popup.style.color = 'yellow'; // Points popup color
        popup.style.fontFamily = '"Creepster", cursive';
        popup.style.textShadow = '1px 1px 1px black';
        popup.style.opacity = '1';
        popup.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
        popup.style.transform = 'translateY(0)';
        popup.style.pointerEvents = 'none';
        popup.style.zIndex = '1001';
        document.body.appendChild(popup);

        // Animate and remove
        setTimeout(() => {
            popup.style.opacity = '0';
            popup.style.transform = 'translateY(-30px)'; // Move up while fading
        }, 100); // Start fading quickly

        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        }, 1100); // Remove after animation
    }
} 