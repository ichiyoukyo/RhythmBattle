// --- js/battle.js ---

import { generateMasterBeatArray, generateEvaluationWindows, getMetadata, generateAudioArray } from './RhythmEngine.js';
import { recordInput, getRecentInputs } from './detectPattern.js';

document.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    const ctx = canvas.getContext('2d');
    const CANVAS_WIDTH = canvas.width;
    const CANVAS_HEIGHT = canvas.height;

    // Add these image state variables
    let backgroundImage = null;
    let allyCastleImage = null;
    let enemyCastleImage = null;
    let castleDefeatFx = null;
    window.characterSprites = {};

    // Add these variables at the top with other state variables
    let beatIndicatorActive = false;
    let beatIndicatorTimer = 0;
    const beatIndicatorDuration = 0.1; // Duration of the blink in seconds

    // Add these variables to your state section after other state variables
    let feedbackText = '';
    let feedbackTimer = 0;
    const feedbackDuration = 0.3; // How long to show feedback in seconds

    // --- Game State ---
    let playerUnits = [];
    let enemyUnits = [];
    let playerBase = null;
    let enemyBase = null;
    let playerEnergy = 100;
    const maxEnergy = 500;
    const energyRegenRate = 15;
    let enemySpawnTimer = 0;
    const enemySpawnInterval = 5000;
    let lastTime = 0;
    let gameOver = false;
    let gameWon = false;

    // --- Loaded Data ---
    let selectedTeamIds = []; // Array of IDs ['P001', 'P002', ...]
    let fullCharacterData = {}; // All data loaded from characters.json
    let enemyDataConfig = {}; // Enemy data loaded (or defined)

    // --- Audio State ---
    let audioContext = null;
    let beatBuffer = null;
    let startTime = 0;
    let beatSources = [];
    let evaluationWindows = [];
    let bgmBuffer = null;
    let bgmSource = null;
    const BGM_OFFSET = 0.75; // Adjust this value to align BGM with beats

    // Base Definition (createBase function modified)
    function createBase(team) {
        const baseWidth = 150;  // Changed from 60 to 150
        const baseHeight = 150; // Changed from 100 to 150
        return {
            id: team + 'Base',
            team: team,
            maxHp: 1000,
            hp: 1000,
            // Adjust x position for enemy base to account for larger width
            x: (team === 'player') ? 0 : CANVAS_WIDTH - baseWidth,
            // Adjust y position to keep base on ground with new height
            y: CANVAS_HEIGHT - baseHeight - 10,
            width: baseWidth,
            height: baseHeight,
            color: (team === 'player') ? 'darkblue' : 'darkred',
            isAlive: true,
            isDefeated: false,
            defeatAnimationStarted: false,
            takeDamage: function(damage) {
                if (!this.isAlive) return;
                this.hp -= damage;
                console.log(`${this.team} Base took ${damage} damage, HP: ${this.hp}`);
                if (this.hp <= 0) {
                    this.hp = 0;
                    this.isAlive = false;
                    this.isDefeated = true;
                    console.log(`${this.team} Base destroyed!`);
                    if (this.team === 'enemy') {
                        // Don't set gameOver immediately, wait for animation
                        setTimeout(() => {
                            gameOver = true;
                            gameWon = true;
                        }, 1000); // Adjust timing based on your GIF duration
                    } else {
                        gameOver = true;
                        gameWon = false;
                    }
                }
            },
            draw: function(ctx) {
                if (this.isDefeated && this.team === 'enemy' && castleDefeatFx) {
                    // Draw defeat animation
                    ctx.drawImage(
                        castleDefeatFx,
                        this.x,
                        this.y,
                        this.width,
                        this.height
                    );
                    
                    if (!this.defeatAnimationStarted) {
                        this.defeatAnimationStarted = true;
                        // Optional: Play defeat sound here
                        // const defeatSound = new Audio('assets/sounds/castle-defeat.mp3');
                        // defeatSound.play();
                    }
                } else {
                    // Normal base drawing
                    const castleImage = this.team === 'player' ? allyCastleImage : enemyCastleImage;
                    if (castleImage) {
                        ctx.drawImage(
                            castleImage,
                            this.x,
                            this.y,
                            this.width,
                            this.height
                        );
                    } else {
                        ctx.fillStyle = this.color;
                        ctx.fillRect(this.x, this.y, this.width, this.height);
                    }
                }

                // Only draw HP bar if base is still alive
                if (this.isAlive) {
                    // Draw Base HP Bar
                    const hpBarWidth = this.width;
                    const hpBarHeight = 8;
                    const hpBarX = this.x;
                    const hpBarY = this.y - hpBarHeight - 5; // Position above the base
                    ctx.fillStyle = '#555'; // Dark background
                    ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
                    const currentHpWidth = hpBarWidth * (this.hp / this.maxHp);
                    ctx.fillStyle = 'lime'; // Bright green
                    ctx.fillRect(hpBarX, hpBarY, currentHpWidth, hpBarHeight);

                    // Display HP Text on Base Bar
                    ctx.fillStyle = 'white';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${this.hp}/${this.maxHp}`, hpBarX + hpBarWidth / 2, hpBarY + hpBarHeight - 1);
                }
            }
        };
    }

    // --- Load Necessary Data ---
    async function loadGameData() {
        try {
            // 1. Load Selected Team from localStorage
            const storedTeam = localStorage.getItem('rhythmBattleTeam');
            if (storedTeam) {
                selectedTeamIds = JSON.parse(storedTeam);
            } else {
                // Default team or redirect back if no team is selected
                console.warn("No team selected in localStorage. Using default or redirecting.");
                // Example default: selectedTeamIds = ['P001', 'P001', 'P001', 'P001'];
                // Or redirect: window.location.href = 'team.html'; return false;
                selectedTeamIds = ['P001', 'P002', 'P001', 'P002']; // Simple default for now
            }
            if (!Array.isArray(selectedTeamIds) || selectedTeamIds.length === 0 || selectedTeamIds.some(id => id === null)) {
                console.error("Invalid team data found in localStorage. Using default.");
                selectedTeamIds = ['P001', 'P002', 'P001', 'P002']; // Fallback default
                localStorage.setItem('rhythmBattleTeam', JSON.stringify(selectedTeamIds)); // Optionally save default
            }


            // 2. Load Full Character Data
            const charResponse = await fetch('data/characters.json');
            if (!charResponse.ok) throw new Error('Failed to load characters.json');
            fullCharacterData = await charResponse.json();

            // 3. Define/Load Enemy Data (Hardcoded for MVP)
            enemyDataConfig = {
                'E001': { name: "Basic Doge", hp: 200, atk: 40, speed: 30, frequency: 90, attackRange: 40 }
                // Add more enemy types here if needed
            };

            console.log("Game data loaded successfully.");
            console.log("Selected Team:", selectedTeamIds);
            return true; // Indicate success

        } catch (error) {
            console.error("Error loading game data:", error);
            // Display error message to the user on the canvas?
            ctx.fillStyle = 'red';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Error loading game data. Please try again.', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            return false; // Indicate failure
        }
    }

    async function loadImages() {
        try {
            // Load background
            backgroundImage = new Image();
            backgroundImage.src = 'assets/images/backgrounds/battle-bg.png';
            await new Promise((resolve, reject) => {
                backgroundImage.onload = resolve;
                backgroundImage.onerror = reject;
            });

            // Load castle images
            allyCastleImage = new Image();
            allyCastleImage.src = 'assets/images/backgrounds/castle-ally.png';
            await new Promise((resolve, reject) => {
                allyCastleImage.onload = resolve;
                allyCastleImage.onerror = reject;
            });

            enemyCastleImage = new Image();
            enemyCastleImage.src = 'assets/images/backgrounds/castle-enemy.png';
            await new Promise((resolve, reject) => {
                enemyCastleImage.onload = resolve;
                enemyCastleImage.onerror = reject;
            });

            // Load defeat effect
            castleDefeatFx = new Image();
            castleDefeatFx.src = 'assets/fx/castle-defeat.gif';
            await new Promise((resolve, reject) => {
                castleDefeatFx.onload = resolve;
                castleDefeatFx.onerror = reject;
            });

            // Load all character sprites
            const allCharacterIds = [...selectedTeamIds, ...Object.keys(enemyDataConfig)];
            for (const id of allCharacterIds) {
                characterSprites[id] = new Image();
                // Use different paths for player vs enemy characters
                const path = id.startsWith('P') ? 
                    'assets/images/characters/player/' : 
                    'assets/images/characters/enemies/';
                characterSprites[id].src = `${path}${id}.png`;
                await new Promise((resolve, reject) => {
                    characterSprites[id].onload = resolve;
                    characterSprites[id].onerror = reject;
                });
            }
            return true;
        } catch (error) {
            console.error("Error loading images:", error);
            return false;
        }
    }

    // --- Audio Functions ---
    async function initAudioSystem() {
        try {
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load beat sound
            const beatResponse = await fetch('assets/music/beat.wav');
            const beatArrayBuffer = await beatResponse.arrayBuffer();
            beatBuffer = await audioContext.decodeAudioData(beatArrayBuffer);
            
            // Load BGM
            const bgmResponse = await fetch('assets/music/bgm-2.mp3');
            const bgmArrayBuffer = await bgmResponse.arrayBuffer();
            bgmBuffer = await audioContext.decodeAudioData(bgmArrayBuffer);
            
            // Generate timing arrays
            const audioArray = generateAudioArray();
            evaluationWindows = generateEvaluationWindows();
            
            // Schedule all beats and BGM
            startTime = audioContext.currentTime + 0.1; // Small delay before starting
            
            // Schedule BGM
            bgmSource = audioContext.createBufferSource();
            bgmSource.buffer = bgmBuffer;
            const bgmGain = audioContext.createGain();
            bgmGain.gain.value = 0.5; // Lower volume for BGM
            bgmSource.connect(bgmGain);
            bgmGain.connect(audioContext.destination);
            bgmSource.start(startTime + BGM_OFFSET);
            
            // Schedule beats
            audioArray.forEach(beatData => {
                const source = audioContext.createBufferSource();
                source.buffer = beatBuffer;
                const gainNode = audioContext.createGain();
                gainNode.gain.value = 0.2;
                source.connect(gainNode);
                gainNode.connect(audioContext.destination);
                source.start(startTime + beatData.time);
                beatSources.push(source);
            });

            return true;
        } catch (error) {
            console.error('Failed to initialize audio system:', error);
            return false;
        }
    }

    function cleanupAudio() {
        if (bgmSource) {
            try {
                bgmSource.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            bgmSource = null;
        }
        
        beatSources.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // Ignore if already stopped
            }
        });
        beatSources = [];
        
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
    }

    // Modify setupRhythmInput function
    function setupRhythmInput() {
        document.addEventListener('keydown', (event) => {
            if (!audioContext || !startTime) return;

            const currentTime = audioContext.currentTime - startTime;
            
            // Find if we're in any evaluation window
            const hitWindow = evaluationWindows.find(window => 
                currentTime >= window.window.start && 
                currentTime <= window.window.end
            );

            // Determine if the hit was successful
            const isSuccess = hitWindow !== undefined;
            
            // Visual feedback
            feedbackText = isSuccess ? 'SUCCESS!' : 'MISS!';
            feedbackTimer = feedbackDuration;
            
            // Record input and check for patterns
            const pattern = recordInput(event.key, isSuccess);
            if (pattern) {
                console.log(`Pattern detected: ${pattern.name}`);
                // Trigger unit spawn based on pattern
                switch(pattern.name) {
                    case 'slot1':
                        spawnPlayerUnit(0);
                        break;
                    case 'slot2':
                        spawnPlayerUnit(1);
                        break;
                    case 'slot3':
                        spawnPlayerUnit(2);
                        break;
                }
            }
            
            console.log(`Input ${event.key} at ${currentTime.toFixed(3)}s: ${feedbackText}`);
        });
    }

    // --- Game Functions ---

    // Modify the spawnPlayerUnit function:
    function spawnPlayerUnit(slotIndex) {
        console.log(`SpawnPlayerUnit called with slotIndex: ${slotIndex}`);
        
        if (gameOver) {
            console.log('Game is over, cannot spawn unit');
            return;
        }
        
        if (slotIndex < 0 || slotIndex >= selectedTeamIds.length) {
            console.error(`Invalid slotIndex: ${slotIndex}, valid range is 0-${selectedTeamIds.length - 1}`);
            return;
        }

        const characterId = selectedTeamIds[slotIndex];
        console.log(`Character ID for slot ${slotIndex}: ${characterId}`);
        
        if (!characterId) {
            console.warn(`No character assigned to slot ${slotIndex + 1}`);
            return;
        }

        const baseData = fullCharacterData[characterId];
        console.log(`Base data for character:`, baseData);
        
        if (!baseData) {
            console.error(`Data not found for character ID: ${characterId}`);
            return;
        }

        // Use slotIndex as level (0-3)
        const level = slotIndex; // Slot 0 = level 1 stats, Slot 1 = level 2 stats, etc.
        if (!baseData.levelStats || !baseData.levelStats[level]) {
            console.error(`Level ${level+1} stats not found for ${characterId}`);
            return;
        }

        const stats = baseData.levelStats[level];
        const cost = baseData.cost;

        if (playerEnergy >= cost) {
            playerEnergy -= cost;
            const unitConfig = { ...stats, cost: cost };

            // Add level information to the unit for display purposes
            unitConfig.level = level + 1; // Convert to 1-based level number

            // Calculate spawn position at middle of base
            const spawnX = playerBase.x + (playerBase.width / 2);
            
            const newUnit = new Unit(
                characterId, 
                unitConfig, 
                spawnX, // Spawn at middle of base
                0, 
                'player', 
                CANVAS_HEIGHT
            );
            playerUnits.push(newUnit);
            console.log(`Spawned Level ${level+1} ${baseData.name} from slot ${slotIndex + 1}. Energy left: ${playerEnergy}`);
        } else {
            console.log(`Not enough energy for ${baseData.name}. Need ${cost}, have ${Math.floor(playerEnergy)}`);
        }
    }

    // MODIFIED: Use enemyDataConfig
    function spawnEnemyUnit(id) {
        if (gameOver) return;
        const data = enemyDataConfig[id]; // Use loaded/defined config
        if (!data) {
            console.error("Invalid enemy ID:", id);
            return;
        }
        // For enemies, assume stats are flat (no levels in this example)
        const unitConfig = { ...data }; // Pass all stats directly

        // Calculate spawn position at middle of enemy base
        const spawnX = enemyBase.x + (enemyBase.width / 2);
        
        const newUnit = new Unit(
            id, 
            unitConfig, 
            spawnX, // Spawn at middle of base
            0, 
            'enemy', 
            CANVAS_HEIGHT
        );
        enemyUnits.push(newUnit);
        console.log(`Spawned Enemy ${data.name}`);
    }

    // Add this function for drawing the beat indicator
    function drawBeatIndicator(ctx) {
        const indicatorWidth = 40;
        const indicatorHeight = 40;
        const x = CANVAS_WIDTH / 2 - indicatorWidth / 2;
        const y = 20;

        // Draw the base circle
        ctx.beginPath();
        ctx.arc(x + indicatorWidth/2, y + indicatorHeight/2, indicatorWidth/2, 0, Math.PI * 2);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // If active, fill with highlight color
        if (beatIndicatorActive) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.fill();
        }
    }

    // Add this function to draw the feedback text
    function drawRhythmFeedback(ctx) {
        if (feedbackTimer > 0) {
            ctx.save();
            ctx.fillStyle = feedbackText === 'SUCCESS!' ? '#00ff00' : '#ff0000';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(feedbackText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            ctx.restore();
        }
    }

    // Add this function to update the beat indicator
    function updateBeatIndicator(currentTime) {
        const gameTime = currentTime - startTime;
        
        // Check if we're near any beat time
        const nearestBeat = generateMasterBeatArray().find(beat => 
            Math.abs(beat.time - gameTime) < beatIndicatorDuration
        );

        if (nearestBeat) {
            beatIndicatorActive = true;
            beatIndicatorTimer = beatIndicatorDuration;
        } else if (beatIndicatorTimer > 0) {
            beatIndicatorTimer -= 1/60; // Assuming 60fps
            if (beatIndicatorTimer <= 0) {
                beatIndicatorActive = false;
            }
        }
    }

    // Add near other UI drawing functions
    function drawInputHistory(ctx) {
        const recentInputs = getRecentInputs(10); // Get last 10 inputs
        const cellSize = 30;
        const padding = 5;
        const startX = CANVAS_WIDTH - (cellSize + padding) * 10;
        const startY = 10;
        
        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(
            startX - padding, 
            startY - padding, 
            (cellSize + padding) * 10 + padding, 
            cellSize + padding * 2
        );

        // Draw each input
        recentInputs.forEach((key, index) => {
            const x = startX + index * (cellSize + padding);
            const y = startY;
            
            // Draw cell background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(x, y, cellSize, cellSize);
            
            // Draw key text
            ctx.fillStyle = 'black';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(key, x + cellSize/2, y + cellSize/2);
        });
    }

    // Modify your update function to include feedback timer
    function update(deltaTime) {
        if (gameOver) return;

        // Add this line to update the beat indicator
        updateBeatIndicator(audioContext.currentTime);

        // Regenerate energy
        playerEnergy += energyRegenRate * deltaTime;
        if (playerEnergy > maxEnergy) {
            playerEnergy = maxEnergy;
        }

        // Spawn enemies
        enemySpawnTimer += deltaTime * 1000; // Timer in ms
        if (enemySpawnTimer >= enemySpawnInterval) {
            spawnEnemyUnit('E001'); // Spawn the basic enemy
            enemySpawnTimer = 0; // Reset timer
        }

        // Update all units
        // Pass copies of opposite arrays to prevent modification issues during iteration
        const currentEnemyUnits = [...enemyUnits];
        const currentPlayerUnits = [...playerUnits];

        playerUnits.forEach(unit => unit.update(deltaTime, currentEnemyUnits, enemyBase));
        enemyUnits.forEach(unit => unit.update(deltaTime, currentPlayerUnits, playerBase));

        if (feedbackTimer > 0) {
            feedbackTimer = Math.max(0, feedbackTimer - deltaTime);
        }

        // Remove dead units
        playerUnits = playerUnits.filter(unit => unit.isAlive);
        enemyUnits = enemyUnits.filter(unit => unit.isAlive);

        // Check Win/Loss conditions (already handled in base.takeDamage)
    }

    // Modify the draw function to include input history
    function draw() {
        // Clear canvas
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw background
        if (backgroundImage) {
            ctx.drawImage(backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
            // Fallback to original color
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        // Add this line after drawing the background but before units
        drawBeatIndicator(ctx);

        // Add input history display
        drawInputHistory(ctx);

        // Draw Bases
        playerBase.draw(ctx);
        enemyBase.draw(ctx);

        // Draw Units
        playerUnits.forEach(unit => unit.draw(ctx));
        enemyUnits.forEach(unit => unit.draw(ctx));

        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Energy: ${Math.floor(playerEnergy)} / ${maxEnergy}`, 10, 20);

        // Draw Summon Buttons (replace temporary buttons)
        drawSummonUI();

        // Add this before game over screen
        drawRhythmFeedback(ctx);

        // Draw Game Over / Win Message (keep existing logic)
        // Draw Game Over / Win Message
        if (gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.font = '40px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            if (gameWon) {
                ctx.fillText('VICTORY!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            } else {
                ctx.fillText('DEFEAT!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            }
        }
    }

    // NEW: Function to draw summon UI based on selected team
    function drawSummonUI() {
        const buttonHeight = 40;
        const buttonWidth = 80;
        const startX = 10;
        const startY = CANVAS_HEIGHT - buttonHeight - 10; // Bottom left corner
        const padding = 10;

        for (let i = 0; i < selectedTeamIds.length; i++) {
            const charId = selectedTeamIds[i];
            if (!charId) continue; // Skip empty slots

            const charBaseData = fullCharacterData[charId];
            if (!charBaseData) continue; // Skip if data missing

            const x = startX + i * (buttonWidth + padding);
            const y = startY;

            // Button background (indicate affordability)
            ctx.fillStyle = (playerEnergy >= charBaseData.cost) ? '#4CAF50' : '#aaaaaa'; // Green if affordable, grey if not
            ctx.fillRect(x, y, buttonWidth, buttonHeight);
            ctx.strokeStyle = 'black';
            ctx.strokeRect(x, y, buttonWidth, buttonHeight);

            // Character Name/Cost (simplified)
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${charBaseData.name}`, x + buttonWidth / 2, y + 12);
            ctx.fillText(`Cost: ${charBaseData.cost}`, x + buttonWidth / 2, y + 28);

            // You would add click listeners here to call spawnPlayerUnit(i)
            // This requires mapping canvas clicks to buttons, which is more complex.
            // For MVP, keep using external HTML buttons or keyboard input.
            // Let's add temporary HTML buttons dynamically instead.
        }
    }

    // Modify the setupSummonControls function to show level information:
    function setupSummonControls() {
        const controlsDiv = document.getElementById('summon-controls-container');
        if (!controlsDiv) return;

        controlsDiv.innerHTML = '';

        for (let i = 0; i < selectedTeamIds.length; i++) {
            const charId = selectedTeamIds[i];
            if (!charId) continue;
            
            const charBaseData = fullCharacterData[charId];
            if (!charBaseData) continue;

            const level = i + 1;
            const stats = charBaseData.levelStats[i];
            
            const button = document.createElement('button');
            button.textContent = `Lv.${level} ${charBaseData.name} (${i+1})`;
            button.title = `Level ${level}\nHP: ${stats.hp} ATK: ${stats.atk}\nCost: ${charBaseData.cost}`;
            button.onclick = () => spawnPlayerUnit(i);
            button.classList.add('summon-button');
            controlsDiv.appendChild(button);
        }
    }

    function gameLoop(currentTime) {
        // First frame
        if (lastTime === 0) {
            lastTime = currentTime;
            requestAnimationFrame(gameLoop);
            return;
        }

        // Calculate delta time in seconds
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        // Update game state
        update(deltaTime);

        // Draw everything
        draw();

        // Request next frame
        requestAnimationFrame(gameLoop);
    }

    // Add setupRhythmInput to your init function
    async function init() {
        console.log("Initializing battle...");
        
        // Initialize audio system first
        const audioInitialized = await initAudioSystem();
        if (!audioInitialized) {
            console.error("Failed to initialize audio system");
            return;
        }

        // Load game data
        const dataLoaded = await loadGameData();
        if (!dataLoaded) {
            console.error("Failed to load game data");
            return;
        }
        
        // Load images
        const imagesLoaded = await loadImages();
        if (!imagesLoaded) {
            console.error("Failed to load images");
            return;
        }

        // Initially disable any existing summon buttons (e.g., during restart)
        document.querySelectorAll('.summon-button').forEach(btn => btn.disabled = true);

        playerBase = createBase('player');
        enemyBase = createBase('enemy');

        // Reset state variables
        playerUnits = [];
        enemyUnits = [];
        playerEnergy = 100;
        enemySpawnTimer = 0;
        lastTime = 0;
        gameOver = false;
        gameWon = false;

        // Remove old controls if they exist (optional, good practice)
        const oldControls = document.getElementById('summon-controls-container');
        if (oldControls) {
            // Clear or rebuild controls instead of removing/re-adding container
            oldControls.innerHTML = '';
        }

        // ADD new dynamic summon buttons based on loaded team
        setupSummonControls();

        // --- Keep Restart button logic ---
        const restartButtonId = 'restart-button';
        let restartButton = document.getElementById(restartButtonId);
        if (!restartButton) { // Add restart button only if it doesn't exist
            restartButton = document.createElement('button');
            restartButton.id = restartButtonId; // Assign ID
            restartButton.textContent = 'Restart Battle';
            restartButton.style.position = 'absolute';
            restartButton.style.top = '10px'; // Position top-left
            restartButton.style.left = '10px';
            restartButton.style.padding = '5px 10px';
            document.body.appendChild(restartButton);
        }
        // Ensure onclick is always set to the latest init function reference
        restartButton.onclick = init;

        // Setup rhythm input after audio initialization
        setupRhythmInput();

        // --- Start the game loop ---
        lastTime = 0; // Reset lastTime for deltaTime calculation
        requestAnimationFrame(gameLoop);
    }

    // --- Start the game ---
    init(); // Call the async init function

}); // End DOMContentLoaded