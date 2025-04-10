const rhythmSettings = {
    bpm: 120,
    tolerance: 0.2,
    offset: 0.1,
    timeLimit: 2 // minutes
};

export function generateMasterBeatArray() {
    const { bpm, timeLimit } = rhythmSettings;
    
    // Calculate basic timing values
    const beatInterval = 60 / bpm;  // seconds per beat
    const totalSeconds = timeLimit * 60;
    const totalBeats = Math.floor(totalSeconds / beatInterval);
    
    // Generate master beat array with precise timings, starting from index 1
    const masterBeats = Array.from({ length: totalBeats - 1 }, (_, i) => ({
        time: Number(((i + 1) * beatInterval).toFixed(3)),
        index: i + 1,
        bar: Math.floor((i + 1) / 4) + 1,
        beat: ((i + 1) % 4) + 1
    }));

    return masterBeats;
}

export function generateBeatIntervals() {
    const masterBeats = generateMasterBeatArray();
    const { beatInterval } = getMetadata();
    const halfInterval = beatInterval / 2;
    
    // Generate intervals centered on each beat
    return masterBeats.map(beat => ({
        start: beat.time - halfInterval,
        end: beat.time + halfInterval
    }));
}

export function generateEvaluationWindows() {
    const { tolerance } = rhythmSettings;
    const masterBeats = generateMasterBeatArray();
    
    return masterBeats.map(beat => ({
        time: beat.time,
        window: {
            start: beat.time - tolerance,
            end: beat.time + tolerance
        }
    }));
}

export function getMetadata() {
    const { bpm, timeLimit, tolerance, offset } = rhythmSettings;
    const beatInterval = 60 / bpm;
    
    return {
        bpm,
        beatInterval,
        totalBeats: Math.floor((timeLimit * 60) / beatInterval) - 1, // Adjusted to match array length
        tolerance,
        offset,
        duration: timeLimit * 60
    };
}

export function generateAudioArray() {
    const { offset } = rhythmSettings;
    const masterBeats = generateMasterBeatArray();
    
    // Generate audio timings by subtracting offset from each beat time
    const audioTimings = masterBeats.map(beat => ({
        time: Number((beat.time - offset).toFixed(3)),
        index: beat.index,
        bar: beat.bar,
        beat: beat.beat
    }));

    return audioTimings;
}

export function generateSkipDetectArray() {
    const masterBeats = generateMasterBeatArray();
    const { bpm } = rhythmSettings;
    const beatInterval = 60 / bpm;
    
    // Return array of midpoints between beats
    return masterBeats.slice(0, -1).map((beat, index) => {
        return Number((beat.time + beatInterval/2).toFixed(3));
    });
}