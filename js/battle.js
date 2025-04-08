// --- js/battle.js ---

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

    // --- Game Functions ---

    // Modify the spawnPlayerUnit function:
    function spawnPlayerUnit(slotIndex) {
        if (gameOver || slotIndex < 0 || slotIndex >= selectedTeamIds.length) return;

        const characterId = selectedTeamIds[slotIndex];
        if (!characterId) {
            console.warn(`No character assigned to slot ${slotIndex + 1}`);
            return;
        }

        const baseData = fullCharacterData[characterId];
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

    function update(deltaTime) {
        if (gameOver) return;

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


        // Remove dead units
        playerUnits = playerUnits.filter(unit => unit.isAlive);
        enemyUnits = enemyUnits.filter(unit => unit.isAlive);

        // Check Win/Loss conditions (already handled in base.takeDamage)
    }

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

            const level = i + 1; // Convert to 1-based level number
            const stats = charBaseData.levelStats[i];
            
            const button = document.createElement('button');
            button.textContent = `Lv.${level} ${charBaseData.name} (${i+1})`;
            button.title = `Level ${level}\nHP: ${stats.hp} ATK: ${stats.atk}\nCost: ${charBaseData.cost}`;
            button.onclick = () => spawnPlayerUnit(i);
            button.disabled = true;
            button.classList.add('summon-button');
            controlsDiv.appendChild(button);
        }
    }

    function gameLoop(timestamp) {
        if (!lastTime) {
            lastTime = timestamp;
        }
        const deltaTime = (timestamp - lastTime) / 1000; // Time elapsed in seconds
        lastTime = timestamp;

        update(deltaTime);
        draw();

        if (!gameOver) {
            requestAnimationFrame(gameLoop);
        } else {
            console.log("Game Over. Won:", gameWon);
            // Optional: Add restart button logic here
        }
    }

    async function init() {
        console.log("Initializing battle...");
        
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


        // Start the game loop *before* enabling buttons? Or after? Let's enable first.
        console.log("Initialization complete. Enabling controls.");
        // <<< Enable summon buttons NOW that init is done and bases exist
        document.querySelectorAll('.summon-button').forEach(btn => btn.disabled = false);

        // Start the game loop (make sure lastTime is reset before starting)
        lastTime = 0; // Reset lastTime for deltaTime calculation
        requestAnimationFrame(gameLoop);
    }

    // --- Start the game ---
    init(); // Call the async init function

}); // End DOMContentLoaded