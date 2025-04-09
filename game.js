class Ball {
    constructor(game, container) {
        this.game = game;
        this.container = container;
        this.element = document.createElement('div');
        this.element.className = 'target';
        
        // Adjust size based on screen size (Slightly larger again)
        const isMobile = window.innerWidth <= 768;
        this.currentSize = isMobile ? 
            Math.random() * 30 + 70 : // Mobile: 70-100px (was 60-90px)
            Math.random() * 80 + 200;  // Desktop: 200-280px (was 180-260px)
            
        // Lifespan: 2.0-3.0 seconds (Longer reaction time)
        this.lifespan = Math.random() * 1000 + 2000; 
        this.position = { x: 0, y: 0 };
        this.spawnPosition = { x: 0, y: 0 }; // Store original position for centered shrinking
        this.shrinkInterval = null; // Keep for reference, though not used by rAF
        this.animationFrameId = null; // For requestAnimationFrame
        this.colorChangeInterval = null;
        this.isGreen = false;
        this.greenWindowStart = null;
        this.turnRedTimeout = null; // Store the timeout ID for turning red
        // Green window duration: 0.8s - 1.3s (More forgiving window)
        this.greenWindowDuration = Math.random() * 500 + 800; 
        this.greenWindowScheduledStartTimestamp = null; // Timestamp for logic
        this.greenWindowScheduledEndTimestamp = null;   // Timestamp for logic
        this.container.appendChild(this.element);
        
        // Use touchstart and touchend for mobile
        this.element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.game.isPaused) {
                this.element.classList.add('pressed');
            }
        });
        
        this.element.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!this.game.isPaused) {
                this.element.classList.remove('pressed');
                this.handleClick();
            }
        });
        
        // Keep mouse events for desktop
        this.element.addEventListener('mousedown', () => {
            if (!this.game.isPaused) {
                this.element.classList.add('pressed');
            }
        });
        
        this.element.addEventListener('click', () => {
            if (!this.game.isPaused) {
                this.handleClick();
            }
        });
        
        this.spawn();
    }

    spawn() {
        this.game.playPopSound(); // Play pop sound when ball appears

        // Find a valid position
        let attempts = 0;
        const maxAttempts = 20;
        
        do {
            this.generateRandomPosition();
            attempts++;
        } while (this.isOverlapping() && attempts < maxAttempts);
        
        this.spawnPosition = { ...this.position }; 

        // Set initial position and size (will not change left/top during shrink)
        this.element.style.width = `${this.currentSize}px`;
        this.element.style.height = `${this.currentSize}px`;
        this.element.style.left = `${this.spawnPosition.x}px`;
        this.element.style.top = `${this.spawnPosition.y}px`;
        this.element.style.transform = 'scale(1)'; // Start at full scale
        
        // Start shrinking animation
        this.startShrinking();
        
        // --- Calculate and Store Timestamps --- 
        const maxPossibleDelay = this.lifespan - this.greenWindowDuration;
        const greenWindowDelay = Math.random() * Math.max(0, maxPossibleDelay); 
        
        const now = Date.now();
        this.greenWindowScheduledStartTimestamp = now + greenWindowDelay;
        this.greenWindowScheduledEndTimestamp = this.greenWindowScheduledStartTimestamp + this.greenWindowDuration;
        // --------------------------------------
        
        // Schedule visual change (uses the flag)
        this.greenWindowStart = setTimeout(() => {
            this.turnGreen();
        }, greenWindowDelay);
        
        // Schedule removal if missed
        this.removalTimeout = setTimeout(() => {
            this.miss(true);
        }, this.lifespan);
    }

    generateRandomPosition() {
        const containerRect = this.container.getBoundingClientRect();
        const topSafeZone = 100; // Safe zone for UI elements (progress bar + menu)
        
        // Calculate available space
        const maxX = containerRect.width - this.currentSize;
        const maxY = containerRect.height - this.currentSize;
        
        // Generate random position, ensuring the ball stays within bounds
        // and respects the top safe zone
        this.position = {
            x: Math.random() * maxX,
            y: Math.random() * (maxY - topSafeZone) + topSafeZone // Add topSafeZone to minimum Y
        };
    }

    isOverlapping() {
        const margin = 20; // Minimum space between balls
        const topSafeZone = 100; // Same safe zone as in generateRandomPosition
        
        // Get this ball's bounds
        const thisRect = {
            left: this.position.x - margin,
            right: this.position.x + this.currentSize + margin,
            top: this.position.y - margin,
            bottom: this.position.y + this.currentSize + margin
        };
        
        // Check if too close to top UI
        if (thisRect.top < topSafeZone) {
            return true;
        }
        
        // Check overlap with other balls
        for (const ball of this.game.balls) {
            if (ball === this) continue;
            
            const ballRect = {
                left: ball.position.x - margin,
                right: ball.position.x + ball.currentSize + margin,
                top: ball.position.y - margin,
                bottom: ball.position.y + ball.currentSize + margin
            };
            
            if (!(thisRect.right < ballRect.left || 
                  thisRect.left > ballRect.right || 
                  thisRect.bottom < ballRect.top || 
                  thisRect.top > ballRect.bottom)) {
                return true;
            }
        }
        
        return false;
    }

    createHitAnimation() {
        const hitElement = document.createElement('div');
        hitElement.className = 'hit-animation';
        hitElement.style.width = `${this.currentSize}px`;
        hitElement.style.height = `${this.currentSize}px`;
        hitElement.style.left = `${this.position.x}px`;
        hitElement.style.top = `${this.position.y}px`;
        hitElement.style.setProperty('--random', Math.random());
        return hitElement;
    }

    showFloatingScore(scoreResult) {
        // Create the score element
        const scoreElement = document.createElement('div');
        scoreElement.className = 'floating-score';
        
        // Display points
        scoreElement.textContent = `+${scoreResult.points}`;
        
        // If there's bonus text, display it
        if (scoreResult.bonusText) {
            // Add a line break and the bonus text
            const bonusElement = document.createElement('div');
            bonusElement.className = 'bonus-text';
            bonusElement.textContent = scoreResult.bonusText;
            scoreElement.appendChild(bonusElement);
        }
        
        // Position the score above the ball
        scoreElement.style.left = `${this.position.x}px`;
        scoreElement.style.top = `${this.position.y - this.currentSize/2}px`;
        
        this.container.appendChild(scoreElement);
        
        // Remove the score element after animation
        setTimeout(() => {
            if (scoreElement.parentNode) {
                scoreElement.parentNode.removeChild(scoreElement);
            }
        }, 1000);
    }

    showMissText(x, y) {
        // Remove any existing miss text
        const existingMissTexts = document.querySelectorAll('.miss-text');
        existingMissTexts.forEach(text => text.remove());
        
        // Create and show new miss text
        const missText = document.createElement('div');
        missText.className = 'miss-text';
        missText.textContent = 'Miss!';
        missText.style.left = x + 'px';
        missText.style.top = y + 'px';
        document.body.appendChild(missText);
        
        // Remove the text after animation
        setTimeout(() => {
            if (missText.parentNode) {
                missText.parentNode.removeChild(missText);
            }
        }, 1000);
    }

    handleClick() {
        const clickTime = Date.now();

        if (clickTime >= this.greenWindowScheduledStartTimestamp && 
            clickTime <= this.greenWindowScheduledEndTimestamp) {
            
            // Perfect hit logic...
            clearTimeout(this.turnRedTimeout); 
            const scoreResult = this.game.addScore(1); 
            this.showFloatingText(`+${scoreResult.pointsAdded} (x${scoreResult.multiplier})`); 
            this.createConfetti();
            this.game.increaseCombo();
            if (this.game.combo >= 2) {
                this.showFloatingText(`🔥 Combo x${this.game.combo}!`, true);
            }
            this.remove();

        } else {
            // Click was outside the valid time window (too early OR too late)
            const wasCombo = this.game.combo > 0; // Check if combo existed BEFORE reset
            const message = clickTime < this.greenWindowScheduledStartTimestamp ? 'Too Early' : 'Too Late';
            this.showFloatingText(message);
            this.game.resetCombo();
            this.game.playMissSound(); 
            if (wasCombo) {
                 this.showFloatingText('Combo Lost!', true); // Show combo lost near the ball
            }
            this.remove();
        }
    }

    showFloatingText(text, isCombo = false) {
        const floatingText = document.createElement('div');
        floatingText.className = 'floating-text';
        if (isCombo) {
            floatingText.classList.add('combo-label'); // Add class for potential styling
        }
        floatingText.textContent = text;
        
        // Position calculation (center above the ball)
        const textX = this.spawnPosition.x + (this.currentSize / 2);
        const textY = this.spawnPosition.y - 20; // Start slightly above the ball center
        
        floatingText.style.left = `${textX}px`;
        floatingText.style.top = `${textY}px`;
        this.container.appendChild(floatingText);
        
        // Animate and remove
        setTimeout(() => {
            floatingText.remove();
        }, 1000);
    }

    createConfetti() {
        const confettiCount = 15;
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
        const centerX = this.spawnPosition.x + this.currentSize / 2;
        const centerY = this.spawnPosition.y + this.currentSize / 2;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = `${centerX}px`;
            confetti.style.top = `${centerY}px`;
            
            // Randomize animation properties
            const angle = Math.random() * 360;
            const distance = Math.random() * 50 + 50; // Burst distance 50-100px
            const duration = Math.random() * 0.5 + 0.5; // Duration 0.5-1s
            const delay = Math.random() * 0.1; // Stagger start times

            confetti.style.setProperty('--angle', `${angle}deg`);
            confetti.style.setProperty('--distance', `${distance}px`);
            confetti.style.animationDuration = `${duration}s`;
            confetti.style.animationDelay = `${delay}s`;

            this.container.appendChild(confetti);

            // Remove confetti after animation
            setTimeout(() => {
                confetti.remove();
            }, (duration + delay) * 1000);
        }
    }

    stopShrinking() {
        // Stop the requestAnimationFrame loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    startShrinking() {
        const minScale = 0.7; // Shrink to 70% of original size
        const startTime = Date.now();

        const animateShrink = (timestamp) => {
            const elapsed = Date.now() - startTime;
            
            if (elapsed >= this.lifespan) {
                // Ensure final scale is set if loop terminates slightly early
                this.element.style.transform = `scale(${minScale})`;
                this.animationFrameId = null; // Mark as finished
                return; 
            }
            
            // Calculate progress (0 to 1)
            const progress = elapsed / this.lifespan;
            // Optional easing (can be removed for linear shrink)
            const easedProgress = progress < 0.7 ? progress * 0.7 : progress; 
            
            // Calculate current scale (1 down to minScale)
            let currentScale = 1 - (1 - minScale) * easedProgress;
            
            if (currentScale < minScale) {
                currentScale = minScale;
            }
            
            // Apply scale transform
            this.element.style.transform = `scale(${currentScale})`;
            
            // Request the next frame
            this.animationFrameId = requestAnimationFrame(animateShrink);
        };

        // Start the animation loop
        this.animationFrameId = requestAnimationFrame(animateShrink);
    }

    turnGreen() {
        this.isGreen = true;
        this.element.classList.add('green');
        
        // Clear any previous timeout just in case (belt and suspenders)
        clearTimeout(this.turnRedTimeout);
        
        // Turn back to red after the green window duration AND store the ID
        this.turnRedTimeout = setTimeout(() => {
            this.isGreen = false;
            this.element.classList.remove('green');
        }, this.greenWindowDuration);
    }

    miss(isTimeout = true) {
        const wasCombo = this.game.combo > 0; // Check if combo existed BEFORE reset
        if (isTimeout) {
            this.showFloatingText('Missed');
            this.game.playMissSound(); 
        }
        this.game.resetCombo();
        if (wasCombo) {
            this.showFloatingText('Combo Lost!', true); // Show combo lost near the ball
        }
        this.remove();
    }

    remove() {
        clearTimeout(this.removalTimeout);
        this.stopShrinking(); // Stop animation frame loop
        clearTimeout(this.greenWindowStart); // Also clear green window timeout
        clearTimeout(this.turnRedTimeout); // Also clear here for cleanup
        
        if (this.element.parentNode) {
            this.container.removeChild(this.element);
        }
        this.game.removeBall(this);
    }
}

