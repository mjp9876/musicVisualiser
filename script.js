// Get DOM elements
const mp3FileInput = document.getElementById("mp3FileInput");
const playButton = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");
const selectionScreen = document.getElementById("selectionScreen");
const startButton = document.getElementById("startButton");
const visualizerCanvas = document.getElementById("visualizerCanvas");

// Variables to store selected visualizer and options
let selectedVisualizer = "";
let displayBPM = true;
let changeColors = true;

// Event listener for the start button
startButton.addEventListener("click", () => {
    const visualizerOption = document.querySelector('input[name="visualizer"]:checked');
    if (visualizerOption) {
        selectedVisualizer = visualizerOption.value;
        selectionScreen.style.display = "none"; // Hide selection screen
        startVisualizer(selectedVisualizer);
    } else {
        alert("Please select a visualizer option.");
    }
});

// Function to start the selected visualizer
function startVisualizer(visualizer) {
    // Adjust functionality based on selected visualizer
    switch (visualizer) {
        case "A":
            // Full functionality
            initializeVisualizer(visualizerCanvas, displayBPM, changeColors);
            break;
        case "B":
            // Disable color changes
            changeColors = false;
            initializeVisualizer(visualizerCanvas, displayBPM, changeColors);
            break;
        case "C":
            // Hide BPM display
            displayBPM = false;
            initializeVisualizer(visualizerCanvas, displayBPM, changeColors);
            break;
        case "D":
            // disable colour change and Hide BPM display
            changeColors = false;
            displayBPM = false;
            initializeVisualizer(visualizerCanvas, displayBPM, changeColors);
            break;
    }
}

