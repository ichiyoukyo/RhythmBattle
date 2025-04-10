export const stages = {
    'stage1': {
        name: "Forest Battle",
        background: {
            path: 'assets/images/backgrounds/battle-bg.png',
            // scrollSpeed: 0 // static background
        },
        bgm: {
            path: 'assets/music/bgm-2.mp3',
            bpm: 120,
            offset: 0.75,
            volume: 0.75
        },
        enemyBase: {
            maxHp: 1000,
            sprite: 'assets/images/backgrounds/castle-enemy.png'
        },
        enemies: {
            spawnInterval: 5000,
            types: [
                { id: 'E001', weight: 100 } // 100% spawn rate for basic enemy
            ]
        }
    },
    'stage2': {
        name: "Desert Battle",
        background: {
            path: 'assets/images/backgrounds/dark-bg.png',
            // scrollSpeed: 0.5 // scrolling background
        },
        bgm: {
            path: 'assets/music/bgm-3.mp3',
            bpm: 140,
            offset: 0.0,
            volume: 0.7
        },
        enemyBase: {
            maxHp: 2500,
            sprite: 'assets/images/backgrounds/castle-ememy-2.png'
        },
        enemies: {
            spawnInterval: 4000,
            types: [
                { id: 'E001', weight: 70 },
                { id: 'E002', weight: 30 }
            ]
        }
    },
    'stage3': {
        name: "Desert Battle",
        background: {
            path: 'assets/images/backgrounds/background2.png',
            // scrollSpeed: 0.5 // scrolling background
        },
        bgm: {
            path: 'assets/music/bgm-3.mp3',
            bpm: 140,
            offset: 0.0,
            volume: 0.7
        },
        enemyBase: {
            maxHp: 1500,
            sprite: 'assets/images/backgrounds/castle-ememy-2.png'
        },
        enemies: {
            spawnInterval: 4000,
            types: [
                { id: 'E001', weight: 30 },
                { id: 'E002', weight: 50 },
                { id: 'E003', weight: 20 }
            ]
        }
    },'stage4': {
        name: "Desert Battle",
        background: {
            path: 'assets/images/backgrounds/background3.png',
            // scrollSpeed: 0.5 // scrolling background
        },
        bgm: {
            path: 'assets/music/bgm-3.mp3',
            bpm: 140,
            offset: 0.0,
            volume: 0.7
        },
        enemyBase: {
            maxHp: 8000,
            sprite: 'assets/images/backgrounds/castle-ememy-2.png'
        },
        enemies: {
            spawnInterval: 3500,
            types: [
                { id: 'E001', weight: 10 },
                { id: 'E002', weight: 30 },
                { id: 'E003', weight: 30 },
                { id: 'E004', weight: 10 }
            ]
        }
    }
};

// Helper functions for stage management
export function getStageConfig(stageId) {
    const stage = stages[stageId];
    if (!stage) {
        throw new Error(`Stage ${stageId} not found`);
    }
    return stage;
}

// Helper function for weighted random enemy selection
export function getRandomEnemy(enemyTypes) {
    const totalWeight = enemyTypes.reduce((sum, enemy) => sum + enemy.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const enemy of enemyTypes) {
        if (random < enemy.weight) return enemy.id;
        random -= enemy.weight;
    }
    return enemyTypes[0].id; // Fallback to first enemy
}