class Game {
    constructor() {
        // Core properties
        this.score = 0;
        this.combo = 0;
        this.isPaused = false;
        this.balls = [];
        this.currentEnvironment = 'jungle';
        this.soundEnabled = true;
        this.gameStarted = false;
        this.jungleMusic = null; // Add properties for both tracks
        this.arcticMusic = null;
        this.bgMusic = null; // Reference to the currently active track

        // DOM Element references
        this.container = document.querySelector('.game-container');
        this.scoreElement = document.getElementById('score');
        this.comboElement = document.getElementById('combo');
        this.pauseOverlay = document.getElementById('pauseOverlay');
        this.pauseScoreElement = document.getElementById('pauseScore');
        this.pauseComboElement = document.getElementById('pauseCombo'); // Correct ID for pause combo
        this.resumeButton = document.getElementById('resumeButton');
        this.videoBackground = document.querySelector('.background-video');
        this.videoSource = document.getElementById('videoSource');
        this.pauseButton = document.getElementById('pauseButton');
        this.soundButton = document.getElementById('soundButton');
        this.startJungleButton = document.getElementById('startJungleButton');
        this.startArcticButton = document.getElementById('startArcticButton');
        this.pauseJungleButton = document.getElementById('pauseJungleButton');
        this.pauseArcticButton = document.getElementById('pauseArcticButton');
        this.startScreen = document.getElementById('startScreen');
        this.startButton = document.getElementById('startButton');

        // Always have only one ball
        this.maxBalls = 1;
        
        // Initialize game components
        this.setupControlButtons();
        this.initSounds(); // Preload sounds here
        this.initVideo();
        this.setupEnvironmentButtons();
        this.setupStartScreen(); // Add audio unlock here
        this.setupSoundHandlers();
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
        // Prevent scrolling on mobile
        this.container.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }

