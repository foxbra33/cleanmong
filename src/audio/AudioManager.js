export class AudioManager {
    constructor() {
        // Create AudioContext only after user interaction (or attempt)
        this.audioContext = null;
        this.musicBuffer = null;
        this.musicSource = null;
        this.isMusicPlaying = false;
        this.isMuted = false; // Add muted flag to control sound playback
        this.allowedSounds = []; // Sounds that are allowed to play even when muted
        
        // Add audio analysis capabilities
        this.analyser = null;
        this.dataArray = null;
        this.visualCallback = null;
        this.animationFrameId = null;

        // Track active sound sources by type
        this.activeSoundSources = {};

        // Listener to start audio context on first interaction
        this.initAudioContext = this._initAudioContextOnFirstInteraction.bind(this);
        document.body.addEventListener('click', this.initAudioContext, { once: true });
        document.body.addEventListener('keydown', this.initAudioContext, { once: true });
    }

    // Initialize AudioContext safely after user gesture
    _initAudioContextOnFirstInteraction() {
        if (!this.audioContext) {
            try {
                 this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                 console.log("AudioContext initialized.");
                 // If music buffer was loaded before context was ready, try playing now
                 if (this.musicBuffer && !this.isMusicPlaying) {
                      this.playLoop(this.musicBuffer);
                 }
            } catch (e) {
                 console.error("Web Audio API is not supported in this browser", e);
            }
        }
         // Clean up listeners if they are still attached (though {once: true} should handle it)
         document.body.removeEventListener('click', this.initAudioContext);
         document.body.removeEventListener('keydown', this.initAudioContext);
    }

    async loadSound(url) {
        if (!this.audioContext) {
             console.warn("Cannot load sound yet: AudioContext not initialized. Will load after user interaction.");
             // Attempt to fetch anyway, store buffer for later
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status} loading ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            
            // Decode only if context is ready, otherwise store buffer
            if (this.audioContext) {
                 const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                 console.log(`Sound loaded: ${url}`);
                 return audioBuffer;
            } else {
                 // Store raw buffer to decode later
                 console.log(`Sound fetched, decoding deferred: ${url}`);
                 // Hacky: store arrayBuffer directly on the 'musicBuffer' property for now
                 this.musicBuffer = arrayBuffer; 
                 return null; // Indicate not fully loaded
            }
        } catch (error) {
            console.error(`Error loading sound ${url}:`, error);
            return null;
        }
    }

    playLoop(bufferOrArrayBuffer) {
        if (!this.audioContext) {
            console.warn("Cannot play sound: AudioContext not initialized.");
            // Buffer might be stored, will play once context is ready
            return;
        }
        if (this.musicSource) {
            this.musicSource.stop(); // Stop previous music if any
        }

        // Check if we need to decode a stored ArrayBuffer
        if (bufferOrArrayBuffer instanceof ArrayBuffer) {
             console.log("Decoding stored ArrayBuffer...");
             this.audioContext.decodeAudioData(bufferOrArrayBuffer)
                 .then(decodedBuffer => {
                      this.musicBuffer = decodedBuffer; // Store the decoded buffer
                      this._playDecodedLoop(decodedBuffer);
                 })
                 .catch(e => console.error("Error decoding stored audio data:", e));
        } else if (bufferOrArrayBuffer instanceof AudioBuffer) {
             this._playDecodedLoop(bufferOrArrayBuffer);
        }
    }

    _playDecodedLoop(audioBuffer) {
         this.musicSource = this.audioContext.createBufferSource();
         this.musicSource.buffer = audioBuffer;
         this.musicSource.loop = true;
         this.musicSource.connect(this.audioContext.destination);
         this.musicSource.start();
         this.isMusicPlaying = true;
         console.log("Playing music loop.");
    }

    stopMusic() {
        // Also stop visualization if it's running
        this.stopVisualization();
        
        if (this.musicSource && this.isMusicPlaying) {
            this.musicSource.stop();
            this.isMusicPlaying = false;
            console.log("Music stopped.");
        }
    }

    // Method to mute all sounds except specific allowed ones
    muteAllExcept(allowedSoundUrls = []) {
        this.isMuted = true;
        this.allowedSounds = allowedSoundUrls;
        console.log("AudioManager: Muted all sounds except:", allowedSoundUrls);
        
        // Stop any currently playing music
        this.stopMusic();
    }
    
    // Method to mute all sounds
    muteAll() {
        this.isMuted = true;
        this.allowedSounds = [];
        console.log("AudioManager: Muted all sounds");
        
        // Stop any currently playing music
        this.stopMusic();
    }

    // Method to unmute sounds
    unmute() {
        this.isMuted = false;
        this.allowedSounds = [];
        console.log("AudioManager: Unmuted all sounds");
    }

    // Set up analyzer with more specific frequency band analysis
    setupAnalyser(callback) {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log("AudioContext initialized for analyzer setup.");
            } catch (e) {
                console.error("Web Audio API is not supported in this browser", e);
                return;
            }
        }
        
        // Create analyzer with higher FFT resolution for better frequency analysis
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024; // Increased from 256 to 1024 for better resolution
        this.analyser.smoothingTimeConstant = 0.75; // Smooth transitions between frames (0-1)
        
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        
        // Store callback function
        this.visualCallback = callback;
        
        console.log("Enhanced audio analyzer set up successfully");
    }
    
    // Play audio with analyzer
    async playWithAnalyzer(url) {
        if (!this.audioContext || !this.analyser) {
            console.error("AudioContext or Analyzer not initialized");
            return;
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} loading ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // If already playing something, stop it
            if (this.musicSource) {
                this.musicSource.stop();
            }
            
            // Create and connect source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Connect to analyzer
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            // Play the sound
            source.loop = true;
            source.start(0);
            this.musicSource = source;
            this.isMusicPlaying = true;
            
            // Start visualization
            this.startVisualization();
            
            return source;
        } catch (error) {
            console.error(`Error playing audio with analyzer ${url}:`, error);
            return null;
        }
    }
    
    // Start the visualization loop with beat detection
    startVisualization() {
        if (!this.analyser || !this.visualCallback) return;
        
        // Stop any existing visualization first
        this.stopVisualization();
        
        // Bass frequencies we want to detect (around where kicks would be)
        const BASS_RANGE_LOW = 40;
        const BASS_RANGE_HIGH = 150;
        
        // For beat detection
        let lastBassVolume = 0;
        let beatDetected = false;
        
        const updateVisual = () => {
            // Get frequency data
            this.analyser.getByteFrequencyData(this.dataArray);
            
            // Calculate overall volume level (average of all frequencies)
            let sum = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                sum += this.dataArray[i];
            }
            const averageVolume = sum / this.dataArray.length;
            
            // Calculate bass frequency volume (for beat detection)
            let bassSum = 0;
            let bassCount = 0;
            
            // Find the indices for our bass range
            const binCount = this.analyser.frequencyBinCount;
            const nyquist = this.audioContext.sampleRate / 2;
            const lowIndex = Math.floor(BASS_RANGE_LOW * binCount / nyquist);
            const highIndex = Math.ceil(BASS_RANGE_HIGH * binCount / nyquist);
            
            // Sum the bass frequencies
            for (let i = lowIndex; i <= highIndex; i++) {
                bassSum += this.dataArray[i];
                bassCount++;
            }
            
            const bassVolume = bassCount > 0 ? bassSum / bassCount : 0;
            
            // Detect beats (sudden increases in bass volume)
            const bassThreshold = 10; // Minimum change to be considered a beat
            const currentBeatThreshold = 150; // Minimum volume to be considered a beat
            
            // If bass volume jumped significantly and is above minimum threshold
            beatDetected = (bassVolume > lastBassVolume + bassThreshold) && 
                          (bassVolume > currentBeatThreshold);
            
            // Call the visualization callback with the data
            this.visualCallback({
                volume: averageVolume / 255, // Normalize to 0-1
                bassVolume: bassVolume / 255, // Normalize to 0-1
                beatDetected: beatDetected
            });
            
            // Save the current bass volume for next frame
            lastBassVolume = bassVolume;
            
            // Schedule next update
            this.animationFrameId = requestAnimationFrame(updateVisual);
        };
        
        // Start the loop
        updateVisual();
    }
    
    // Stop the visualization
    stopVisualization() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    // Play a sound once (non-looping)
    async playOneShot(url, options = {}) {
        // Check if we're muted and this sound isn't in the allowed list
        if (this.isMuted && !this.allowedSounds.includes(url)) {
            console.log(`Sound ${url} blocked due to mute state`);
            return null; // Don't play sound if muted
        }
        
        if (!this.audioContext) {
            // Try to initialize context
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log("AudioContext initialized for oneshot sound.");
            } catch (e) {
                console.error("Web Audio API is not supported in this browser", e);
                return;
            }
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} loading ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Play the sound
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Apply playback rate if specified (for pitch adjustment)
            if (options.playbackRate !== undefined) {
                source.playbackRate.value = options.playbackRate;
                console.log(`Playing sound with adjusted playback rate: ${options.playbackRate}`);
            }
            
            source.connect(this.audioContext.destination);
            source.start(0);
            
            // Get sound type from URL (e.g., 'rain' from 'rain_sound.wav')
            const soundType = options.type || this.getSoundTypeFromURL(url);
            
            // Track this sound source by type
            if (!this.activeSoundSources[soundType]) {
                this.activeSoundSources[soundType] = [];
            }
            this.activeSoundSources[soundType].push(source);
            
            // Remove from tracking once it's done playing
            source.onended = () => {
                const index = this.activeSoundSources[soundType].indexOf(source);
                if (index !== -1) {
                    this.activeSoundSources[soundType].splice(index, 1);
                }
            };
            
            return source;
        } catch (error) {
            console.error(`Error playing oneshot sound ${url}:`, error);
            return null;
        }
    }
    
    // Helper to extract sound type from URL
    getSoundTypeFromURL(url) {
        // Extract filename without path
        const filename = url.split('/').pop();
        
        // Check for common sound types in the filename
        if (filename.includes('rain')) return 'rain';
        if (filename.includes('gunshot')) return 'weapon';
        if (filename.includes('explosion')) return 'explosion';
        if (filename.includes('footstep')) return 'footstep';
        
        // Default to generic type based on filename
        return filename.split('.')[0];
    }
    
    // Stop all sounds of a specific type
    stopSoundsByType(type) {
        if (!this.activeSoundSources[type] || this.activeSoundSources[type].length === 0) {
            console.log(`No active sounds of type '${type}' to stop`);
            return;
        }
        
        console.log(`Stopping ${this.activeSoundSources[type].length} active sounds of type '${type}'`);
        
        // Create a copy of the array to avoid issues during iteration
        const soundsToStop = [...this.activeSoundSources[type]];
        
        soundsToStop.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                console.warn(`Error stopping sound of type '${type}':`, e);
            }
        });
        
        // Clear the array
        this.activeSoundSources[type] = [];
    }
    
    // Stop specific sound by URL (if it's currently playing)
    stopSound(url) {
        // If it's the currently playing music
        if (this.musicSource && this.isMusicPlaying) {
            console.log(`Stopping sound: ${url}`);
            this.musicSource.stop();
            this.musicSource = null;
            this.isMusicPlaying = false;
        }
        
        // Also try to stop it based on type if recognized
        const soundType = this.getSoundTypeFromURL(url);
        if (soundType && this.activeSoundSources[soundType]) {
            this.stopSoundsByType(soundType);
        }
    }

    // Play a footstep sound with spatial options
    async playFootstepSound(url, options = {}) {
        // Check if we're muted and this sound isn't in the allowed list
        if (this.isMuted && !this.allowedSounds.includes(url)) {
            return null; // Don't play sound if muted
        }
        
        if (!this.audioContext) {
            // Try to initialize context
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log("AudioContext initialized for footstep sound.");
            } catch (e) {
                console.error("Web Audio API is not supported in this browser", e);
                return;
            }
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} loading ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Create audio source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Apply playback rate for speed effect
            if (options.playbackRate !== undefined) {
                source.playbackRate.value = options.playbackRate;
            }
            
            // Create gain node to control volume
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = options.volume !== undefined ? options.volume : 0.7;
            
            // Create stereo panner for left/right positioning
            const pannerNode = this.audioContext.createStereoPanner();
            pannerNode.pan.value = options.pan !== undefined ? options.pan : 0;
            
            // Create chain of audio nodes
            let lastNode = source;
            
            // Connect to panner
            lastNode.connect(pannerNode);
            lastNode = pannerNode;
            
            // Add reverb/echo if specified
            if (options.reverb) {
                if (options.noDelay) {
                    // Create a convolver node for reverb without delay
                    const reverbNode = this.audioContext.createConvolver();
                    
                    // Create a simple impulse response for reverb
                    const sampleRate = this.audioContext.sampleRate;
                    const length = sampleRate * options.reverb; // Length based on reverb time
                    const impulseBuffer = this.audioContext.createBuffer(2, length, sampleRate);
                    
                    // Fill both channels with exponentially decaying noise
                    for (let channel = 0; channel < 2; channel++) {
                        const data = impulseBuffer.getChannelData(channel);
                        for (let i = 0; i < length; i++) {
                            // Exponential decay with random noise
                            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.1));
                        }
                    }
                    
                    // Set the impulse response and connect
                    reverbNode.buffer = impulseBuffer;
                    lastNode.connect(reverbNode);
                    
                    // Mix wet (reverb) and dry (original) signals
                    reverbNode.connect(gainNode);
                    lastNode.connect(gainNode);
                    lastNode = gainNode;
                } else {
                    // Original implementation with delay
                    const reverbNode = this.audioContext.createDelay();
                    reverbNode.delayTime.value = options.reverb;
                    
                    // Create feedback for the delay (echo effect)
                    const feedbackGain = this.audioContext.createGain();
                    feedbackGain.gain.value = 0.2; // 20% feedback for subtle effect
                    
                    // Connect nodes for reverb effect
                    lastNode.connect(reverbNode);
                    reverbNode.connect(feedbackGain);
                    feedbackGain.connect(reverbNode);
                    feedbackGain.connect(gainNode);
                    
                    // Also connect direct signal
                    lastNode.connect(gainNode);
                    lastNode = gainNode;
                }
            } else {
                // No reverb, connect to gain directly
                lastNode.connect(gainNode);
                lastNode = gainNode;
            }
            
            // Final connection to destination
            lastNode.connect(this.audioContext.destination);
            
            // Play the sound
            source.start(0);
            
            // Track this sound source
            if (!this.activeSoundSources['footstep']) {
                this.activeSoundSources['footstep'] = [];
            }
            this.activeSoundSources['footstep'].push(source);
            
            // Remove from tracking once it's done playing
            source.onended = () => {
                const index = this.activeSoundSources['footstep'].indexOf(source);
                if (index !== -1) {
                    this.activeSoundSources['footstep'].splice(index, 1);
                }
            };
            
            return source;
        } catch (error) {
            console.error(`Error playing footstep sound ${url}:`, error);
            return null;
        }
    }

    // Play continuous white noise
    playWhiteNoise(options = {}) {
        if (this.isMuted) {
            return null;
        }
        
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log("AudioContext initialized for white noise.");
            } catch (e) {
                console.error("Web Audio API is not supported in this browser", e);
                return null;
            }
        }
        
        try {
            // Create noise generator node
            const bufferSize = 2 * this.audioContext.sampleRate;
            const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            
            // Fill buffer with white noise
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            
            // Create source node
            const whiteNoise = this.audioContext.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            whiteNoise.loop = true;
            
            // Create gain node for volume control and optional fade-in
            const gainNode = this.audioContext.createGain();
            
            // Handle fade-in if requested
            if (options.fadeIn && options.fadeIn > 0) {
                gainNode.gain.value = 0;
                const volume = options.volume !== undefined ? options.volume : 0.3;
                gainNode.gain.linearRampToValueAtTime(
                    volume,
                    this.audioContext.currentTime + (options.fadeIn / 1000)
                );
            } else {
                gainNode.gain.value = options.volume !== undefined ? options.volume : 0.3;
            }
            
            // Create stereo panner if pan is specified
            if (options.pan !== undefined) {
                const pannerNode = this.audioContext.createStereoPanner();
                pannerNode.pan.value = options.pan;
                whiteNoise.connect(pannerNode);
                pannerNode.connect(gainNode);
            } else {
                whiteNoise.connect(gainNode);
            }
            
            // Connect to audio output
            gainNode.connect(this.audioContext.destination);
            
            // Start noise generator
            whiteNoise.start();
            
            // Create id for this noise source
            const noiseId = 'whitenoise_' + Date.now();
            
            // Store source and gain for later stopping
            if (!this.activeSoundSources[options.type || 'whitenoise']) {
                this.activeSoundSources[options.type || 'whitenoise'] = [];
            }
            
            // Save both the source and the gain node for fade-out
            this.activeSoundSources[options.type || 'whitenoise'].push({
                source: whiteNoise,
                gain: gainNode,
                id: noiseId
            });
            
            // Return id to reference this noise source
            return noiseId;
        } catch (error) {
            console.error("Error creating white noise:", error);
            return null;
        }
    }
    
    // Stop a specific sound with optional fade-out
    stopSound(soundId, options = {}) {
        if (!soundId) return;
        
        // Find the sound in all sound type groups
        for (const type in this.activeSoundSources) {
            const sounds = this.activeSoundSources[type];
            const soundIndex = sounds.findIndex(s => s.id === soundId);
            
            if (soundIndex !== -1) {
                const sound = sounds[soundIndex];
                
                // Handle fade-out if requested
                if (options.fadeOut && options.fadeOut > 0 && sound.gain) {
                    sound.gain.gain.linearRampToValueAtTime(
                        0,
                        this.audioContext.currentTime + (options.fadeOut / 1000)
                    );
                    
                    // Stop after fade-out
                    setTimeout(() => {
                        try {
                            sound.source.stop();
                        } catch (e) {
                            console.warn(`Error stopping sound: ${e.message}`);
                        }
                        
                        // Remove from active sources
                        sounds.splice(soundIndex, 1);
                    }, options.fadeOut);
                } else {
                    // Stop immediately
                    try {
                        sound.source.stop();
                    } catch (e) {
                        console.warn(`Error stopping sound: ${e.message}`);
                    }
                    
                    // Remove from active sources
                    sounds.splice(soundIndex, 1);
                }
                
                return true;
            }
        }
        
        return false;
    }

    // Update volume of a playing sound
    updateSoundVolume(soundId, newVolume) {
        if (!soundId) return false;
        
        // Find the sound in all sound type groups
        for (const type in this.activeSoundSources) {
            const sounds = this.activeSoundSources[type];
            const sound = sounds.find(s => s.id === soundId);
            
            if (sound && sound.gain) {
                // Update the gain value smoothly
                sound.gain.gain.linearRampToValueAtTime(
                    newVolume,
                    this.audioContext.currentTime + 0.05 // 50ms smooth transition
                );
                return true;
            }
        }
        
        return false;
    }
} 