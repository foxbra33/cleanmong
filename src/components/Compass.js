import * as THREE from 'three';

export class Compass {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        
        // Create container
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.top = '20px';
        this.container.style.left = '20px';
        this.container.style.width = '120px';
        this.container.style.height = '120px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.borderRadius = '50%';
        this.container.style.zIndex = '1000';
        this.container.style.userSelect = 'none';
        this.container.style.display = 'flex';
        this.container.style.justifyContent = 'center';
        this.container.style.alignItems = 'center';
        this.container.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        
        // Create compass dial
        this.dial = document.createElement('div');
        this.dial.style.position = 'relative';
        this.dial.style.width = '100px';
        this.dial.style.height = '100px';
        this.dial.style.borderRadius = '50%';
        this.dial.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        this.dial.style.border = '2px solid white';
        
        // Create cardinal direction markers and tick marks
        this.createCardinalMarkers();
        
        // Create compass needle
        this.needle = document.createElement('div');
        this.needle.style.position = 'absolute';
        this.needle.style.width = '4px';
        this.needle.style.height = '30px';
        this.needle.style.backgroundColor = 'red';
        this.needle.style.top = '50px'; // Position at center
        this.needle.style.left = '48px';
        this.needle.style.transformOrigin = '50% 0%'; // Rotate from top center
        this.needle.style.transform = 'rotate(0deg)';
        
        // Create center point
        this.centerPoint = document.createElement('div');
        this.centerPoint.style.position = 'absolute';
        this.centerPoint.style.width = '10px';
        this.centerPoint.style.height = '10px';
        this.centerPoint.style.backgroundColor = 'white';
        this.centerPoint.style.borderRadius = '50%';
        this.centerPoint.style.top = '45px';
        this.centerPoint.style.left = '45px';
        
        // Add elements to dial
        this.dial.appendChild(this.needle);
        this.dial.appendChild(this.centerPoint);
        
        // Add dial to container
        this.container.appendChild(this.dial);
        
        // Add container to document
        document.body.appendChild(this.container);
    }
    
    createCardinalMarkers() {
        // Create cardinal direction markers (N, E, S, W)
        const directions = [
            { text: 'N', angle: 0 },
            { text: 'E', angle: 90 },
            { text: 'S', angle: 180 },
            { text: 'W', angle: 270 }
        ];
        
        directions.forEach(dir => {
            const marker = document.createElement('div');
            marker.textContent = dir.text;
            marker.style.position = 'absolute';
            marker.style.color = 'white';
            marker.style.fontWeight = 'bold';
            marker.style.fontSize = '16px';
            marker.style.width = '20px';
            marker.style.height = '20px';
            marker.style.textAlign = 'center';
            marker.style.lineHeight = '20px';
            
            // Position the marker
            const angle = dir.angle * Math.PI / 180;
            const radius = 40; // Distance from center
            const x = Math.sin(angle) * radius;
            const y = -Math.cos(angle) * radius; // Negative because Y is down in CSS
            
            marker.style.left = `${50 + x - 10}px`;
            marker.style.top = `${50 + y - 10}px`;
            
            this.dial.appendChild(marker);
        });
        
        // Create tick marks for intermediate directions (NE, SE, SW, NW)
        const intermediateDirections = [
            { angle: 45 },
            { angle: 135 },
            { angle: 225 },
            { angle: 315 }
        ];
        
        intermediateDirections.forEach(dir => {
            const tick = document.createElement('div');
            tick.style.position = 'absolute';
            tick.style.width = '2px';
            tick.style.height = '10px';
            tick.style.backgroundColor = 'white';
            
            // Position the tick
            const angle = dir.angle * Math.PI / 180;
            const radius = 45; // Distance from center
            const x = Math.sin(angle) * radius;
            const y = -Math.cos(angle) * radius; // Negative because Y is down in CSS
            
            tick.style.left = `${50 + x - 1}px`;
            tick.style.top = `${50 + y - 5}px`;
            
            // Rotate the tick to align with the direction
            tick.style.transform = `rotate(${dir.angle}deg)`;
            
            this.dial.appendChild(tick);
        });
    }
    
    update() {
        // Get camera's forward direction
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        
        // Calculate the angle in the XZ plane (ignoring Y)
        const angle = Math.atan2(direction.x, direction.z);
        
        // Convert to degrees
        let degrees = THREE.MathUtils.radToDeg(angle);
        
        // Normalize to 0-360
        if (degrees < 0) {
            degrees += 360;
        }
        
        // Rotate the needle to match the camera's direction exactly
        // In CSS, 0 degrees is along the positive Y axis (up)
        // So we need to adjust the angle
        this.needle.style.transform = `rotate(${degrees}deg)`;
    }
    
    dispose() {
        // Remove the compass from the DOM
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
} 