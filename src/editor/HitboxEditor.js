import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class HitboxEditor {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.editorPanel = null;
        this.editorScene = null;
        this.editorCamera = null;
        this.editorRenderer = null;
        this.editorControls = null;
        this.editorClock = null;
        this.editorMixer = null;
        this.editorHitboxes = [];
        this.selectedHitbox = null;
        this.editorEnemyModel = null;
        this.hitboxTable = null;
        this.loadedModelMessage = null;
        
        // Hitbox editor music path
        this.hitboxEditorMusicPath = "assets/sounds/KMRBI_SJ_68_music_loop_cosmicmayn_Fm.wav";
        
        // Game enemy model scales - will be looked up from enemy code
        this.enemyScales = {
            'lokito': 2.0,
            'dnb': 2.0
        };
        
        // Bind the keydown handler to this instance
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        // Debug message to confirm the updated version is loaded
        console.log("HitboxEditor: Updated version with shape selection and position fixes loaded!");
    }

    // Main method to show the editor interface
    show() {
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
                
                // Load and play hitbox editor music
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
                    // Start hitbox editor music
                    this.playHitboxEditorMusic();
                }
                // Add keyboard event listener
                document.addEventListener('keydown', this.handleKeyDown);
            } else {
                this.editorPanel.style.display = 'none';
                // Unmute sounds when hiding
                if (this.audioManager) {
                    this.audioManager.unmute();
                    // Stop hitbox editor music
                    this.audioManager.stopMusic();
                    
                    // Restart the startup percussion loop
                    this.restartStartupMusic();
                }
                // Remove keyboard event listener
                document.removeEventListener('keydown', this.handleKeyDown);
            }
            return;
        }
        
        // Before creating the editor UI, fetch the actual game scales from the game code
        this.updateEnemyScalesFromGameCode()
            .then(() => {
                this.createEditorUI();
            })
            .catch(error => {
                console.error("Error retrieving game scales:", error);
                // Continue with default scales anyway
                this.createEditorUI();
            });
    }
    
    // Play hitbox editor music
    playHitboxEditorMusic() {
        if (!this.audioManager) return;
        
        // Load and play hitbox editor music
        // Use fetch API to load the audio file
        fetch(this.hitboxEditorMusicPath)
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
    
    // New method to fetch actual model scales from game code
    async updateEnemyScalesFromGameCode() {
        try {
            // Look up DNB model scale
            const dnbResponse = await fetch('src/components/DNB.js');
            if (dnbResponse.ok) {
                const dnbText = await dnbResponse.text();
                const scaleMatch = dnbText.match(/const\s+scale\s*=\s*([0-9.]+)/);
                if (scaleMatch && scaleMatch[1]) {
                    this.enemyScales.dnb = parseFloat(scaleMatch[1]);
                    console.log(`*** HitboxEditor DEBUG: Found DNB scale in game code: ${this.enemyScales.dnb}`);
                }
            }
            
            // Look up Lokito model scale
            const lokitoResponse = await fetch('src/components/Lokito.js');
            if (lokitoResponse.ok) {
                const lokitoText = await lokitoResponse.text();
                const scaleMatch = lokitoText.match(/const\s+scale\s*=\s*([0-9.]+)/);
                if (scaleMatch && scaleMatch[1]) {
                    this.enemyScales.lokito = parseFloat(scaleMatch[1]);
                    console.log(`*** HitboxEditor DEBUG: Found Lokito scale in game code: ${this.enemyScales.lokito}`);
                }
            }
            
            console.log(`*** HitboxEditor DEBUG: Using game scales - Lokito: ${this.enemyScales.lokito}, DNB: ${this.enemyScales.dnb}`);
        } catch (error) {
            console.error("Error fetching model scales from game code:", error);
        }
    }
    
    // Create the editor UI - separated from show() method
    createEditorUI() {
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
        
        // Add keyboard event listener
        document.addEventListener('keydown', this.handleKeyDown);
        
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
        
        // Add sidebar content with model selection and controls
        this.createSidebarContent(sidebar, editorContainer);
        
        // Add components to containers
        editorContainer.appendChild(sidebar);
        
        this.editorPanel.appendChild(header);
        this.editorPanel.appendChild(editorContainer);
        
        // Add panel to document
        document.body.appendChild(this.editorPanel);
    }
    
    // Helper to create the sidebar content
    createSidebarContent(sidebar, editorContainer) {
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
        
        // Add enemy options to select
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
        
        // Add hitbox type selector, dimension sliders, and position controls
        this.createHitboxControls(hitboxControlsSection);
        
        // Create 3D viewport
        const viewport = document.createElement('div');
        viewport.style.flex = '1';
        viewport.style.backgroundColor = '#1E1E1E';
        viewport.style.position = 'relative';
        
        // Add viewport placeholder and controls
        this.createViewportElements(viewport);
        
        // Create action buttons
        const actionButtonsContainer = document.createElement('div');
        actionButtonsContainer.style.marginTop = '20px';
        
        // Add load model button and other action buttons
        this.createActionButtons(actionButtonsContainer, modelSelect, viewport);
        
        // Append all controls to sidebar
        sidebar.appendChild(modelSelectContainer);
        sidebar.appendChild(hitboxControlsSection);
        sidebar.appendChild(actionButtonsContainer);
        
        // Add viewport to editor container
        editorContainer.appendChild(viewport);
        
        // Initialize the 3D viewport
        this.initEditorViewport(viewport);
    }
    
    // Initialize the 3D viewport for the editor
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
            
            const positionCell = document.createElement('td');
            positionCell.textContent = `${hitbox.position.x.toFixed(1)}, ${hitbox.position.y.toFixed(1)}, ${hitbox.position.z.toFixed(1)}`;
            positionCell.style.padding = '4px';
            positionCell.style.borderBottom = '1px solid #333';
            positionCell.style.fontSize = '12px';
            
            const dimensionCell = document.createElement('td');
            dimensionCell.textContent = `${hitbox.scale.x.toFixed(1)} × ${hitbox.scale.y.toFixed(1)} × ${hitbox.scale.z.toFixed(1)}`;
            dimensionCell.style.padding = '4px';
            dimensionCell.style.borderBottom = '1px solid #333';
            dimensionCell.style.fontSize = '12px';
            
            row.appendChild(idCell);
            row.appendChild(typeCell);
            row.appendChild(positionCell);
            row.appendChild(dimensionCell);
            
            this.hitboxTable.body.appendChild(row);
        });
    }
    
    // Select a hitbox for editing
    selectHitbox(hitbox) {
        console.log(`*** HitboxEditor DEBUG: Selecting hitbox:`, hitbox ? 
            `${hitbox.hitboxType} (position: ${hitbox.position.x.toFixed(2)}, ${hitbox.position.y.toFixed(2)}, ${hitbox.position.z.toFixed(2)})` : 'None');
        
        // Deselect current hitbox if any
        if (this.selectedHitbox) {
            const material = this.selectedHitbox.material;
            material.color.setHex(this.selectedHitbox.userData.originalColor);
            material.opacity = 0.3;
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
            
            // Update UI controls
            this.updateHitboxControls(hitbox);
            
            console.log(`*** HitboxEditor DEBUG: Hitbox selected - Type: ${hitbox.hitboxType}, Shape: ${hitbox.hitboxShape}, Multiplier: ${hitbox.userData.damageMultiplier}`);
        } else {
            // Clear UI controls
            this.clearHitboxControls();
            console.log('*** HitboxEditor DEBUG: No hitbox selected, cleared controls');
        }
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
        
        // Add properties
        hitbox.hitboxType = 'Default';
        hitbox.hitboxShape = 'box';
        
        // Add userData properties
        hitbox.userData = {
            isHitbox: true,
            shape: 'box',
            damageMultiplier: '1x'
        };
        
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
    
    // Save hitbox data to a JSON file
    saveHitboxData() {
        if (!this.editorEnemyModel || this.editorHitboxes.length === 0) {
            console.warn('*** HitboxEditor DEBUG: No model or hitboxes to save');
            alert('No hitboxes to save!');
            return;
        }

        // Get the model type from the enemy model
        const modelType = this.editorEnemyModel.userData.modelType;
        if (!modelType) {
            console.error('*** HitboxEditor DEBUG: No model type found on the editor enemy model');
            alert('Error: Model type not found. Cannot save hitboxes.');
            return;
        }

        // Get model scale for reference
        let modelScale = 1.0;
        const inGameScale = 2.0; // In-game scale for enemies
        
        // Try to get the actual scale from the model if available
        if (this.editorEnemyModel.children.length > 0) {
            const sceneObject = this.editorEnemyModel.children[0];
            if (sceneObject && sceneObject.scale) {
                modelScale = sceneObject.scale.x;
            }
        }
        
        console.log(`*** HitboxEditor DEBUG: Model scale is ${modelScale}x, in-game scale is ${inGameScale}x`);
        
        // Check if scale matches game scale
        const scaleMatches = Math.abs(modelScale - inGameScale) < 0.01;
        if (!scaleMatches) {
            console.warn(`*** HitboxEditor DEBUG: WARNING - Editor scale (${modelScale}x) doesn't match in-game scale (${inGameScale}x)`);
        }

        // Collect hitbox data - use a simplified array format without modelScale info for game compatibility
        const hitboxes = [];
        this.editorHitboxes.forEach((hitbox, index) => {
            // Get the hitbox properties, store raw positions and scales (no adjustment needed in editor)
            const hitboxData = {
                type: hitbox.hitboxType || hitbox.userData.hitboxType || 'Default',
                shape: hitbox.hitboxShape || hitbox.userData.shape || 'box',
                damageMultiplier: hitbox.userData.damageMultiplier || '1x',
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
            
            console.log(`*** HitboxEditor DEBUG: Saving hitbox ${index} (${hitboxData.type}), position: (${hitboxData.position.x}, ${hitboxData.position.y}, ${hitboxData.position.z}), scale: (${hitboxData.scale.x}, ${hitboxData.scale.y}, ${hitboxData.scale.z})`);
            
            hitboxes.push(hitboxData);
        });

        // Convert to JSON - For compatibility with existing code, we now save just the array
        const jsonData = JSON.stringify(hitboxes, null, 2);
        
        console.log(`*** HitboxEditor DEBUG: Hitbox data for ${modelType} (${hitboxes.length} hitboxes):`);
        console.log(jsonData);

        // Create a blob and download link
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${modelType.toLowerCase()}_hitboxes.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success message
        const message = scaleMatches ? 
            `Saved ${hitboxes.length} hitboxes for ${modelType} with correct scale (${modelScale}x)` :
            `Saved ${hitboxes.length} hitboxes for ${modelType}, but WARNING: editor scale (${modelScale}x) doesn't match in-game scale (${inGameScale}x)`;
        
        alert(message);
        console.log(`*** HitboxEditor DEBUG: ${message}`);
        
        // Also try to directly save to the assets folder
        try {
            this.saveToAssetsFolder(modelType, jsonData);
        } catch (error) {
            console.error(`*** HitboxEditor DEBUG: Error saving to assets folder:`, error);
        }
    }
    
    // Helper method to try saving directly to assets folder
    saveToAssetsFolder(modelType, jsonData) {
        const filePath = `assets/hitboxes/${modelType.toLowerCase()}_hitboxes.json`;
        console.log(`*** HitboxEditor DEBUG: Attempting to save directly to ${filePath}`);
        
        // We can only try this if we have the File System Access API (modern browsers)
        if (window.showSaveFilePicker) {
            console.log('*** HitboxEditor DEBUG: File System Access API available, attempting to use it');
            // For security reasons, browser will prompt user for file location
            alert(`Please select the "${filePath}" file in the next dialog to save directly to the assets folder.`);
        } else {
            console.log('*** HitboxEditor DEBUG: File System Access API not available, user must manually place the downloaded file');
            alert(`To update the game with these hitboxes, please manually copy the downloaded JSON file to: ${filePath}`);
        }
    }
    
    // Load enemy model for the editor
    loadEnemyModelForEditor(modelType, viewportElement) {
        if (!this.editorScene) {
            console.error("HitboxEditor: Editor scene not initialized");
            return;
        }
        
        // Remove any existing models
        if (this.editorEnemyModel) {
            this.editorScene.remove(this.editorEnemyModel);
            this.editorEnemyModel = null;
        }
        
        console.log(`*** HitboxEditor DEBUG: Loading ${modelType} model for editor`);
        
        // Create a reference object as the model container
        const modelContainer = new THREE.Object3D();
        modelContainer.userData.modelType = modelType; // Store model type for reference
        this.editorScene.add(modelContainer);
        this.editorEnemyModel = modelContainer;
        
        // Clear any existing hitboxes
        this.editorHitboxes = [];
        this.selectedHitbox = null;
        
        // Remove existing keydown listener before adding a new one to avoid duplicates
        document.removeEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Determine model path and scale based on enemy type - USE EXACTLY SAME AS IN-GAME
        let modelPath = '';
        let modelScale = 2.0;  // Using the same scale as in-game
        
        switch(modelType.toLowerCase()) {
            case 'lokito':
                // Same path as in Lokito.js
                modelPath = 'assets/3d models/zombie 2/132_necrozomb9.glb';
                modelScale = 2.0; // Use in-game scale to match appearance
                break;
            case 'dnb':
                // Same path as in DNB.js
                modelPath = 'assets/3d models/zombie 5/DNB4.glb';
                modelScale = 2.0; // Use in-game scale to match appearance
                break;
            default:
                console.error(`Unknown model type: ${modelType}`);
                return;
        }
        
        console.log(`*** HitboxEditor DEBUG: Attempting to load model from path: ${modelPath} with scale ${modelScale}x (using in-game scale to match visual appearance)`);
        
        // Load the model
        const loader = new GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => {
                console.log(`*** HitboxEditor DEBUG: Loaded GLTF for ${modelType}, applying scale: 1.0 (forced editor scale)`);
                
                // Remove previous model and hitboxes
                if (this.editorEnemyModel) {
                    this.editorScene.remove(this.editorEnemyModel);
                    this.editorHitboxes.forEach(hitbox => {
                        hitbox.geometry.dispose();
                        hitbox.material.dispose();
                    });
                    this.editorHitboxes = [];
                    this.selectHitbox(null); // Deselect any hitbox
                }
                
                // Use a container for the model and its hitboxes
                this.editorEnemyModel = new THREE.Group();
                this.editorEnemyModel.userData.modelType = modelType; // Store type
                
                const sceneObject = gltf.scene;
                
                // ** Force the visual scale in the editor to 1.0 **
                // The fetched `modelScale` (e.g., 2.0) represents the in-game scale.
                // To make the editor visually match the game, we set the scale here to 1.0.
                sceneObject.scale.set(1.0, 1.0, 1.0);
                console.log(`*** HitboxEditor DEBUG: Forcing editor visual scale to 1.0 for ${modelType}`);
                
                // Apply default scale to the container if needed (should be 1.0 here)
                // this.editorEnemyModel.scale.set(scale, scale, scale); // Keep container scale at 1
                
                this.editorEnemyModel.add(sceneObject); // Add model scene to the container
                
                this.editorScene.add(this.editorEnemyModel); // Add container to editor scene
                
                // Apply animations if they exist
                if (gltf.animations && gltf.animations.length > 0) {
                    this.editorMixer = new THREE.AnimationMixer(sceneObject);
                    const action = this.editorMixer.clipAction(gltf.animations[0]); // Assuming first animation
                    action.play();
                } else {
                    this.editorMixer = null; // No animations
                }
                
                // Adjust camera position based on model size
                const box = new THREE.Box3().setFromObject(this.editorEnemyModel);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = this.editorCamera.fov * (Math.PI / 180);
                let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                cameraZ *= 1.5; // Add some distance
                
                this.editorCamera.position.set(center.x, center.y + size.y / 2, center.z + cameraZ);
                this.editorCamera.lookAt(center);
                
                if (this.editorControls) {
                    this.editorControls.target.copy(center);
                    this.editorControls.update();
                }
                
                // Load and apply existing hitbox data
                this.loadHitboxDataForModel(modelType);
                
                // Hide the 'Load Model' message
                if (this.loadedModelMessage) {
                    this.loadedModelMessage.style.display = 'none';
                }
                
                console.log(`*** HitboxEditor DEBUG: Enemy model ${modelType} loaded and scaled to 1.0 in editor.`);
            },
            (progress) => {
                const percent = progress.loaded / progress.total * 100;
                console.log(`*** HitboxEditor DEBUG: Loading model: ${percent.toFixed(1)}%`);
            },
            (error) => {
                console.error(`*** HitboxEditor DEBUG: Error loading ${modelType} model:`, error);
                // Add a default model and hitbox
                this.addDefaultHitbox();
            }
        );
    }
    
    // Apply hitboxes loaded from a configuration file
    applyLoadedHitboxes(hitboxConfig) {
        if (!this.editorEnemyModel || !hitboxConfig) return;
        
        // Handle both formats (array or object with hitboxes property)
        const hitboxArray = Array.isArray(hitboxConfig) ? hitboxConfig : 
                            (hitboxConfig.hitboxes && Array.isArray(hitboxConfig.hitboxes)) ? 
                            hitboxConfig.hitboxes : null;
        
        if (!hitboxArray || hitboxArray.length === 0) {
            console.warn('*** HitboxEditor DEBUG: No valid hitboxes in config, adding default hitbox');
            this.addDefaultHitbox();
            return;
        }
        
        console.log(`*** HitboxEditor DEBUG: Applying ${hitboxArray.length} hitboxes from configuration`);
        
        // Add each hitbox to the model
        hitboxArray.forEach((hitboxData, index) => {
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
            
            // Create hitbox material
            const material = new THREE.MeshBasicMaterial({
                color: 0x00CC44,
                wireframe: true,
                transparent: true,
                opacity: 0.7
            });
            
            // Create the hitbox mesh
            const hitbox = new THREE.Mesh(geometry, material);
            
            // Set position
            const position = hitboxData.position || { x: 0, y: 0, z: 0 };
            hitbox.position.set(
                parseFloat(position.x) || 0,
                parseFloat(position.y) || 0,
                parseFloat(position.z) || 0
            );
            
            // Set scale
            const scale = hitboxData.scale || { x: 1, y: 1, z: 1 };
            hitbox.scale.set(
                parseFloat(scale.x) || 1,
                parseFloat(scale.y) || 1,
                parseFloat(scale.z) || 1
            );
            
            // Set hitbox properties
            hitbox.hitboxType = hitboxData.type || 'Default';
            hitbox.hitboxShape = shape;
            
            // Add metadata
            hitbox.userData = {
                isHitbox: true,
                hitboxType: hitboxData.type || 'Default',
                damageMultiplier: hitboxData.damageMultiplier || '1x',
                shape: shape
            };
            
            // Add to model and track
            this.editorEnemyModel.add(hitbox);
            this.editorHitboxes.push(hitbox);
            
            console.log(`*** HitboxEditor DEBUG: Added hitbox ${index} (${hitbox.hitboxType}) at position (${position.x}, ${position.y}, ${position.z}) with scale (${scale.x}, ${scale.y}, ${scale.z})`);
        });
        
        // Update the hitbox table
        this.updateHitboxTable();
    }
    
    // Add a default hitbox if no configuration is available
    addDefaultHitbox() {
        if (!this.editorEnemyModel) return;
        
        console.log('*** HitboxEditor DEBUG: Adding default hitbox');
        
        // Create a default hitbox
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00CC44,
            wireframe: true,
            transparent: true,
            opacity: 0.7
        });
        
        const hitbox = new THREE.Mesh(geometry, material);
        hitbox.position.set(0, 1, 0); // Positioned at center of model, slightly elevated
        
        // Set properties
        hitbox.hitboxType = 'Default';
        hitbox.hitboxShape = 'box';
        hitbox.userData = {
            isHitbox: true,
            hitboxType: 'Default',
            damageMultiplier: '1x',
            shape: 'box'
        };
        
        // Add to model and track
        this.editorEnemyModel.add(hitbox);
        this.editorHitboxes.push(hitbox);
        
        // Update the table
        this.updateHitboxTable();
    }
    
    // Helper to create hitbox controls (type selector, sliders, etc.)
    createHitboxControls(container) {
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
        
        container.appendChild(hitboxTypeContainer);
        
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
        const hitboxShapes = ['Box', 'Sphere', 'Cylinder', 'Pill'];
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
        
        container.appendChild(hitboxShapeContainer);
        
        // Create damage multiplier input
        const damageMultiplierContainer = document.createElement('div');
        damageMultiplierContainer.style.marginBottom = '15px';
        
        const damageMultiplierLabel = document.createElement('label');
        damageMultiplierLabel.textContent = 'Damage Multiplier:';
        damageMultiplierLabel.style.display = 'block';
        damageMultiplierLabel.style.marginBottom = '5px';
        damageMultiplierLabel.style.color = '#CCC';
        
        const damageMultiplierInput = document.createElement('input');
        damageMultiplierInput.id = 'hitbox-damage-multiplier';
        damageMultiplierInput.type = 'text';
        damageMultiplierInput.value = '1x';
        damageMultiplierInput.style.width = '100%';
        damageMultiplierInput.style.padding = '8px';
        damageMultiplierInput.style.backgroundColor = '#444';
        damageMultiplierInput.style.color = 'white';
        damageMultiplierInput.style.border = '1px solid #555';
        damageMultiplierInput.style.borderRadius = '4px';
        
        // Add change event to update the hitbox's damage multiplier
        damageMultiplierInput.onchange = () => {
            if (this.selectedHitbox) {
                const value = damageMultiplierInput.value;
                this.selectedHitbox.userData.damageMultiplier = value;
                this.updateHitboxTable();
                console.log(`*** HitboxEditor DEBUG: Updated damage multiplier to ${value}`);
            }
        };
        
        damageMultiplierContainer.appendChild(damageMultiplierLabel);
        damageMultiplierContainer.appendChild(damageMultiplierInput);
        
        container.appendChild(damageMultiplierContainer);
        
        // Create sliders for hitbox dimensions
        container.appendChild(this.createSlider('Width', 0.1, 2, 1, 0.1));
        container.appendChild(this.createSlider('Height', 0.1, 2, 1, 0.1));
        container.appendChild(this.createSlider('Depth', 0.1, 2, 1, 0.1));
        
        // Add position controls
        container.appendChild(this.createPositionControl('X', 0));
        container.appendChild(this.createPositionControl('Y', 0));
        container.appendChild(this.createPositionControl('Z', 0));
    }
    
    // Helper to create viewport elements
    createViewportElements(viewport) {
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
    }
    
    // Helper to create action buttons
    createActionButtons(container, modelSelect, viewport) {
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
        container.appendChild(createActionButton('Add Hitbox', '#00AA44', () => {
            console.log('Add hitbox clicked');
            this.addNewHitboxToModel();
        }));
        
        container.appendChild(createActionButton('Delete Hitbox', '#AA3333', () => {
            console.log('Delete hitbox clicked');
            if (this.selectedHitbox) {
                this.deleteSelectedHitbox();
            } else {
                alert('Please select a hitbox first');
            }
        }));
        
        container.appendChild(createActionButton('Save Changes', '#0066AA', () => {
            console.log('Save changes clicked');
            this.saveHitboxData();
        }));
        
        // Add show scale info button
        container.appendChild(createActionButton('Show Scale Info', '#888800', () => {
            console.log('Show scale info clicked');
            this.showScaleInfo();
        }));
        
        // Add load model button
        container.appendChild(createActionButton('Load Model', '#8800AA', () => {
            console.log('Load model clicked');
            const selectedModel = modelSelect.value;
            this.loadEnemyModelForEditor(selectedModel, viewport);
        }));
    }
    
    // Helper to create slider for hitbox dimensions
    createSlider(name, min, max, value, step) {
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
        
        // Set ID for each slider based on name for easy selection later
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
    }
    
    // Helper to create position control input
    createPositionControl(name, defaultValue) {
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
        
        // Set ID for each position input for easy selection later
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
        
        // Store current position
        const currentPosition = {
            x: hitbox.position.x,
            y: hitbox.position.y,
            z: hitbox.position.z
        };
        
        // Store current type and multiplier
        const hitboxType = hitbox.hitboxType || 'Default';
        const damageMultiplier = hitbox.userData && hitbox.userData.damageMultiplier ? hitbox.userData.damageMultiplier : '1x';
        
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
            case 'pill': {
                // Create a pill shape (cylinder with hemispheres on ends)
                const radius = 0.5;
                const cylinderHeight = 1;
                
                // Create group for pill shape components
                const group = new THREE.Group();
                
                // Create cylinder for the middle part
                const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, cylinderHeight, 16);
                const cylinderMesh = new THREE.Mesh(cylinderGeometry, hitbox.material);
                group.add(cylinderMesh);
                
                // Create spheres for the ends
                const sphereGeometry = new THREE.SphereGeometry(radius, 16, 16);
                
                const topSphere = new THREE.Mesh(sphereGeometry, hitbox.material);
                topSphere.position.y = cylinderHeight / 2;
                group.add(topSphere);
                
                const bottomSphere = new THREE.Mesh(sphereGeometry, hitbox.material);
                bottomSphere.position.y = -cylinderHeight / 2;
                group.add(bottomSphere);
                
                // Replace hitbox with group
                hitbox.parent.add(group);
                group.position.copy(hitbox.position);
                group.scale.copy(hitbox.scale);
                group.rotation.copy(hitbox.rotation);
                group.hitboxType = hitboxType;
                group.hitboxShape = 'pill';
                
                // Copy userData
                group.userData = {
                    damageMultiplier: damageMultiplier,
                    shape: 'pill',
                    isHitbox: true
                };
                
                // Remove old hitbox
                hitbox.parent.remove(hitbox);
                
                // Update references
                const index = this.editorHitboxes.indexOf(hitbox);
                if (index !== -1) {
                    this.editorHitboxes[index] = group;
                }
                
                // Update selection
                this.selectHitbox(group);
                
                // Dispose of old geometry
                oldGeometry.dispose();
                
                // Early return because we've already handled everything
                return;
            }
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
        
        // Update userData
        if (!hitbox.userData) hitbox.userData = {};
        hitbox.userData.shape = shape;
        hitbox.userData.damageMultiplier = damageMultiplier;
        hitbox.userData.isHitbox = true;
        
        // Render scene immediately to show the change
        if (this.editorRenderer && this.editorScene && this.editorCamera) {
            this.editorRenderer.render(this.editorScene, this.editorCamera);
        }
    }
    
    // Method to show scale information for the model and hitboxes
    showScaleInfo() {
        if (!this.editorEnemyModel) {
            alert('No model loaded to show scale information.');
            return;
        }
        
        const modelScale = {
            x: this.editorEnemyModel.scale.x || 2.0,
            y: this.editorEnemyModel.scale.y || 2.0,
            z: this.editorEnemyModel.scale.z || 2.0
        };
        
        let message = `Model Scale Information\n`;
        message += `========================\n`;
        message += `Model: ${this.editorEnemyModel.userData.modelType || 'Unknown'}\n`;
        message += `Editor Scale: x=${modelScale.x.toFixed(2)}, y=${modelScale.y.toFixed(2)}, z=${modelScale.z.toFixed(2)}\n\n`;
        
        // Show in-game scale information with emphasis
        message += `IN-GAME SCALE INFO (IMPORTANT)\n`;
        message += `==============================\n`;
        
        // Show correct scale for specific enemy types
        if (this.editorEnemyModel.userData.modelType === 'Lokito') {
            message += `Lokito in-game scale: x=2.00, y=2.00, z=2.00\n`;
            message += `Current editor scale: x=2.00, y=2.00, z=2.00\n`;
            message += `The editor now uses the same scale as the game (2.0) for accurate visual representation.\n\n`;
        } else if (this.editorEnemyModel.userData.modelType === 'DNB') {
            message += `DNB in-game scale: x=2.00, y=2.00, z=2.00\n`;
            message += `Current editor scale: x=2.00, y=2.00, z=2.00\n`;
            message += `The editor now uses the same scale as the game (2.0) for accurate visual representation.\n\n`;
        } else {
            message += `Unknown enemy type - cannot provide in-game scale info.\n\n`;
        }
        
        // Hitbox information
        message += `Hitbox Information\n`;
        message += `=================\n`;
        
        if (this.editorHitboxes.length === 0) {
            message += `No hitboxes added yet.`;
        } else {
            this.editorHitboxes.forEach((hitbox, index) => {
                const type = hitbox.hitboxType || 'Default';
                const shape = hitbox.hitboxShape || 'box';
                
                message += `Hitbox ${index + 1}: ${type} (${shape})\n`;
                message += `Position: x=${hitbox.position.x.toFixed(2)}, y=${hitbox.position.y.toFixed(2)}, z=${hitbox.position.z.toFixed(2)}\n`;
                message += `Scale: x=${hitbox.scale.x.toFixed(2)}, y=${hitbox.scale.y.toFixed(2)}, z=${hitbox.scale.z.toFixed(2)}\n\n`;
            });
        }
        
        // Add advice about how to ensure consistent hitboxes
        message += `IMPORTANT: New scale workflow\n`;
        message += `==========================\n`;
        message += `1. The editor now uses a 1.0 scale while the game uses 2.0 scale\n`;
        message += `2. This change makes hitbox placement more intuitive in the editor\n`;
        message += `3. Hitbox positions and dimensions will automatically be adjusted for the game\n`;
        message += `4. No need to halve values anymore - what you see in the editor is what you'll get in the game\n`;
        
        alert(message);
    }

    // Create a new hitbox and add it to the scene
    createHitbox(options = {}) {
        console.log(`*** HitboxEditor DEBUG: Creating new hitbox with options:`, options);
        
        // Check if we have an enemy model to add hitboxes to
        if (!this.editorEnemyModel) {
            console.error('*** HitboxEditor DEBUG: No enemy model to add hitbox to');
            alert('Load an enemy model first!');
            return null;
        }
        
        // Default hitbox options
        const hitboxType = options.type || 'Body';
        const hitboxShape = options.shape || 'box';
        const hitboxColor = options.color || this.getHitboxColor(hitboxType);
        const hitboxSize = options.size || { x: 1, y: 1, z: 1 };
        const hitboxPosition = options.position || { x: 0, y: 1, z: 0 };
        const damageMultiplier = options.damageMultiplier || '1x';
        
        console.log(`*** HitboxEditor DEBUG: Creating ${hitboxType} hitbox at position (${hitboxPosition.x}, ${hitboxPosition.y}, ${hitboxPosition.z})`);
        
        // Create mesh geometry based on shape
        let geometry;
        if (hitboxShape === 'sphere') {
            const radius = (hitboxSize.x + hitboxSize.y + hitboxSize.z) / 6;
            geometry = new THREE.SphereGeometry(radius, 16, 16);
            console.log(`*** HitboxEditor DEBUG: Created sphere geometry with radius ${radius}`);
        } else if (hitboxShape === 'cylinder') {
            const radius = (hitboxSize.x + hitboxSize.z) / 4;
            const height = hitboxSize.y;
            geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
            console.log(`*** HitboxEditor DEBUG: Created cylinder geometry with radius ${radius} and height ${height}`);
        } else {
            // Default to box
            geometry = new THREE.BoxGeometry(hitboxSize.x, hitboxSize.y, hitboxSize.z);
            console.log(`*** HitboxEditor DEBUG: Created box geometry with dimensions (${hitboxSize.x}, ${hitboxSize.y}, ${hitboxSize.z})`);
        }
        
        // Create material for the hitbox - transparent with wireframe
        const material = new THREE.MeshBasicMaterial({
            color: hitboxColor,
            transparent: true,
            opacity: 0.3,
            wireframe: true,
            depthTest: true
        });
        
        // Create the hitbox mesh
        const hitbox = new THREE.Mesh(geometry, material);
        hitbox.position.set(hitboxPosition.x, hitboxPosition.y, hitboxPosition.z);
        
        // Store hitbox type and other properties
        hitbox.hitboxType = hitboxType;
        hitbox.hitboxShape = hitboxShape;
        hitbox.userData = {
            isHitbox: true,
            hitboxType: hitboxType,
            shape: hitboxShape,
            damageMultiplier: damageMultiplier,
            originalColor: hitboxColor
        };
        
        // Add to editor model and hitbox list
        this.editorEnemyModel.add(hitbox);
        this.editorHitboxes.push(hitbox);
        
        // Add to editor helpers for movement
        this.addHitboxControls(hitbox);
        
        // Set as selected hitbox
        this.selectHitbox(hitbox);
        
        console.log(`*** HitboxEditor DEBUG: Added ${hitboxType} hitbox #${this.editorHitboxes.length} to model`);
        
        return hitbox;
    }

    // Get hitbox color based on type
    getHitboxColor(type) {
        const hitboxColors = {
            'Head': 0xff0000,    // Red
            'Body': 0x00ff00,    // Green
            'Limb': 0x0000ff,    // Blue
            'Weak': 0xffff00,    // Yellow
            'Armor': 0x808080,   // Gray
            'Default': 0xffa500  // Orange
        };
        
        return hitboxColors[type] || hitboxColors['Default'];
    }

    // Update UI controls with hitbox data
    updateHitboxControls(hitbox) {
        console.log('*** HitboxEditor DEBUG: Updating UI controls with hitbox data');
        
        // Update hitbox type dropdown
        const hitboxTypeSelect = document.querySelector('#hitbox-type-select');
        if (hitboxTypeSelect) {
            console.log(`*** HitboxEditor DEBUG: Setting hitbox type dropdown to ${hitbox.hitboxType}`);
            // Find the option with matching text
            for (let i = 0; i < hitboxTypeSelect.options.length; i++) {
                if (hitboxTypeSelect.options[i].textContent === hitbox.hitboxType) {
                    hitboxTypeSelect.selectedIndex = i;
                    break;
                }
            }
        } else {
            console.warn('*** HitboxEditor DEBUG: No hitbox type dropdown found in the DOM');
        }
        
        // Update hitbox shape dropdown
        const hitboxShapeSelect = document.querySelector('#hitbox-shape-select');
        if (hitboxShapeSelect && hitbox.hitboxShape) {
            console.log(`*** HitboxEditor DEBUG: Setting hitbox shape dropdown to ${hitbox.hitboxShape}`);
            // Find the option with matching value
            for (let i = 0; i < hitboxShapeSelect.options.length; i++) {
                if (hitboxShapeSelect.options[i].value === hitbox.hitboxShape) {
                    hitboxShapeSelect.selectedIndex = i;
                    break;
                }
            }
        } else {
            console.warn('*** HitboxEditor DEBUG: No hitbox shape dropdown found in the DOM or no shape defined');
        }
        
        // Update position inputs
        this.updatePositionInputs(hitbox.position);
        
        // Update size/dimension inputs based on shape
        this.updateDimensionInputs(hitbox);
        
        // Update damage multiplier if available
        const damageInput = document.querySelector('#hitbox-damage-multiplier');
        if (damageInput && hitbox.userData.damageMultiplier !== undefined) {
            damageInput.value = hitbox.userData.damageMultiplier;
            console.log(`*** HitboxEditor DEBUG: Set damage multiplier input to ${hitbox.userData.damageMultiplier}`);
        }
    }
    
    // Clear all hitbox UI controls
    clearHitboxControls() {
        console.log('*** HitboxEditor DEBUG: Clearing all hitbox UI controls');
        
        // Reset dropdowns to default
        const hitboxTypeSelect = document.querySelector('#hitbox-type-select');
        if (hitboxTypeSelect) hitboxTypeSelect.selectedIndex = 0;
        
        const hitboxShapeSelect = document.querySelector('#hitbox-shape-select');
        if (hitboxShapeSelect) hitboxShapeSelect.selectedIndex = 0;
        
        // Clear position inputs
        const positionInputs = document.querySelectorAll('[id^="hitbox-position-"]');
        positionInputs.forEach(input => {
            input.value = "0";
        });
        
        // Clear dimension inputs
        const dimensionInputs = document.querySelectorAll('[id^="hitbox-size-"], #hitbox-radius');
        dimensionInputs.forEach(input => {
            input.value = "1";
        });
        
        // Clear damage multiplier
        const damageInput = document.querySelector('#hitbox-damage-multiplier');
        if (damageInput) damageInput.value = "1";
    }
    
    // Update position inputs with vector3 values
    updatePositionInputs(position) {
        console.log(`*** HitboxEditor DEBUG: Updating position inputs with (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        
        // Get position inputs by their IDs
        const posX = document.querySelector('#hitbox-position-x');
        const posY = document.querySelector('#hitbox-position-y');
        const posZ = document.querySelector('#hitbox-position-z');
        
        // Set position values with 2 decimal precision
        if (posX) posX.value = position.x.toFixed(2);
        if (posY) posY.value = position.y.toFixed(2);
        if (posZ) posZ.value = position.z.toFixed(2);
        
        console.log(`*** HitboxEditor DEBUG: Position inputs updated to (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    }
    
    // Update dimension inputs based on hitbox shape
    updateDimensionInputs(hitbox) {
        console.log(`*** HitboxEditor DEBUG: Updating dimension inputs for shape: ${hitbox.hitboxShape}`);
        
        // Get the hitbox scale values
        const scaleX = hitbox.scale.x;
        const scaleY = hitbox.scale.y;
        const scaleZ = hitbox.scale.z;
        
        console.log(`*** HitboxEditor DEBUG: Hitbox scale is (${scaleX.toFixed(2)}, ${scaleY.toFixed(2)}, ${scaleZ.toFixed(2)})`);
        
        switch(hitbox.hitboxShape) {
            case 'sphere':
                // For spheres, use the scale as the radius
                const radiusInput = document.querySelector('#hitbox-size-radius');
                const radiusDisplay = document.querySelector('#hitbox-size-radius-display');
                
                if (radiusInput) {
                    // Use the average scale for spheres
                    const radius = (scaleX + scaleY + scaleZ) / 3;
                    radiusInput.value = radius.toFixed(2);
                    if (radiusDisplay) radiusDisplay.textContent = radius.toFixed(2);
                    console.log(`*** HitboxEditor DEBUG: Set radius input to ${radius.toFixed(2)}`);
                }
                break;
                
            case 'cylinder':
                // For cylinders, use x/z scale for radius and y for height
                const cylRadiusInput = document.querySelector('#hitbox-size-width');
                const cylHeightInput = document.querySelector('#hitbox-size-height');
                const cylRadiusDisplay = document.querySelector('#hitbox-size-width-display');
                const cylHeightDisplay = document.querySelector('#hitbox-size-height-display');
                
                if (cylRadiusInput) {
                    // Use the average of x and z scale for cylinder radius
                    const radius = (scaleX + scaleZ) / 2;
                    cylRadiusInput.value = radius.toFixed(2);
                    if (cylRadiusDisplay) cylRadiusDisplay.textContent = radius.toFixed(2);
                }
                
                if (cylHeightInput) {
                    cylHeightInput.value = scaleY.toFixed(2);
                    if (cylHeightDisplay) cylHeightDisplay.textContent = scaleY.toFixed(2);
                }
                
                console.log(`*** HitboxEditor DEBUG: Set cylinder inputs - radius: ${((scaleX + scaleZ) / 2).toFixed(2)}, height: ${scaleY.toFixed(2)}`);
                break;
                
            case 'box':
            default:
                // For boxes, use individual axis scales
                const widthInput = document.querySelector('#hitbox-size-width');
                const heightInput = document.querySelector('#hitbox-size-height');
                const depthInput = document.querySelector('#hitbox-size-depth');
                const widthDisplay = document.querySelector('#hitbox-size-width-display');
                const heightDisplay = document.querySelector('#hitbox-size-height-display');
                const depthDisplay = document.querySelector('#hitbox-size-depth-display');
                
                if (widthInput) {
                    widthInput.value = scaleX.toFixed(2);
                    if (widthDisplay) widthDisplay.textContent = scaleX.toFixed(2);
                }
                
                if (heightInput) {
                    heightInput.value = scaleY.toFixed(2);
                    if (heightDisplay) heightDisplay.textContent = scaleY.toFixed(2);
                }
                
                if (depthInput) {
                    depthInput.value = scaleZ.toFixed(2);
                    if (depthDisplay) depthDisplay.textContent = scaleZ.toFixed(2);
                }
                
                console.log(`*** HitboxEditor DEBUG: Set box inputs - width: ${scaleX.toFixed(2)}, height: ${scaleY.toFixed(2)}, depth: ${scaleZ.toFixed(2)}`);
                break;
        }
    }

    // Helper method to handle keyboard events
    handleKeyDown(event) {
        // Only handle events when editor is visible
        if (!this.editorPanel || this.editorPanel.style.display === 'none') {
            return;
        }
        
        // Handle specific keyboard shortcuts
        switch (event.key.toLowerCase()) {
            case 'r':
                // Rotate selected hitbox
                if (this.selectedHitbox) {
                    console.log('*** HitboxEditor DEBUG: Rotating hitbox with R key');
                    // Rotate 90 degrees around Y axis
                    this.selectedHitbox.rotation.y += Math.PI / 2;
                    
                    // Render scene immediately to show the change
                    if (this.editorRenderer && this.editorScene && this.editorCamera) {
                        this.editorRenderer.render(this.editorScene, this.editorCamera);
                    }
                }
                break;
            case 'g':
                // Enable move mode for selected hitbox
                if (this.selectedHitbox) {
                    console.log('*** HitboxEditor DEBUG: Move mode enabled with G key');
                    // Toggle move mode (placeholder - would implement actual gizmo in a full implementation)
                }
                break;
            case 's':
                // Enable scale mode for selected hitbox
                if (this.selectedHitbox) {
                    console.log('*** HitboxEditor DEBUG: Scale mode enabled with S key');
                    // Toggle scale mode (placeholder - would implement actual gizmo in a full implementation)
                }
                break;
            case 'delete':
                // Delete the selected hitbox
                if (this.selectedHitbox) {
                    console.log('*** HitboxEditor DEBUG: Deleting hitbox with DELETE key');
                    this.deleteSelectedHitbox();
                }
                break;
        }
    }

    // Clean up resources when editor is closed
    cleanUp() {
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Stop hitbox editor music
        if (this.audioManager) {
            this.audioManager.stopMusic();
            
            // Restart the startup percussion loop
            this.restartStartupMusic();
        }
        
        // Clean up THREE.js resources
        if (this.editorScene) {
            // Dispose of geometries and materials
            this.editorScene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
        
        // Dispose of renderer and other resources
        if (this.editorRenderer) {
            this.editorRenderer.dispose();
        }
    }

    // Restart the startup music when exiting the editor
    restartStartupMusic() {
        if (!this.audioManager) return;
        
        const percussionLoop = 'assets/sounds/PM_EN_90_Percussion_FX_Loop_Race.wav';
        
        // Set up audio analyzer for visualization
        this.audioManager.setupAnalyser((audioData) => {
            // Just pass audio data through - the Engine class has the main visualization logic
        });
        
        // Start playing the percussion loop
        this.audioManager.playWithAnalyzer(percussionLoop);
        console.log("Restarted startup percussion loop");
    }
} 