    initSounds() {
        // Preload both background tracks
        this.jungleMusic = new Audio('assets/bg.mp3');
        this.jungleMusic.loop = true;
        this.arcticMusic = new Audio('assets/arctic_bg.mp3');
        this.arcticMusic.loop = true;

        // Set the initial active track and mute the other
        if (this.currentEnvironment === 'jungle') {
            this.bgMusic = this.jungleMusic;
            this.arcticMusic.muted = true;
            this.jungleMusic.muted = false; // Ensure initially active is not muted
        } else {
            this.bgMusic = this.arcticMusic;
            this.jungleMusic.muted = true;
            this.arcticMusic.muted = false;
        }
        
        // Set initial sound button state
        this.updateSoundButtonState(); 
    }

    updateSoundButtonState() {
        if (this.soundEnabled) {
            this.soundButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
            `;
            this.soundButton.classList.remove('active');
        } else {
            this.soundButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
            `;
            this.soundButton.classList.add('active');
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.updateSoundButtonState();
        
        if (this.soundEnabled) {
            // If game running, unmute and play the CURRENT track
            if (this.gameStarted && !this.isPaused) {
                this.bgMusic.muted = false; // Explicitly unmute
                this.bgMusic.play().catch(e => console.log('BG music play failed on unmute:', e));
            }
            // Also ensure the inactive track remains muted
            if (this.currentEnvironment === 'jungle') {
                this.arcticMusic.muted = true;
            } else {
                this.jungleMusic.muted = true;
            }
        } else {
            // Mute both tracks when sound is disabled
            this.jungleMusic.muted = true;
            this.arcticMusic.muted = true;
            // Optionally pause the current one, but muting is often enough
            // this.bgMusic.pause(); 
        }
    }

    resumeBackgroundMusic() {
        // Play the CURRENT active track if sound is enabled and game is running
        if (this.gameStarted && !this.isPaused && this.soundEnabled) {
             // Ensure the correct track is unmuted before playing
            if (this.currentEnvironment === 'jungle') {
                this.jungleMusic.muted = false;
                this.arcticMusic.muted = true; 
                this.jungleMusic.play().catch(e => console.log('Jungle resume failed:', e));
            } else {
                this.arcticMusic.muted = false;
                this.jungleMusic.muted = true;
                this.arcticMusic.play().catch(e => console.log('Arctic resume failed:', e));
            }
        }
    }

    initVideo() {
        // Ensure video element is found
        if (!this.videoBackground) {
            console.error("Background video element not found!");
            return;
        }
        // Set up the ended event listener
        this.videoBackground.addEventListener('ended', () => {
            if (this.gameStarted && !this.isPaused) {
                this.videoBackground.play().catch(console.error);
            }
        });
    }
    
    setupEnvironmentButtons() {
        // Start screen environment buttons
        this.startJungleButton.addEventListener('click', () => {
            this.setEnvironment('jungle', 'start');
        });
        this.startArcticButton.addEventListener('click', () => {
            this.setEnvironment('arctic', 'start');
        });
        
        // Pause screen environment buttons
        this.pauseJungleButton.addEventListener('click', () => {
            this.setEnvironment('jungle', 'pause');
        });
        this.pauseArcticButton.addEventListener('click', () => {
            this.setEnvironment('arctic', 'pause');
        });
        
        // Set initial active states
        this.updateEnvironmentButtonStates();
    }
    
    setEnvironment(environment, source) {
        if (this.currentEnvironment === environment) return; 
        
        const oldMusic = this.bgMusic; // Get ref to the currently playing music
        
        this.currentEnvironment = environment;
        
        // Update video source and load
        const videoUrl = environment === 'jungle' ? 'assets/video.mp4' : 'assets/arctic.mp4';
        this.videoSource.src = videoUrl;
        this.videoBackground.load();
        if (this.gameStarted && !this.isPaused) {
            this.videoBackground.play().catch(console.error);
        }
        
        // Switch background music reference and manage muting
        if (environment === 'jungle') {
            this.bgMusic = this.jungleMusic;
            this.jungleMusic.muted = false;
            this.arcticMusic.muted = true;
        } else {
            this.bgMusic = this.arcticMusic;
            this.arcticMusic.muted = false;
            this.jungleMusic.muted = true;
        }

        // If game is running, pause old music and play new music if sound enabled
        if (this.gameStarted && !this.isPaused) {
            oldMusic.pause(); // Pause the track that was just active
            if (this.soundEnabled) {
                this.bgMusic.play().catch(console.error);
            }
        }
        
        // Update button states
        this.updateEnvironmentButtonStates();
    }
    
    updateEnvironmentButtonStates() {
        // Start screen buttons
        this.startJungleButton.classList.toggle('active', this.currentEnvironment === 'jungle');
        this.startArcticButton.classList.toggle('active', this.currentEnvironment === 'arctic');
        
        // Pause screen buttons
        this.pauseJungleButton.classList.toggle('active', this.currentEnvironment === 'jungle');
        this.pauseArcticButton.classList.toggle('active', this.currentEnvironment === 'arctic');
    }

    setupStartScreen() {
        this.startButton.addEventListener('click', () => {
            // --- Audio Unlock Attempt --- 
            // On first click, try to play (muted) then pause the current bgMusic
            // This helps satisfy browser autoplay policies
            const initialPlay = () => {
                if (this.bgMusic) {
                    const currentVolume = this.bgMusic.volume; // Store current volume
                    this.bgMusic.volume = 0; // Mute temporarily
                    const playPromise = this.bgMusic.play();
                    
                    if (playPromise !== undefined) {
                        playPromise.then(_ => {
                            // Play started, now pause immediately
                            this.bgMusic.pause();
                            this.bgMusic.volume = currentVolume; // Restore volume
                            console.log("Audio context likely unlocked.");
                            // Now proceed with starting the game
                            this.startGame(); 
                        }).catch(error => {
                            console.error("Audio unlock play failed:", error);
                            // Still proceed with starting the game even if unlock fails
                            this.bgMusic.volume = currentVolume; // Restore volume
                            this.startGame();
                        });
                    } else {
                         // If play() doesn't return a promise (older browsers?), just start game
                         this.startGame();
                    }
                } else {
                    // If bgMusic isn't ready for some reason, start game anyway
                    this.startGame();
                }
                // Remove this listener after first click
                this.startButton.removeEventListener('click', initialPlay);
            }
            // Add the initial play logic to the start button click
            // It will replace itself with the actual startGame call after running once.
            initialPlay(); 

        });
    }

    setupSoundHandlers() {
        // Handle visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.gameStarted && !this.isPaused) {
                this.resumeBackgroundMusic();
            } else if (document.visibilityState === 'hidden' && this.gameStarted) {
                // Pause sounds when tab is hidden
                this.pauseAllSounds();
            }
        });

        // Handle page focus
        window.addEventListener('focus', () => {
            if (this.gameStarted && !this.isPaused) {
                this.resumeBackgroundMusic();
            }
        });

        // Handle audio context
        document.addEventListener('click', () => {
            if (this.gameStarted && !this.isPaused && this.isSoundPaused('background') && !this.isMuted) {
                this.resumeBackgroundMusic();
            }
        });
    }

    isSoundPaused(soundType) {
        if (soundType === 'background') {
            return this.bgMusic.paused;
        } else if (soundType === 'hit') {
            return this.hitSound.paused;
        } else if (soundType === 'miss') {
            return this.missSound.paused;
        } else if (soundType === 'pop') {
            return this.popSound.paused;
        }
        return true;
    }

    pauseAllSounds() {
        // Pause only the currently active background music
        if (this.bgMusic) {
             this.bgMusic.pause();
        }
    }

    startGame() {
        // This function is now called AFTER the audio unlock attempt in setupStartScreen
        this.startScreen.classList.add('hidden');
        this.gameStarted = true;
        
        // Play video and music if enabled
        this.videoBackground.play().catch(console.error);
        if (this.soundEnabled) {
            this.bgMusic.muted = false; // Ensure unmuted
            this.bgMusic.play().catch(e => console.log('BG music start failed:', e));
        }
        
        // Add global miss listener
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container && this.gameStarted && !this.isPaused) {
                this.handleGlobalMiss(e);
            }
        });
        // Add touch listener for misses (use touchend to avoid conflict with ball touchend)
        this.container.addEventListener('touchend', (e) => {
             if (e.target === this.container && this.gameStarted && !this.isPaused) {
                // Check if the touch didn't hit any ball
                const touch = e.changedTouches[0];
                let hitBall = false;
                for (const ball of this.balls) {
                    const rect = ball.element.getBoundingClientRect();
                    if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                        touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                        hitBall = true;
                        break;
                    }
                }
                if (!hitBall) {
                   this.handleGlobalMiss(touch);
                }
            }
        });
        
        // Spawn initial balls
        for (let i = 0; i < this.maxBalls; i++) {
            // Add slight delay between initial spawns
            setTimeout(() => this.spawnNewBall(), i * 150);
        }
    }

    handleGlobalMiss(event) {
        // Show "Miss!" text at click location
        this.showFloatingTextAtPoint('Miss!', event.clientX, event.clientY);
        
        const wasCombo = this.combo > 0; // Check if combo existed BEFORE reset
        this.resetCombo(); 
        this.playMissSound(); 
        if (wasCombo) {
            // Show "Combo Lost!" text at click location
            this.showFloatingTextAtPoint('Combo Lost!', event.clientX, event.clientY, true);
        }
    }

    setupControlButtons() {
        this.pauseButton.addEventListener('click', () => this.togglePause());
        this.soundButton.addEventListener('click', () => this.toggleSound());
        this.resumeButton.addEventListener('click', () => this.togglePause());
    }

    togglePause() {
        if (!this.gameStarted) return;
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.pauseGame();
            this.pauseButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
            this.pauseButton.classList.add('active');
            this.pauseOverlay.classList.add('visible');
            this.pauseScoreElement.textContent = this.score;
            this.pauseComboElement.textContent = this.combo; // Update combo on pause screen
            this.updateEnvironmentButtonStates();
        } else {
            this.resumeGame();
            this.pauseButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>`;
            this.pauseButton.classList.remove('active');
            this.pauseOverlay.classList.remove('visible');
        }
    }

    pauseGame() {
        // Stop all ball timeouts and intervals
        for (const ball of this.balls) {
            clearTimeout(ball.removalTimeout);
            clearTimeout(ball.greenWindowStart);
            ball.stopShrinking(); // Stop shrinking interval too
        }
        this.pauseAllSounds();
        this.videoBackground.pause();
    }

    resumeGame() {
        // Resume music and video
        if (this.soundEnabled) {
            this.resumeBackgroundMusic();
        }
        this.videoBackground.play().catch(console.error);
        
        // Restart all balls
        for (const ball of this.balls) {
            ball.spawn(); // Respawn logic handles timeouts and shrinking
        }
    }

    playHitSound() {
        if (!this.soundEnabled) return;
        const hitSound = new Audio(this.currentEnvironment === 'jungle' ? 'assets/hit.mp3' : 'assets/arctic_hit.mp3'); // Assuming different sounds per env
        hitSound.volume = 0.4;
        hitSound.play().catch(e => console.log('Error playing hit sound:', e));
    }

    playMissSound() {
        if (!this.soundEnabled) return;
        // Use miss.m4a specifically as requested
        const missSound = new Audio('assets/miss.m4a'); 
        missSound.volume = 0.4;
        missSound.play().catch(e => console.log('Error playing miss sound:', e));
    }

    playPopSound() {
        if (!this.soundEnabled) return;
        const popSound = new Audio(this.currentEnvironment === 'jungle' ? 'assets/pop.mp3' : 'assets/arctic_pop.mp3'); // Assuming different sounds per env
        popSound.volume = 0.6;
        popSound.play().catch(e => console.log('Error playing pop sound:', e));
    }

    spawnNewBall() {
        if (this.balls.length < this.maxBalls && this.gameStarted && !this.isPaused) {
            // Increase delay for more breathing room
            setTimeout(() => {
                if (this.balls.length < this.maxBalls && !this.isPaused) { 
                   const ball = new Ball(this, this.container);
                   this.balls.push(ball);
                }
            }, 150); // Delay increased to 150ms (was 50ms)
        }
    }

    removeBall(ball) {
        const index = this.balls.indexOf(ball);
        if (index > -1) {
            this.balls.splice(index, 1);
        }
        // Spawn a new ball to replace the removed one
        this.spawnNewBall();
    }

    addScore(basePoints) {
        const multiplier = this.getMultiplier();
        const pointsAdded = basePoints * multiplier;
        this.score += pointsAdded;
        this.updateScore();
        // Return both points added and the multiplier used
        return { pointsAdded: pointsAdded, multiplier: multiplier }; 
    }

    updateScore() {
        if (this.scoreElement) {
            this.scoreElement.textContent = this.score;
        }
    }

    handleResize() {
        // Keep maxBalls at 1 regardless of resize
        const newMaxBalls = 1;
        
        // This logic might not be strictly necessary anymore if maxBalls is always 1,
        // but keeping it handles the edge case where it might somehow differ.
        if (newMaxBalls < this.maxBalls) {
            while (this.balls.length > newMaxBalls) {
                const ballToRemove = this.balls.pop();
                if (ballToRemove) {
                    ballToRemove.remove(); // Ensure proper cleanup
                }
            }
        } else if (newMaxBalls > this.maxBalls && this.gameStarted && !this.isPaused) {
             // Add balls if limit increased (shouldn't happen if newMaxBalls is always 1)
             for (let i = this.balls.length; i < newMaxBalls; i++) {
                 this.spawnNewBall();
             }
        }
        this.maxBalls = newMaxBalls;
    }

    increaseCombo() {
        this.combo++;
        this.updateComboDisplay();
        this.playHitSound(); // Play hit sound when combo increases

        // Add glow effect starting from combo 5
        if (this.combo >= 5) {
            this.container.classList.add('combo-glow');
        }
    }

    resetCombo() {
        if (this.combo > 0) {
             this.container.classList.remove('combo-glow');
        }
        this.combo = 0;
        this.updateComboDisplay();
    }

    updateComboDisplay() {
        if (this.comboElement) {
            this.comboElement.textContent = this.combo;
        }
        if (this.pauseComboElement) {
            this.pauseComboElement.textContent = this.combo;
        }
    }

    getMultiplier() {
        const combo = this.combo; // Use current combo before increment
        if (combo >= 15) return 4;
        if (combo >= 10) return 3;
        if (combo >= 5) return 2;
        return 1; // Base multiplier
    }

    // New method to show floating text at a specific point
    showFloatingTextAtPoint(text, x, y, isCombo = false) {
        const floatingText = document.createElement('div');
        floatingText.className = 'floating-text';
        if (isCombo) {
            floatingText.classList.add('combo-label'); // Use combo styling
        }
        floatingText.textContent = text;
        
        // Position based on coordinates provided
        floatingText.style.left = `${x}px`;
        floatingText.style.top = `${y - 20}px`; // Start slightly above the point
        
        this.container.appendChild(floatingText);
        
        // Animate and remove (uses the same CSS animation)
        setTimeout(() => {
            floatingText.remove();
        }, 1000);
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 