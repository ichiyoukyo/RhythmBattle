// --- js/battle.js ---

import { generateMasterBeatArray, generateEvaluationWindows,generateBeatIntervals, getMetadata, generateAudioArray, generateSkipDetectArray } from './RhythmEngine.js';
import { recordInput, getRecentInputs, updatePatterns, knownPatterns } from './detectPattern.js';
import { getStageConfig, getRandomEnemy } from './stageConfig.js';

document.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    const ctx = canvas.getContext('2d');
    const CANVAS_WIDTH = window.innerWidth;  // Full window width
    const CANVAS_HEIGHT = window.innerHeight;  // 90% of window height

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

    // Add new state variable at the top with other state variables
    let patternDisplay = null;

    // Add to state variables section
    let isPaused = false;

    // Add to state variables section
    let victoryImage = null;
    let defeatImage = null;

    // --- Game State ---
    let playerUnits = [];
    let enemyUnits = [];
    let playerBase = null;
    let enemyBase = null;
    let playerEnergy = 50;
    const maxEnergy = 1200;
    const energyRegenRate = 10;
    let enemySpawnTimer = 0;
    const enemySpawnInterval = 5000;
    let lastTime = 0;
    let gameOver = false;
    let gameWon = false;
    let currentStage = null;

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

    // Add to your state variables
    let lastInputTime = -1; // Initialize to -1 to handle first beat
    let beatIntervals = [];

    // Base Definition (createBase function modified)
    function createBase(team) {
        const baseWidth = 250;   // Increased from 150
        const baseHeight = 250;  // Increased from 150
        return {
            id: team + 'Base',
            team: team,
            maxHp: team === 'enemy' ? currentStage.enemyBase.maxHp : 1000,
            hp: team === 'enemy' ? currentStage.enemyBase.maxHp : 1000,
            // Adjust x position for enemy base to account for larger width
            x: (team === 'player') ? 0 : CANVAS_WIDTH - baseWidth,
            // Adjust y position to keep base on ground with new height
            y: CANVAS_HEIGHT - baseHeight - 20, // Adjusted position
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
                'E001': { name: "Rat Scream", hp: 250, atk: 60, speed: 90, frequency: 100, attackRange: 40 },
                'E002': { name: "Noise Bat", hp: 400, atk: 40, speed: 60, frequency: 110, attackRange: 140 },
                'E003': { name: "Succubus Flutist", hp: 1200, atk: 90, speed: 75, frequency: 90, attackRange: 100 },
                'E004': { name: "Darkroar", hp: 5000, atk: 200, speed: 40, frequency: 100, attackRange: 180 },

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
            // Load stage-specific background
            backgroundImage = new Image();
            backgroundImage.src = currentStage.background.path;
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

            // Load stage-specific enemy base
            enemyCastleImage = new Image();
            enemyCastleImage.src = currentStage.enemyBase.sprite;
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

            // Load victory/defeat UI images
            victoryImage = new Image();
            victoryImage.src = 'assets/images/ui/you_win.png';
            await new Promise((resolve, reject) => {
                victoryImage.onload = resolve;
                victoryImage.onerror = reject;
            });

            // TODO: Add defeat image if you have one
            defeatImage = new Image();
            defeatImage.src = 'assets/images/ui/you_lose.png';  // Adjust path if different
            await new Promise((resolve, reject) => {
                defeatImage.onload = resolve;
                defeatImage.onerror = reject;
            });

            return true;
        } catch (error) {
            console.error("Error loading images:", error);
            return false;
        }
    }

    // --- Audio Functions ---
    async function initAudioSystem(bgmConfig) {
        try {
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load beat sound
            const beatResponse = await fetch('assets/music/beat.wav');
            const beatArrayBuffer = await beatResponse.arrayBuffer();
            beatBuffer = await audioContext.decodeAudioData(beatArrayBuffer);
            
            // Load stage-specific BGM
            const bgmResponse = await fetch(bgmConfig.path);
            const bgmArrayBuffer = await bgmResponse.arrayBuffer();
            bgmBuffer = await audioContext.decodeAudioData(bgmArrayBuffer);
            
            // Generate timing arrays
            const audioArray = generateAudioArray();
            evaluationWindows = generateEvaluationWindows();
            
            // Schedule all beats and BGM
            startTime = audioContext.currentTime + 0.1; // Small delay before starting
            
            // Schedule BGM with stage-specific offset and volume
            bgmSource = audioContext.createBufferSource();
            bgmSource.buffer = bgmBuffer;
            const bgmGain = audioContext.createGain();
            bgmGain.gain.value = bgmConfig.volume; // Use stage-specific volume
            bgmSource.connect(bgmGain);
            bgmGain.connect(audioContext.destination);
            bgmSource.start(startTime + bgmConfig.offset); // Use stage-specific offset
            
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

    // Add this new function to check for skipped beats
    function setupSkipInput() {
        const skipDetectPoints = generateSkipDetectArray();
        
        setInterval(() => {
            if (isPaused || gameOver || !audioContext || !startTime) return;

            const currentTime = audioContext.currentTime - startTime;
            
            // Check each detection point
            for (const point of skipDetectPoints) {
                if (Math.abs(currentTime - point) < 0.005) { // Small tolerance window
                    if (currentTime - lastInputTime > 0.5) { // Check if no input in last 0.5s
                        recordInput('skip', true);
                        feedbackText = 'SKIP!';
                        feedbackTimer = feedbackDuration;
                    }
                    break; // Exit after finding first matching point
                }
            }
        }, 10);
    }

    // Modify setupRhythmInput function
    function setupRhythmInput() {
        document.addEventListener('keydown', (event) => {
            if (!audioContext || !startTime) return;

            const currentTime = audioContext.currentTime - startTime;
            lastInputTime = currentTime; // First time setting lastInputTime

            const hitWindow = evaluationWindows.find(window => 
                currentTime >= window.window.start && 
                currentTime <= window.window.end
            );

            const isSuccess = hitWindow !== undefined;
            
            if (isSuccess) {
                lastInputTime = currentTime; // Second time setting lastInputTime - redundant!
            }
            
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
                    case 'slot4':
                        spawnPlayerUnit(3);
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
                {
                    ...unitConfig,
                    width: 100,  // Add these properties to override default size
                    height: 100
                },
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
    function spawnEnemyUnit() {
        if (gameOver) return;
        const enemyId = getRandomEnemy(currentStage.enemies.types);
        const data = enemyDataConfig[enemyId]; // Use loaded/defined config
        if (!data) {
            console.error("Invalid enemy ID:", enemyId);
            return;
        }
        // For enemies, assume stats are flat (no levels in this example)
        const unitConfig = { ...data }; // Pass all stats directly

        // Calculate spawn position at middle of enemy base
        const spawnX = enemyBase.x + (enemyBase.width / 2);
        
        const newUnit = new Unit(
            enemyId, 
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
        const indicatorWidth = 60;   // Increased from 40
        const indicatorHeight = 60;  // Increased from 40
        const x = CANVAS_WIDTH / 2 - indicatorWidth / 2;
        const y = 30;  // Adjusted position

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
        const cellSize = 50;  // Increased from 30
        const padding = 5;    // Increased from 5
        const startX = CANVAS_WIDTH - (cellSize + padding) * 10 - 20;
        const startY = 20;
        
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

    // Add this function to create and update pattern display
    function setupPatternDisplay() {
        if (!patternDisplay) {
            patternDisplay = document.createElement('div');
            patternDisplay.id = 'pattern-display';
            patternDisplay.style.cssText = `
                position: absolute;
                top: ${CANVAS_HEIGHT + 10}px;
                left: 0;
                width: 100%;
                display: flex;
                justify-content: center;
                gap: 30px;
                padding: 20px;
                background: rgba(255, 255, 255, 0.9);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            document.body.appendChild(patternDisplay);
        }

        updatePatternDisplay();
    }

    function updatePatternDisplay() {
        if (!patternDisplay) return;

        // Use the imported knownPatterns and access selectedTeamIds and characterSprites
        patternDisplay.innerHTML = Object.entries(knownPatterns)
            .map(([slot, pattern], index) => {
                const characterId = selectedTeamIds[index];
                const characterSprite = characterSprites[characterId];
                
                return `
                    <div class="pattern-box" style="
                        background: rgba(0,0,0,0.05);
                        padding: 20px;
                        border-radius: 10px;
                        text-align: center;
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        min-width: 250px;
                    ">
                        <div style="
                            width: 80px;  // Increased from 50px
                            height: 80px; // Increased from 50px
                            overflow: hidden;
                            border-radius: 8px;
                            border: 2px solid #ccc;
                        ">
                            ${characterSprite ? `
                                <img 
                                    src="${characterSprite.src}" 
                                    style="
                                        width: 100%;
                                        height: 100%;
                                        object-fit: contain;
                                    "
                                    alt="Character ${index + 1}"
                                />
                            ` : '<div style="width: 100%; height: 100%; background: #ddd;"></div>'}
                        </div>
                        <div>
                            <div style="font-weight: bold; margin-bottom: 8px; font-size: 1.2em;">
                                Slot ${index + 1}
                            </div>
                            <div style="
                                font-family: monospace;
                                font-size: 1.4em;
                                color: #333;
                            ">
                                ${pattern.join(' → ')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
    }

    // Add pause menu setup function
    function setupPauseMenu() {
        // Add pause button
        const pauseButton = document.createElement('button');
        pauseButton.id = 'pause-button';
        pauseButton.textContent = '⏸️'; // Pause emoji
        pauseButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 8px 12px;
            font-size: 20px;
            background: rgba(255, 255, 255, 0.8);
            border: 1px solid #ccc;
            border-radius: 5px;
            cursor: pointer;
            z-index: 1000;
            transition: background 0.2s;
        `;
        document.body.appendChild(pauseButton);
        pauseButton.onclick = togglePause;

        // Create pause menu container
        const pauseMenu = document.createElement('div');
        pauseMenu.id = 'pause-menu';
        pauseMenu.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1001;
        `;

        // Keep existing pause menu content
        pauseMenu.innerHTML = `
            <div style="
                background: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                min-width: 300px;
            ">
                <h2 style="margin-bottom: 20px;">Game Paused</h2>
                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                ">
                    <button id="resume-button" class="pause-menu-button">Resume Game</button>
                    <button id="restart-battle-button" class="pause-menu-button">Restart Battle</button>
                    <button id="change-team-button" class="pause-menu-button">Change Team</button>
                    <button id="quit-game-button" class="pause-menu-button">Quit Game</button>
                </div>
            </div>
        `;

        document.body.appendChild(pauseMenu);

        // Add button styles
        const style = document.createElement('style');
        style.textContent = `
            .pause-menu-button {
                padding: 10px 20px;
                margin: 5px 0;
                width: 100%;
                border: none;
                border-radius: 5px;
                background: #4a4a4a;
                color: white;
                cursor: pointer;
                transition: background 0.2s;
            }
            .pause-menu-button:hover {
                background: #666;
            }
        `;
        document.head.appendChild(style);

        // Add event listeners
        document.getElementById('resume-button').onclick = resumeGame;
        document.getElementById('restart-battle-button').onclick = init;
        document.getElementById('change-team-button').onclick = () => window.location.href = 'team.html';
        document.getElementById('quit-game-button').onclick = () => window.location.href = 'index.html';

        // Add keyboard listener for pause
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                togglePause();
            }
        });
    }

    // Add pause control functions
    function togglePause() {
        isPaused = !isPaused;
        const pauseMenu = document.getElementById('pause-menu');
        pauseMenu.style.display = isPaused ? 'flex' : 'none';

        if (isPaused) {
            // Pause audio
            if (bgmSource) bgmSource.playbackRate.value = 0;
            beatSources.forEach(source => {
                if (source.playbackRate) source.playbackRate.value = 0;
            });
        } else {
            // Resume audio
            if (bgmSource) bgmSource.playbackRate.value = 1;
            beatSources.forEach(source => {
                if (source.playbackRate) source.playbackRate.value = 1;
            });
        }
    }

    function resumeGame() {
        if (isPaused) {
            togglePause();
        }
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
            spawnEnemyUnit(); // Spawn the basic enemy
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

        // Add this before game over screen
        drawRhythmFeedback(ctx);

        // Draw Game Over / Win Message (keep existing logic)
        // Draw Game Over / Win Message
        if (gameOver) {
            // Dark overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Draw victory/defeat image
            const resultImage = gameWon ? victoryImage : defeatImage;
            if (resultImage) {
                // Calculate position to center the image
                const imageWidth = CANVAS_WIDTH * 0.5;  // Use 50% of canvas width
                const imageHeight = imageWidth * (resultImage.height / resultImage.width);
                const x = (CANVAS_WIDTH - imageWidth) / 2;
                const y = (CANVAS_HEIGHT - imageHeight) / 2;

                ctx.drawImage(resultImage, x, y, imageWidth, imageHeight);
            }
        }
    }

    // Add this function before init()
    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = (timestamp - lastTime) / 1000; // Convert to seconds
        lastTime = timestamp;

        // Skip frame if game isn't ready
        if (!audioContext || !startTime) {
            requestAnimationFrame(gameLoop);
            return;
        }

        // Skip updates if paused, but keep the loop running
        if (!isPaused) {
            if (!audioContext || !startTime) {
                requestAnimationFrame(gameLoop);
                return;
            }

            update(deltaTime);
            draw();
        }

        if (!gameOver) {
            requestAnimationFrame(gameLoop);
        }
    }

    // Modify init function to setup pause menu
    async function init(stageId = 'stage1') {
        try {
            // Load stage configuration
            currentStage = getStageConfig(stageId);
            
            // Initialize audio system with stage-specific BGM
            const audioInitialized = await initAudioSystem(currentStage.bgm);
            if (!audioInitialized) return false;

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

            // Initially disable any existing summon buttons (e.g., during restart)
            document.querySelectorAll('.summon-button').forEach(btn => btn.disabled = true);

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
            setupSkipInput(); // Add this line

            // Set up pattern display
            setupPatternDisplay();

// Remove old pause button if it exists
            const oldPauseButton = document.getElementById('pause-button');
            if (oldPauseButton) {
                oldPauseButton.remove();
            }

            // Setup pause menu (will create new pause button)
            if (!document.getElementById('pause-menu')) {
                setupPauseMenu();
            }

            // Reset pause state
            isPaused = false;
            document.getElementById('pause-menu').style.display = 'none';

            // --- Start the game loop ---
            lastTime = 0; // Reset lastTime for deltaTime calculation
            requestAnimationFrame(gameLoop);
        } catch (error) {
            console.error("Failed to initialize stage:", error);
            return false;
        }
    }

    // Add pattern update function that can be called when patterns change
    function updatePatterns(newPatterns) {
        // Update patterns in detectPattern.js
        Object.assign(knownPatterns, newPatterns);
        
        // Update the display
        updatePatternDisplay();
    }
    

    // --- Start the game ---
    init(); // Call the async init function

    // Example usage in battle.js:
    function changePatterns() {
        const newPatterns = {
            'slot1': ['z', 'x', 'z', 'x'],
            'slot2': ['c', 'v', 'c', 'v'],
            'slot3': ['b', 'n', 'b', 'n'],
            'slot4': ['m', ',', 'm', ',']
        };
        
        updatePatterns(newPatterns);
    }

    // Add window resize handler
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Redraw if needed
        if (!isPaused && !gameOver) {
            draw();
        }
    });

}); // End DOMContentLoaded