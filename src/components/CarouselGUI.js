export class CarouselGUI {
    constructor() {
        // Create the "Press E" prompt
        this.promptElement = document.createElement('div');
        this.promptElement.style.position = 'absolute';
        this.promptElement.style.top = '50%';
        this.promptElement.style.left = '50%';
        this.promptElement.style.transform = 'translate(-50%, -50%)';
        this.promptElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.promptElement.style.color = 'white';
        this.promptElement.style.padding = '10px 20px';
        this.promptElement.style.borderRadius = '5px';
        this.promptElement.style.fontFamily = 'Arial, sans-serif';
        this.promptElement.style.fontSize = '18px';
        this.promptElement.style.zIndex = '1000';
        this.promptElement.style.display = 'none';
        this.promptElement.textContent = 'Press E to control carousel';
        document.body.appendChild(this.promptElement);
        
        // Create the slider GUI
        this.sliderContainer = document.createElement('div');
        this.sliderContainer.style.position = 'absolute';
        this.sliderContainer.style.top = '50%';
        this.sliderContainer.style.left = '50%';
        this.sliderContainer.style.transform = 'translate(-50%, -50%)';
        this.sliderContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.sliderContainer.style.padding = '20px';
        this.sliderContainer.style.borderRadius = '5px';
        this.sliderContainer.style.fontFamily = 'Arial, sans-serif';
        this.sliderContainer.style.color = 'white';
        this.sliderContainer.style.zIndex = '1000';
        this.sliderContainer.style.display = 'none';
        
        // Add title
        const title = document.createElement('div');
        title.textContent = 'Carousel Speed Control';
        title.style.marginBottom = '10px';
        title.style.fontSize = '18px';
        title.style.textAlign = 'center';
        this.sliderContainer.appendChild(title);
        
        // Add slider
        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.min = '0';
        this.slider.max = '100';
        this.slider.value = '10';
        this.slider.style.width = '200px';
        this.slider.style.marginBottom = '10px';
        this.sliderContainer.appendChild(this.slider);
        
        // Add value display
        this.valueDisplay = document.createElement('div');
        this.valueDisplay.textContent = 'Speed: 10%';
        this.valueDisplay.style.textAlign = 'center';
        this.sliderContainer.appendChild(this.valueDisplay);
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginTop = '10px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#4CAF50';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '3px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => this.hideSlider();
        this.sliderContainer.appendChild(closeButton);
        
        document.body.appendChild(this.sliderContainer);
        
        // Set up event listeners
        this.slider.addEventListener('input', () => {
            this.valueDisplay.textContent = `Speed: ${this.slider.value}%`;
        });
        
        // Initialize state
        this.isNearCarousel = false;
        this.isSliderVisible = false;
        this.isPromptVisible = false;
        this.playerControlsEnabled = true;
    }
    
    showPrompt() {
        this.promptElement.style.display = 'block';
    }
    
    hidePrompt() {
        this.promptElement.style.display = 'none';
    }
    
    showSlider() {
        // Force exit pointer lock immediately
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        
        // Force the cursor to be visible
        document.body.style.cursor = 'auto';
        
        // Show the slider
        this.sliderContainer.style.display = 'flex';
        this.isSliderVisible = true;
        this.hidePrompt();
        
        // Disable player controls
        this.disablePlayerControls();
        
        // Force the cursor to be visible again after a short delay
        setTimeout(() => {
            document.body.style.cursor = 'auto';
        }, 100);
    }
    
    hideSlider() {
        this.sliderContainer.style.display = 'none';
        this.isSliderVisible = false;
        this.enablePlayerControls();
        
        // Re-lock pointer when slider is closed
        if (document.body.requestPointerLock) {
            document.body.requestPointerLock();
        }
    }
    
    updateProximity(isNear) {
        this.isNearCarousel = isNear;
        if (isNear && !this.isSliderVisible) {
            this.showPrompt();
        } else if (!isNear && !this.isSliderVisible) {
            this.hidePrompt();
        }
    }
    
    getSpeedValue() {
        // Convert slider value (0-100) to rotation speed (0-0.01)
        return this.slider.value / 10000;
    }
    
    onKeyDown(event) {
        if (event.key === 'e' || event.key === 'E') {
            if (this.isNearCarousel && !this.isSliderVisible) {
                // Force exit pointer lock immediately
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                
                // Force the cursor to be visible
                document.body.style.cursor = 'auto';
                
                // Directly call showSlider
                this.showSlider();
                
                // Force the cursor to be visible again after a short delay
                setTimeout(() => {
                    document.body.style.cursor = 'auto';
                }, 100);
                
                return true;
            }
        }
        return false;
    }
    
    disablePlayerControls() {
        this.playerControlsEnabled = false;
        // Dispatch a custom event to notify other components
        const event = new CustomEvent('carouselControlsEnabled', { 
            detail: { enabled: false } 
        });
        document.dispatchEvent(event);
    }

    enablePlayerControls() {
        this.playerControlsEnabled = true;
        // Dispatch a custom event to notify other components
        const event = new CustomEvent('carouselControlsEnabled', { 
            detail: { enabled: true } 
        });
        document.dispatchEvent(event);
    }

    isControlsEnabled() {
        return this.playerControlsEnabled;
    }
} 