document.addEventListener('DOMContentLoaded', () => {
    const availableCharsContainer = document.getElementById('available-characters');
    const teamSlots = document.querySelectorAll('.slot');
    const startBattleBtn = document.getElementById('start-battle-btn');

    let characterData = {}; // To store fetched character data
    let selectedTeam = [null, null, null, null]; // Array to hold character IDs for slots 0-3

    // --- Fetch Character Data ---
    async function loadCharacterData() {
        try {
            const response = await fetch('data/characters.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            characterData = await response.json();
            displayAvailableCharacters();
            setupDragAndDrop();
            checkTeamValidity(); // Initial check
        } catch (error) {
            console.error("Could not load character data:", error);
            availableCharsContainer.textContent = "Error loading characters.";
        }
    }

    // --- Display Characters ---
    // --- Display Characters ---
    function displayAvailableCharacters() {
        availableCharsContainer.innerHTML = ''; // Clear previous content
        for (const id in characterData) {
            const char = characterData[id];
            const item = document.createElement('div');
            item.className = 'character-item';
            item.draggable = true; // The DIV is draggable
            item.dataset.id = id; // Store character ID

            item.innerHTML = `
                <img src="${char.image}" 
                     alt="${char.name}" 
                     draggable="false"  // <<< ADD THIS ATTRIBUTE
                     onerror="this.src='assets/images/placeholder.png'; this.alt='Image not found'"> 
                <span class="name">${char.name}</span>
                <span class="cost">Cost: ${char.cost}</span>
            `;
            availableCharsContainer.appendChild(item);
        }
    }

    function setupDragAndDrop() {
        // Draggable items (available characters)
        availableCharsContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('character-item')) {
                const charId = e.target.dataset.id; // Get ID first
                console.log(`[dragstart] Fired for item with id: ${charId}`); // Log that event fired + ID

                if (charId) { // Check if ID is not empty/null
                    try {
                        e.dataTransfer.setData('text/plain', charId);
                        console.log(`[dragstart] setData successful for id: ${charId}`); // Confirm setData call
                        e.target.classList.add('dragging'); // Feedback
                    } catch (err) {
                        console.error("[dragstart] Error during setData:", err); // Log if setData itself throws error
                    }
                } else {
                    console.warn("[dragstart] Dragged item has no dataset.id!"); // Warn if ID is missing
                }
            }
        });

        availableCharsContainer.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('character-item')) {
                e.target.classList.remove('dragging'); // Clean up feedback
                console.log(`[dragend] Fired for item with id: ${e.target.dataset.id}`); // Log drag end
            }
        });

        // Drop targets (slots)
        teamSlots.forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary to allow dropping
                slot.classList.add('over');
            });

            slot.addEventListener('dragleave', (e) => {
                slot.classList.remove('over');
            });

            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('over');
                const slotIndex = parseInt(slot.dataset.slotIndex, 10);

                // **** ADDED LOGGING HERE ****
                const characterId = e.dataTransfer.getData('text/plain');
                console.log(`[drop] Event fired on slot ${slotIndex}.`);
                console.log(`[drop] Attempting to get data ('text/plain'): Received -> "${characterId}"`); // Log exactly what was received

                if (characterId && characterData[characterId]) { // Check if ID is not empty AND exists in data
                    console.log(`[drop] Character ID "${characterId}" is valid. Proceeding to update slot.`);
                    updateSlot(slot, slotIndex, characterId);
                } else {
                    // This is Line 95 or similar
                    console.error(`[drop] Validation failed. Dropped item ID ("${characterId}") is not a valid key in characterData.`);
                    // Optionally log the types available in dataTransfer for more clues
                    try {
                        console.log(`[drop] Available dataTransfer types: ${JSON.stringify(e.dataTransfer.types)}`);
                    } catch (err) {
                        console.warn("[drop] Could not stringify dataTransfer types.");
                    }
                }
            });

            // Remove button logic (keep existing)
            const removeBtn = document.createElement('button');
            // ... (rest of remove button setup)
            slot.appendChild(removeBtn);
        });
    }

    // --- Update Slot Appearance and Data ---
    function updateSlot(slotElement, slotIndex, characterId) {
        const char = characterData[characterId];
        if (!char) return;

        // Clear previous content except the remove button
        const removeBtn = slotElement.querySelector('.remove-btn');
        slotElement.innerHTML = ''; // Clear everything
        if(removeBtn) slotElement.appendChild(removeBtn); // Re-add the button

        // Add new character image
        const img = document.createElement('img');
        img.src = char.image;
        img.alt = char.name;
        img.onerror = () => { img.src = 'assets/images/placeholder.png'; img.alt = 'Image not found'; };
        slotElement.appendChild(img);
        slotElement.classList.add('filled');

        // Store the selected character ID
        selectedTeam[slotIndex] = characterId;
        // console.log("Selected Team:", selectedTeam);
        checkTeamValidity();
    }

    // --- Clear Slot Appearance and Data ---
    function clearSlot(slotElement, slotIndex) {
        // Clear content except the remove button
        const removeBtn = slotElement.querySelector('.remove-btn');
        slotElement.innerHTML = '<span class="placeholder-text">Slot ' + (slotIndex + 1) + '</span>'; // Reset placeholder
        if (removeBtn) slotElement.appendChild(removeBtn); // Re-add the button

        slotElement.classList.remove('filled');

        // Remove character from internal array
        selectedTeam[slotIndex] = null;
        // console.log("Selected Team:", selectedTeam);
        checkTeamValidity();
    }


    // --- Validate Team and Enable Start Button ---
    function checkTeamValidity() {
        const isTeamFull = selectedTeam.every(id => id !== null);
        startBattleBtn.disabled = !isTeamFull;
        // console.log(`Team full: ${isTeamFull}, Button disabled: ${startBattleBtn.disabled}`);
    }

    // --- Save Team and Start Battle ---
    startBattleBtn.addEventListener('click', () => {
        if (!startBattleBtn.disabled) {
            try {
                localStorage.setItem('rhythmBattleTeam', JSON.stringify(selectedTeam));
                console.log('Team saved to localStorage:', selectedTeam);
                window.location.href = 'battle.html'; // Navigate to battle page
            } catch (error) {
                console.error("Could not save team to localStorage:", error);
                alert("Error saving team configuration.");
            }
        }
    });

    // --- Initialize ---
    loadCharacterData();

}); // End DOMContentLoaded