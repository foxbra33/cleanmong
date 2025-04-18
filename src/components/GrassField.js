import * as THREE from 'three';

export class GrassField extends THREE.Group {
    constructor(width = 1000, depth = 1000, instances = 2000000) {
        super();
        
        this.instances = instances;
        this.width = width;
        this.depth = depth;
        this.height = -2; // Match the ground height from PhysicsWorld
        
        // Arrays for geometry data
        this.positions = [];
        this.indices = [];
        this.uvs = [];
        this.grassPositions = [];
        this.angles = [];
        
        this.createGrass();
    }
    
    createGrass() {
        // Create basic blade geometry with a sharp point
        this.positions.push(0.15, 0, 0);     // Right bottom
        this.positions.push(-0.15, 0, 0);    // Left bottom
        this.positions.push(0, 1.8, 0);      // Top point - sharp
        
        // Triangle indices - single triangle for a blade
        this.indices.push(0, 1, 2);
        
        // UV coordinates
        this.uvs.push(1.0, 0.0);
        this.uvs.push(0.0, 0.0);
        this.uvs.push(0.5, 1.0);
        
        // Create random positions for grass blades
        for (let i = 0; i < this.instances; i++) {
            // Random x,z position on the ground plane
            const x = Math.random() * this.width - this.width / 2;
            const z = Math.random() * this.depth - this.depth / 2;
            
            // Add the position (y is the ground height)
            this.grassPositions.push(x, this.height, z);
            
            // Random angle for rotation
            this.angles.push(Math.random() * Math.PI * 2);
        }
        
        // Create instanced buffer geometry
        const grassGeometry = new THREE.InstancedBufferGeometry();
        grassGeometry.instanceCount = this.instances;
        
        // Set geometry attributes
        grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
        grassGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
        grassGeometry.setIndex(this.indices);
        
        // Set instance attributes
        grassGeometry.setAttribute(
            'instancePosition', 
            new THREE.InstancedBufferAttribute(new Float32Array(this.grassPositions), 3)
        );
        grassGeometry.setAttribute(
            'instanceAngle', 
            new THREE.InstancedBufferAttribute(new Float32Array(this.angles), 1)
        );
        
        // Create shader material for grass
        const grassMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                attribute vec3 instancePosition;
                attribute float instanceAngle;
                
                varying vec2 vUv;
                varying float vHeight;
                
                uniform float time;
                
                void main() {
                    vUv = uv;
                    
                    // Height percentage for color variation (0 at bottom, 1 at top)
                    vHeight = position.y;
                    
                    // Instance positioning
                    vec3 pos = position;
                    
                    // Apply instance rotation around Y axis
                    float angle = instanceAngle;
                    float s = sin(angle);
                    float c = cos(angle);
                    pos.xz = mat2(c, -s, s, c) * pos.xz;
                    
                    // Apply wind effect
                    float windStrength = 0.15;
                    float windSpeed = 1.2;
                    float windOffset = instancePosition.x * 0.01 + instancePosition.z * 0.01;
                    pos.x += sin(time * windSpeed + windOffset) * windStrength * position.y;
                    
                    // Apply height variation with regions of taller grass
                    // Create patches of taller grass using multiple sine waves
                    float baseHeight = 0.35;
                    float noise = sin(instancePosition.x * 0.05) * sin(instancePosition.z * 0.05) * 0.25 + 0.25;
                    float noise2 = sin(instancePosition.x * 0.02 + 1.3) * sin(instancePosition.z * 0.03 + 2.1) * 0.25 + 0.25;
                    float heightVar = baseHeight + max(noise, noise2) * 0.6;
                    // Additional tall patches in specific areas
                    float distFromCenter = length(instancePosition.xz) * 0.01;
                    float tallPatch = 1.0 - smoothstep(0.0, 0.5, distFromCenter);
                    heightVar = max(heightVar, baseHeight + tallPatch * 0.75);
                    
                    float grassHeight = baseHeight + heightVar * 0.4;
                    pos.y *= grassHeight;
                    
                    // Final position
                    vec3 transformed = pos + instancePosition;
                    
                    // Add a bit more height to position
                    transformed.y += 0.05;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                varying float vHeight;
                
                void main() {
                    // Green color gradient from darker at bottom to lighter at top
                    vec3 bottomColor = vec3(0.0, 0.3, 0.0);
                    vec3 topColor = vec3(0.4, 0.85, 0.0);
                    vec3 grassColor = mix(bottomColor, topColor, vHeight);
                    
                    // Apply color based on height
                    gl_FragColor = vec4(grassColor, 1.0);
                    
                    // Alpha cutoff for performance
                    if (gl_FragColor.a < 0.1) discard;
                }
            `,
            uniforms: {
                time: { value: 0 }
            },
            side: THREE.DoubleSide,
            transparent: true
        });
        
        // Create mesh
        this.grassMesh = new THREE.Mesh(grassGeometry, grassMaterial);
        this.grassMesh.frustumCulled = false; // Prevent culling
        
        // Add to group
        this.add(this.grassMesh);
    }
    
    update(deltaTime) {
        if (this.grassMesh && this.grassMesh.material.uniforms) {
            this.grassMesh.material.uniforms.time.value += deltaTime;
        }
    }
} 