document.addEventListener('DOMContentLoaded', () => {
    // Get current stage from localStorage or set default
    let currentStage = parseInt(localStorage.getItem('currentStage')) || 0;

    // Handle path choice
    window.choosePath = function choosePath(direction) {
        const nextStage = currentStage + 1;
        console.log(`Current stage: ${currentStage}`);
        if (!nextStage) return;

        // Update current stage
        currentStage = nextStage;
        localStorage.setItem('currentStage', currentStage);

        // Navigate to battle page
        window.location.href = 'battle.html';
    };
});