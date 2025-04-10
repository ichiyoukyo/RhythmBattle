// Store successful inputs
let inputHistory = [];
const maxHistoryLength = 15; // Limit history length to prevent memory issues

// Make patterns accessible and updatable
export let knownPatterns = {
    'slot1': ['1', '1', '1', '2'],
    'slot2': ['2', '4', '3', '1'],
    'slot3': ['s', 'skip', 'd', 'f'],
    'slot4': ['2', 'm', 'w', 'o']
};

// Add function to update patterns
export function updatePatterns(newPatterns) {
    knownPatterns = { ...newPatterns };
}

export function recordInput(key, wasSuccessful) {
    if (!wasSuccessful) {
        // Clear history on failed input
        clearInputHistory()
        return;
    }
    
    inputHistory.push(key);

    // Keep history within size limit
    if (inputHistory.length > maxHistoryLength) {
        inputHistory.shift();
    }

    // Check for patterns after each successful input
    return checkForPatterns();
}

export function checkForPatterns() {
    // Get last 8 inputs (or less if not enough history)
    const recentInputs = inputHistory.slice(-8);
    if (recentInputs.length < 4) return null; // Need at least 4 inputs to form a pattern
    
    // Check against known patterns
    for (const [patternName, pattern] of Object.entries(knownPatterns)) {
        // Check if recent inputs end with this pattern
        if (endsWithPattern(recentInputs, pattern)) {
            
            return {
                name: patternName
            };
        }
    }

    return null;
}

function endsWithPattern(inputs, pattern) {
    if (inputs.length < pattern.length) return false;
    
    const endSection = inputs.slice(-pattern.length);
    return pattern.every((key, index) => key === endSection[index]);
}

export function clearInputHistory() {
    inputHistory = [];
}

export function getRecentInputs(count = 10) {
    return inputHistory.slice(-count);
}