// Function to initialize the visualizer
function initializeVisualizer(canvas, displayBPM, changeColors) {

    // Converting MP3 signal into usable data
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let analyser = audioContext.createAnalyser();
    let audioBuffer;
    let audioSource;

    // Tracking timestamps
    let startTime;
    let lastMessageTime = 0;

    // Beat tracking and threshold
    let minThreshold = Infinity;
    let maxThreshold = 0;
    let beatAllowed = true;
    let bestThreshold = 0;
    let rangeMultiplier = 0.75;
    let amplitudeWindow = [];
    let windowDuration = 1;
    let beatTimes = [];
    let predictionError = 0;
    let consecutiveLowPredictionErrors = 0;
    let predictedNextUpcomingBeatTime = Infinity;
    let consecutiveLowPredictedBeats = 0;
    const consecutiveLowPredictedBeatsThreshold = 3;
    let predictionAllowed = true;
    let isRegularBeatAlgorithm = true;
    let coldStartCooldown = 0;
    let mode;

    // Constants for colors
    const colors = {
        minor: {
            background: {
                default: 0x0000FF, // Dark blue
                bpm80: 0x0000AA, // Blue
                bpm110: 0x0080FF, // Light blue
                bpm140: 0xFFA500, // Orange
                bpm140plus: 0x000000 // black
            },
            circle: {
                bpm80: 0x000080, // Dark blue
                bpm110: 0x0000AA, // Blue
                bpm140: 0xFFA500, // Orange
                bpm140plus: 0xFF0000 // Red
            }
        },
        major: {
            background: {
                default: 0xC0C0C0, // Light grey
                bpm80: 0xc8a2c8, //lilac
                bpm110: 0xFFFFFF, // White
                bpm140: 0xFFFF00, //yellow
                bpm140plus: 0xFFFF00, //yellow
            },
            circle: {
                bpm80: 0xADD8E6, // Light blue
                bpm110: 0x0000AA, // Blue
                bpm140: 0x32CD32, // Lime green
                bpm140plus: 0xFF0000 // Red
            }
        }
    };

    let backgroundColour = 0xFFFFFF;
    let circleColour = 0xFFFFFF;

    // Update colors based on mode and BPM range
    function updateColors(bpm, mode) {
        if (bpm == 0) {
            if (mode == "minor") {
                backgroundColour = colors.minor.background.bpm80;
                circleColour = colors.minor.background.default;
            }
            else {
                backgroundColour = colors.major.background.default;
                circleColour = colors.minor.background.bpm80;
            }
        } else if (mode === "minor" && changeColors) {
            if (bpm < 80) {
                backgroundColour = colors.minor.background.bpm80;
                circleColour = colors.minor.circle.bpm80;
            } else if (bpm >= 80 && bpm < 110) {
                backgroundColour = colors.minor.background.bpm110;
                circleColour = colors.minor.circle.bpm110;
            } else if (bpm >= 110 && bpm < 140) {
                backgroundColour = colors.minor.background.bpm110;
                circleColour = colors.minor.circle.bpm140;
            } else {
                backgroundColour = colors.minor.background.bpm140plus;
                circleColour = colors.minor.circle.bpm140plus; // Black
            }
        } else if (mode === "major" && changeColors) {
            if (bpm < 80) {
                backgroundColour = colors.major.background.bpm80;
                circleColour = colors.major.circle.bpm80;
            } else if (bpm >= 80 && bpm < 110) {
                backgroundColour = colors.major.background.bpm110;
                circleColour = colors.major.circle.bpm110;
            } else if (bpm >= 110 && bpm < 140) {
                backgroundColour = colors.major.background.bpm140;
                circleColour = colors.major.circle.bpm140;
            } else {
                backgroundColour = colors.major.background.bpm140plus;
                circleColour = colors.major.circle.bpm140plus; // Yellow
            }
        }

        app.renderer.backgroundColor = backgroundColour;
        circle.tint = circleColour;
        if (displayBPM)
        {
            updateBPMText(bpm);
        }
    }

    // Create PixiJS application
    const app = new PIXI.Application({
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: true,
        backgroundColor: backgroundColour,
    });
    document.body.appendChild(app.view);

    // Create text element for displaying BPM
    let BPMText = "";
    if (displayBPM)
    {
        BPMText = "BPM: 0"
    }
    const bpmText = new PIXI.Text(BPMText, { fontFamily: 'Arial', fontSize: 30, fill: 0xFFFFFF });
    bpmText.anchor.set(0.5);
    bpmText.x = app.renderer.width / 2;
    bpmText.y = 20;
    app.stage.addChild(bpmText);

    // Update BPM text
    function updateBPMText(bpm) {
        bpmText.text = `BPM: ${Math.round(bpm)}`;
    }

    // Create pulsating circle
    const circle = new PIXI.Graphics();
    circle.beginFill(0xFFFFFF);
    circle.drawCircle(0, 0, 100);
    circle.endFill();
    circle.x = app.renderer.width / 2;
    circle.y = app.renderer.height / 2;
    app.stage.addChild(circle);

    // Pulse circle
    function pulseCircle() {
        let animationDuration = 100;
        let scaleFactor = 1.4;

        let scaleDirection = 1;

        const pulseInterval = setInterval(() => {
            circle.scale.x += 0.06 * scaleDirection;
            circle.scale.y += 0.06 * scaleDirection;

            if (circle.scale.x >= scaleFactor) {
                scaleDirection = -0.75;
            } else if (circle.scale.x <= 1) {
                scaleDirection = 1;
            }
        }, animationDuration / 50);

        setTimeout(() => {
            clearInterval(pulseInterval);
            circle.scale.set(1);
        }, animationDuration);
    }

    // Beat detected
    function displayMessage() {
        if (audioSource && audioContext.state === "running") {
            let currentTime = audioContext.currentTime - startTime;

            pulseCircle();
        }
    }

    // Check for regular intervals among all combinations of beats
    function findRegularIntervals(beatTimes) {
        const intervalThreshold = 0.1;
        const numBeatsToCheck = 8;

        if (beatTimes.length > numBeatsToCheck) {
            for (let comboLength = numBeatsToCheck; comboLength >= 3; comboLength--) {
                const combinations = getCombinations(numBeatsToCheck, comboLength);
                const offsetValue = beatTimes.length - (numBeatsToCheck);
                const shiftedCombinations = addConstantToArrays(combinations, offsetValue);

                for (const combination of shiftedCombinations) {
                    let isRegularCombo = true;

                    let testInterval = beatTimes[combination[1]] - beatTimes[combination[0]];

                    for (let i = 0; i < combination.length - 1; i++) {
                        const beatIndexA = combination[i];
                        const beatIndexB = combination[i + 1];

                        const intervalA = beatTimes[beatIndexA];
                        const intervalB = beatTimes[beatIndexB];
                        const actualInterval = intervalB - intervalA;

                        const difference = Math.abs(actualInterval - testInterval);

                        if (difference > intervalThreshold) {
                            isRegularCombo = false;
                            break;
                        }
                    }

                    if (isRegularCombo) {
                        return combination;
                    }
                }
            }
        }

        return [];
    }

    function addConstantToArrays(arr, constant) {
        const result = [];

        for (const subArray of arr) {
            const modifiedArray = subArray.map(element => element + constant);
            result.push(modifiedArray);
        }

        return result;
    }

    // Get all combinations of elements in an array
    function getCombinations(length, comboLength) {
        const combinations = [];

        const generateCombinations = (arr, temp, start, end, comboLength) => {
            if (temp.length === comboLength) {
                combinations.push([...temp]);
                return;
            }

            for (let i = start; i <= end && end - i + 1 >= comboLength - temp.length; i++) {
                temp.push(i);
                generateCombinations(arr, temp, i + 1, end, comboLength);
                temp.pop();
            }
        };

        generateCombinations([...Array(length).keys()], [], 0, length - 1, comboLength);
        return combinations;
    }


    // Predict the next beat
    function predictNextUpcomingBeat(regularIntervals, beatTimes) {
        const regularBeatTimes = regularIntervals.slice(-8).map(index => beatTimes[index]);
        const averageInterval = findInterval(regularBeatTimes)

        const lastBeatIndex = regularBeatTimes[regularBeatTimes.length - 1];
        const predictedNextUpcomingBeatTime = lastBeatIndex + averageInterval;

        return predictedNextUpcomingBeatTime;
    }

    // Find the average interval of a set of beats
    function findInterval(regularBeatTimes) {
        let totalInterval = 0;
        for (let i = 1; i < regularBeatTimes.length; i++) {
            totalInterval += regularBeatTimes[i] - regularBeatTimes[i - 1];
        }

        const averageInterval = totalInterval / (regularBeatTimes.length - 1);

        return averageInterval;
    }

    // Regualr interval beat tracking algorithm
    function newBeatTrackingAlgorithm(regularIntervals, beatTimes, dataArray) {
        let lastBeatTime = null;
        let regularBeatTimes = regularIntervals.map(index => beatTimes[index]);
        let interval = findInterval(regularBeatTimes)
        while (interval < 0.33) {
            interval = interval * 2;
        }
        while (interval > 0.92) {
            interval = interval / 2;
        }
        console.log(regularBeatTimes);
        console.log(beatTimes);

        function trackBeat() {
            if (audioSource && audioContext.state === "running") {
                const currentTime = audioContext.currentTime - startTime;
                if (!lastBeatTime) lastBeatTime = currentTime;

                if (currentTime >= lastBeatTime + interval && !isRegularBeatAlgorithm) {
                    const isBelowThreshold = calculateLowFrequencyAmplitude(dataArray) <= bestThreshold;

                    if (isBelowThreshold) {
                        consecutiveLowPredictedBeats++;

                        if (consecutiveLowPredictedBeats >= consecutiveLowPredictedBeatsThreshold) {
                            console.log("Switching to original algorithm");
                            isRegularBeatAlgorithm = true;
                            coldStartCooldown = 8;
                            consecutiveLowPredictedBeats = 0;
                            return;
                        }
                    } else {
                        consecutiveLowPredictedBeats = 0;
                    }

                    displayMessage();
                    beatTimes.push(currentTime);
                    lastBeatTime = currentTime;

                }
            }
            requestAnimationFrame(trackBeat);
        }
        trackBeat();
    }

    // Beat detection
    function detectBeats() {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Constant beat detection
        function checkForBeat() {
            analyser.getByteFrequencyData(dataArray);

            const lowFrequencyAmplitude = calculateLowFrequencyAmplitude(dataArray);

            // Set threshold
            updateThresholdRange(lowFrequencyAmplitude, getBPM());
            const range = maxThreshold - minThreshold;
            bestThreshold = minThreshold + rangeMultiplier * range;

            // Onset detection
            const isBelowThreshold = lowFrequencyAmplitude <= bestThreshold;
            if (isBelowThreshold && !beatAllowed) {
                beatAllowed = true;
            }
            if (beatAllowed && !isBelowThreshold && isRegularBeatAlgorithm) {
                const currentTime = audioContext.currentTime - startTime;
                displayMessage();
                coldStartCooldown = coldStartCooldown - 1;
                lastMessageTime = currentTime;
                beatAllowed = false;
                beatTimes.push(currentTime);

                const regularIntervals = findRegularIntervals(beatTimes);

                if (regularIntervals.length > 2 && predictionAllowed && coldStartCooldown <= 0) {
                    console.log("Regular intervals found between beats:", regularIntervals);
                    updateColors(getBPM(), mode);

                    predictedNextUpcomingBeatTime = predictNextUpcomingBeat(regularIntervals, beatTimes);
                    predictedNextUpcomingBeatTime = predictedNextUpcomingBeatTime + predictionError;

                    if (predictedNextUpcomingBeatTime > currentTime) {
                        console.log("Predicted next upcoming beat time:", predictedNextUpcomingBeatTime);
                        predictionAllowed = false;
                    }
                    if (predictionError < 0.2) {
                        consecutiveLowPredictionErrors++;

                        if (consecutiveLowPredictionErrors >= 3 && isRegularBeatAlgorithm) {
                            isRegularBeatAlgorithm = false;
                            console.log("Switching to regular period algorithm");
                            newBeatTrackingAlgorithm(regularIntervals, beatTimes, dataArray);
                        }
                    } else {
                        consecutiveLowPredictionErrors = 0;
                    }
                }
                if (predictedNextUpcomingBeatTime <= currentTime && !predictionAllowed) {
                    console.log("Beats allowed again");
                    predictionAllowed = true;

                    if (beatTimes.length >= 3) {
                        const mostRecentBeatTime = beatTimes[beatTimes.length - 1];
                        const secondMostRecentBeatTime = beatTimes[beatTimes.length - 2];

                        const timeDifferenceRecent = mostRecentBeatTime - predictedNextUpcomingBeatTime;
                        const timeDifferenceSecondRecent = secondMostRecentBeatTime - predictedNextUpcomingBeatTime;
                        
                        if (Math.abs(timeDifferenceRecent) < Math.abs(timeDifferenceSecondRecent)) {
                            predictionError = timeDifferenceRecent
                        } else {
                            predictionError = timeDifferenceSecondRecent
                        }
                    }
                }
            }
            requestAnimationFrame(checkForBeat);
        }
        checkForBeat();
    }

    // Calculate BPM
    function getBPM() {
        if (beatTimes.length >= 8) {
            const recentBeatTimes = beatTimes.slice(-8);
            const averageBeatTime = recentBeatTimes.reduce((sum, time, index, array) => {
                if (index > 0) {
                    return sum + (time - array[index - 1]);
                }
                return sum;
            }, 0) / (recentBeatTimes.length - 1);

            return 60 / averageBeatTime;
        }
        return 0;
    }

    // Calculate select frequency amplitude
    function calculateLowFrequencyAmplitude(dataArray) {
        const lowFrequencyRange = 190;
        let lowFrequencyAmplitude = 0;

        for (let i = 255; i > lowFrequencyRange; i--) {
            lowFrequencyAmplitude += dataArray[i];
        }
        lowFrequencyAmplitude /= (255 - lowFrequencyRange + 1);
        return lowFrequencyAmplitude;
    }

    // Update minimum and maximum thresholds based on previous x seconds
    function updateThresholdRange(lowFrequencyAmplitude, bpm) {
        amplitudeWindow.push({ amplitude: lowFrequencyAmplitude, time: audioContext.currentTime });

        if (bpm >= 50 && bpm <=200) {
            windowDuration = bpm / 30;
        }
        
        while (amplitudeWindow.length > 0 && audioContext.currentTime - amplitudeWindow[0].time > windowDuration) {
            amplitudeWindow.shift();
        }

        minThreshold = Math.min(...amplitudeWindow.map(entry => entry.amplitude));
        maxThreshold = Math.max(...amplitudeWindow.map(entry => entry.amplitude));

        if (bpm < 50) {
            rangeMultiplier = Math.max(0.5, rangeMultiplier - 0.01);
        } else if (bpm > 200) {
            rangeMultiplier = Math.min(0.9, rangeMultiplier + 0.01);
        }
    }

    // Normalise audio data
    function normaliseAudioData(arrayBuffer) {
        return new Promise((resolve, reject) => {
            audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
                const numberOfChannels = audioBuffer.numberOfChannels;
                const peakValues = [];

                for (let channel = 0; channel < numberOfChannels; channel++) {
                    const channelData = audioBuffer.getChannelData(channel);
                    let peak = 0;

                    for (let i = 0; i < channelData.length; i++) {
                        const absValue = Math.abs(channelData[i]);
                        if (absValue > peak) {
                            peak = absValue;
                        }
                    }

                    peakValues.push(peak);
                }

                const maxPeak = Math.max(...peakValues);

                for (let channel = 0; channel < numberOfChannels; channel++) {
                    const channelData = audioBuffer.getChannelData(channel);

                    for (let i = 0; i < channelData.length; i++) {
                        channelData[i] /= maxPeak;
                    }
                }
                resolve(audioBuffer);
            }, reject);
        });
    }


    // Play button click event
    playButton.addEventListener("click", function () {
        if (audioBuffer) {
            if (!audioSource) {
                startTime = audioContext.currentTime;
                audioSource = audioContext.createBufferSource();
                audioSource.buffer = audioBuffer;
                audioSource.connect(analyser);
                analyser.connect(audioContext.destination);

                audioSource.start(0, lastMessageTime);

                detectBeats();
            } else if (audioSource && audioContext.state === "suspended") {
                audioContext.resume();
            }
        }
    });

    // Pause button click event
    pauseButton.addEventListener("click", function () {
        if (audioSource && audioContext.state === "running") {
            audioContext.suspend();
        }
    });

    // Decode audio data
    function decodeAudioData(arrayBuffer) {
        return new Promise((resolve, reject) => {
            audioContext.decodeAudioData(arrayBuffer, resolve, reject);
        });
    }

    // MP3 file input
    mp3FileInput.addEventListener("change", function (event) {
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = async function (e) {
            const arrayBuffer = e.target.result;
            audioBuffer = await normaliseAudioData(arrayBuffer);

            // Check if the file name has odd or even number of characters
            const fileName = file.name;
            mode = fileName.length % 2 === 0 ? "major" : "minor";

            updateColors(0, mode);
        };

        reader.readAsArrayBuffer(file);
    });
}