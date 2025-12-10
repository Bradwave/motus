
const spaceCanvas = document.getElementById('space-canvas');
const spaceCtx = spaceCanvas.getContext('2d');
const plotCanvas = document.getElementById('plot-canvas');
const plotCtx = plotCanvas.getContext('2d');
const velocityCanvas = document.getElementById('velocity-canvas');
const velocityCtx = velocityCanvas.getContext('2d');
const velocityContainer = document.getElementById('velocity-container');

const recordBtn = document.getElementById('record-button');
const recordIcon = document.getElementById('record-icon');
const clearBtn = document.getElementById('clear-button');
const showTraceCheckbox = document.getElementById('show-trace');
const showVelocityCheckbox = document.getElementById('show-velocity'); // New
const showGridCheckbox = document.getElementById('show-grid');
const fullscreenBtn = document.getElementById('fullscreen-button');
const fullscreenIcon = document.getElementById('fullscreen-icon');
const rotateHint = document.getElementById('rotate-hint');
const dismissRotateHintBtn = document.getElementById('dismiss-rotate-hint');
const deleteRecBtn = document.getElementById('delete-recording-button'); // New
const smoothingSlider = document.getElementById('smoothing-slider'); // New
const smoothingValue = document.getElementById('smoothing-value'); // New
let rawRecordings = []; // New


// Playback UI
// Playback UI
const playbackOverlay = document.getElementById('playback-overlay');
const playPauseBtn = document.getElementById('play-pause-button');
const playIcon = document.getElementById('play-icon');
const playbackTimeLabel = document.getElementById('playback-time');

function togglePlaybackUI(show) {
    if (show) {
        playbackOverlay.classList.remove('hidden');
        isPlaying = false;
        playIcon.innerText = 'play_arrow';
        playbackTime = 0;
        playbackTimeLabel.innerText = '0.0s';
        
        // Ensure velocity plot resizes correctly if shown
        if (showVelocityCheckbox.checked) resize();
    } else {
        playbackOverlay.classList.add('hidden');
        isPlaying = false;
        playIcon.innerText = 'play_arrow';
    }
}

playPauseBtn.addEventListener('click', () => {
    if (selectedRecIndex === -1) return;
    
    if (isPlaying) {
        isPlaying = false;
        playIcon.innerText = 'play_arrow';
    } else {
        // ... Check end
        const rec = recordings[selectedRecIndex];
        const maxT = rec[rec.length-1].t;
        if (playbackTime >= maxT) {
            playbackTime = 0;
        }
        
        isPlaying = true;
        playIcon.innerText = 'pause';
        lastFrameTime = Date.now();
    }
});

// Config
const TRACE_INTERVAL_MS = 50; 
const COL_ACCENT = '#1484e6';
const COL_ACCENT_DARK = '#0f6cb8';
const COL_BG = '#ffffff';
const COL_AXIS = '#333333';
const COL_GRID = '#e0e0e0';
const COL_GRID_TEXT = '#888';

// State
let ballPos = 0.0; 
let draggingPtrId = null; 
let isRecording = false;
let recordings = []; 
let currentRec = [];
let recStartTime = 0;

// Playback State
let selectedRecIndex = -1; 
let isPlaying = false;
let playbackTime = 0.0;
let lastFrameTime = 0;

// Layout
let isVertical = false;

// Resize Observer
const resizeObserver = new ResizeObserver(() => {
    resize();
});
resizeObserver.observe(document.getElementById('main-container'));

function resize() {
    const dpr = window.devicePixelRatio || 1;
    
    // Space
    const rect = spaceCanvas.parentElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    spaceCanvas.width = rect.width * dpr;
    spaceCanvas.height = rect.height * dpr;
    spaceCtx.resetTransform();
    spaceCtx.scale(dpr, dpr);
    
    isVertical = rect.height > rect.width;

// ... Inside resize function
    // Plot
    const rectP = plotCanvas.parentElement.getBoundingClientRect();
    plotCanvas.width = rectP.width * dpr;
    plotCanvas.height = rectP.height * dpr;
    plotCtx.resetTransform();
    plotCtx.scale(dpr, dpr);
    
    // Velocity
    if (showVelocityCheckbox.checked) {
        velocityContainer.style.display = 'block';
        const rectV = velocityCanvas.parentElement.getBoundingClientRect();
        velocityCanvas.width = rectV.width * dpr;
        velocityCanvas.height = rectV.height * dpr;
        velocityCtx.resetTransform();
        velocityCtx.scale(dpr, dpr);
    } else {
        velocityContainer.style.display = 'none';
    }
}

showVelocityCheckbox.addEventListener('change', () => {
    resize();
});

// ... (Listeners)

// ... (Loop)
function loop() {
    const now = Date.now();
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    
    update(dt);
    drawSpace();
    drawPlot();
    if (showVelocityCheckbox.checked) drawVelocity();
    requestAnimationFrame(loop);
}

// ... (Update, DrawSpace, DrawPlot)

function drawVelocity() {
    const w = velocityCanvas.width / window.devicePixelRatio;
    const h = velocityCanvas.height / window.devicePixelRatio;
    
    velocityCtx.clearRect(0, 0, w, h);
    
    const padL = 40, padR = 20, padT = 20, padB = 25;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    
    let maxTime = 5;
    let maxV = 2; // Default range +/- 2
    
    const allRecs = [...recordings];
    if (isRecording) allRecs.push(currentRec);
    
    allRecs.forEach(rec => {
        if (rec.length > 0 && rec[rec.length-1].t > maxTime)
            maxTime = rec[rec.length-1].t;
        
        // Find max velocity roughly to scale Y axis?
        // Let's iterate points
        for(let i=1; i<rec.length; i++) {
            const v = (rec[i].x - rec[i-1].x) / (rec[i].t - rec[i-1].t || 0.001);
            if (Math.abs(v) > maxV) maxV = Math.abs(v);
        }
    });

    // Clamp maxV to reasonable limits to avoid flat lines or infinite zoom
    if (maxV < 1) maxV = 1;
    if (maxV > 20) maxV = 20; // Cap visual range
    
    // Axis Lines & Grid
    // Y Axis (Velocity) - Symmetric around 0
    velocityCtx.beginPath();
    velocityCtx.strokeStyle = '#aaa';
    velocityCtx.lineWidth = 2;
    velocityCtx.moveTo(padL, padT);
    velocityCtx.lineTo(padL, h - padB); // Y axis
    
    // Zero line
    const zeroY = padT + plotH / 2;
    velocityCtx.moveTo(padL, zeroY);
    velocityCtx.lineTo(w - padR, zeroY);
    
    velocityCtx.stroke();
    
    // Labels for Y
    velocityCtx.fillStyle = COL_GRID_TEXT;
    velocityCtx.font = '10px Space Mono';
    velocityCtx.textAlign = 'right';
    velocityCtx.textBaseline = 'middle';
    velocityCtx.fillText('0', padL - 6, zeroY);
    velocityCtx.fillText(maxV.toFixed(1), padL - 6, padT);
    velocityCtx.fillText((-maxV).toFixed(1), padL - 6, h - padB);

    // X Axis same as plot
    let tStep = 1;
    if (maxTime > 10) tStep = 2;
    if (maxTime > 30) tStep = 5;
    
    for (let t = 0; t <= Math.ceil(maxTime); t += tStep) {
        if (t > maxTime) break;
        const xx = padL + (t / maxTime) * plotW;
        
        velocityCtx.beginPath();
        velocityCtx.strokeStyle = COL_GRID;
        velocityCtx.lineWidth = 1;

        if (showGridCheckbox.checked) {
             velocityCtx.moveTo(xx, padT);
             velocityCtx.lineTo(xx, h - padB);
        } else {
             velocityCtx.moveTo(xx, h - padB);
             velocityCtx.lineTo(xx, h - padB - 5);
        }
        velocityCtx.stroke();
        
        velocityCtx.fillStyle = COL_GRID_TEXT;
        velocityCtx.textAlign = 'center';
        velocityCtx.textBaseline = 'top';
        velocityCtx.fillText(t + 's', xx, h - padB + 5);
    }
    
    // Draw V-Curves
    allRecs.forEach((rec, idx) => {
        if (rec.length < 2) return;
        const isSel = (idx === selectedRecIndex);
        const color = isSel ? COL_ACCENT : 'rgba(20, 132, 230, 0.3)';
        const lw = isSel ? 2 : 1;
        
        velocityCtx.strokeStyle = color;
        velocityCtx.lineWidth = lw;
        velocityCtx.beginPath();
        
        // We'll compute v at each point i as (x[i] - x[i-1]) / dt
        // For i=0, v=0 or forward diff
        
        const getPt = (i) => {
            const v = (rec[i].x - rec[i-1].x) / (rec[i].t - rec[i-1].t);
            // Map v to Y:  range [-maxV, maxV] -> [h - padB, padT]
            // norm = (v - (-maxV)) / (2*maxV) = (v + maxV) / (2*maxV)
            // y = (h - padB) - norm * plotH
            
            const norm = (v + maxV) / (2 * maxV);
            return {
                x: padL + (rec[i].t / maxTime) * plotW,
                y: (h - padB) - norm * plotH
            };
        };
        
        // Start from i=1 for backward diff
        const start = getPt(1);
        if(!start) return; // safety
        
        velocityCtx.moveTo(start.x, start.y);
        for(let i=2; i<rec.length; i++) {
            const pt = getPt(i);
            velocityCtx.lineTo(pt.x, pt.y);
        }
        velocityCtx.stroke();
    });
    
    // Playback marker on velocity
    if ((isPlaying || selectedRecIndex !== -1) && playbackTime > 0) {
        const xT = Math.round(padL + (playbackTime / maxTime) * plotW) + 0.5;
        if (xT <= w - padR) {
            velocityCtx.strokeStyle = COL_ACCENT_DARK;
            velocityCtx.lineWidth = 1;
            velocityCtx.setLineDash([4, 4]);
            velocityCtx.beginPath();
            velocityCtx.moveTo(xT, padT);
            velocityCtx.lineTo(xT, h - padB);
            velocityCtx.stroke();
            velocityCtx.setLineDash([]);
        }
    }
}

// Rotate Hint
if (window.matchMedia("(max-width: 600px) and (orientation: portrait)").matches) {
    rotateHint.classList.add('active');
}
dismissRotateHintBtn.addEventListener('click', () => {
    rotateHint.classList.remove('active');
    setTimeout(resize, 100);
});

// Coordinate Systems
function valToSpace(val) {
    const w = spaceCanvas.width / window.devicePixelRatio;
    const h = spaceCanvas.height / window.devicePixelRatio;
    const padding = 60; 

    if (isVertical) {
        const effectiveH = h - 2 * padding;
        const norm = (val + 1) / 2; 
        return { 
            x: w / 2, 
            y: h - padding - (norm * effectiveH) 
        };
    } else {
        const effectiveW = w - 2 * padding;
        const norm = (val + 1) / 2;
        return { 
            x: padding + norm * effectiveW, 
            y: h / 2 
        };
    }
}

function spaceToVal(x, y) {
    const w = spaceCanvas.width / window.devicePixelRatio;
    const h = spaceCanvas.height / window.devicePixelRatio;
    const padding = 60;
    
    if (isVertical) {
        const effectiveH = h - 2 * padding;
        let norm = (h - padding - y) / effectiveH;
        return Math.max(0, Math.min(1, norm)) * 2 - 1;
    } else {
        const effectiveW = w - 2 * padding;
        let norm = (x - padding) / effectiveW;
        return Math.max(0, Math.min(1, norm)) * 2 - 1;
    }
}

// Interaction
spaceCanvas.addEventListener('pointerdown', (e) => {
    if (draggingPtrId !== null || isPlaying) return; 
    
    const rect = spaceCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const pos = valToSpace(ballPos);
    const dist = Math.sqrt((x - pos.x)**2 + (y - pos.y)**2);
    
    // Check if dragging near ball for actual drag?
    // Or allow tapping anywhere to teleport? Dragging implies dragging the ball.
    if (dist < 40) { 
        draggingPtrId = e.pointerId;
        spaceCanvas.setPointerCapture(e.pointerId);
    }
});

spaceCanvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === draggingPtrId) {
        const rect = spaceCanvas.getBoundingClientRect();
        ballPos = spaceToVal(e.clientX - rect.left, e.clientY - rect.top);
    }
});

function endDrag(e) {
    if (e.pointerId === draggingPtrId) draggingPtrId = null;
}
spaceCanvas.addEventListener('pointerup', endDrag);
spaceCanvas.addEventListener('pointercancel', endDrag);

// Recording
function startRecording() {
    if (isRecording || isPlaying) return;
    isRecording = true;
    recStartTime = Date.now();
    currentRec = [];
    
    recordBtn.classList.add('recording');
    recordIcon.innerText = 'stop_circle';
    
    selectedRecIndex = -1;
    togglePlaybackUI(false);
}

function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    if (currentRec.length > 1) {
        // Save to raw
        rawRecordings.push(currentRec);
        
        // Apply current smoothing
        const smVal = parseInt(smoothingSlider.value, 10);
        const smoothed = smoothRecording(currentRec, smVal);
        recordings.push(smoothed);
        
        selectedRecIndex = recordings.length - 1;
        togglePlaybackUI(true);
    }
    currentRec = [];
    
    recordBtn.classList.remove('recording');
    recordIcon.innerText = 'fiber_manual_record';
}

function smoothRecording(rec, windowSize) {
    if (windowSize <= 1 || rec.length < windowSize) return [...rec]; 
    
    // Simple Moving Average
    const smoothed = [];
    for (let i = 0; i < rec.length; i++) {
        let sum = 0;
        let count = 0;
        // Centered window preferable, or trailing? slider usually implies trailing in real-time but this is post-process. Centered is better for phase.
        // Let's do centered: [i - w/2, i + w/2]
        const half = Math.floor(windowSize / 2);
        const start = Math.max(0, i - half);
        const end = Math.min(rec.length - 1, i + half);
        
        for (let j = start; j <= end; j++) {
            sum += rec[j].x;
            count++;
        }
        
        smoothed.push({
            t: rec[i].t,
            x: sum / count
        });
    }
    return smoothed;
}

// Slider Logic (Non-retroactive, local to current/selected)
smoothingSlider.addEventListener('input', () => {
    const val = parseInt(smoothingSlider.value, 10);
    smoothingValue.innerText = val;
    
    // Only update the currently selected recording
    if (selectedRecIndex !== -1 && rawRecordings[selectedRecIndex]) {
        const smoothed = smoothRecording(rawRecordings[selectedRecIndex], val);
        recordings[selectedRecIndex] = smoothed;
        
        requestAnimationFrame(() => {
            drawSpace();
            drawPlot();
            if (showVelocityCheckbox.checked) drawVelocity();
        });
    }
});

// Delete Logic
deleteRecBtn.addEventListener('click', () => {
    if (selectedRecIndex !== -1) {
        recordings.splice(selectedRecIndex, 1);
        rawRecordings.splice(selectedRecIndex, 1);
        
        selectedRecIndex = -1;
        togglePlaybackUI(false);
        
        requestAnimationFrame(() => {
            drawSpace();
            drawPlot();
            if (showVelocityCheckbox.checked) drawVelocity();
        });
    }
});

recordBtn.addEventListener('pointerdown', (e) => {
    startRecording();
    recordBtn.setPointerCapture(e.pointerId);
});
recordBtn.addEventListener('pointerup', stopRecording);
recordBtn.addEventListener('pointercancel', stopRecording); 
recordBtn.addEventListener('pointerleave', stopRecording);

document.addEventListener('keydown', (e) => {
    if ((e.key === 'r' || e.key === 'R') && !e.repeat) startRecording();
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'r' || e.key === 'R') stopRecording();
});


// Plot Interaction
plotCanvas.addEventListener('click', (e) => {
    const rect = plotCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    resize();
    
    const w = plotCanvas.width / window.devicePixelRatio;
    const h = plotCanvas.height / window.devicePixelRatio;
    const padL = 40, padR = 20, padT = 20, padB = 20;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    
    let maxTime = 5;
    recordings.forEach(rec => {
        if (rec.length > 0 && rec[rec.length-1].t > maxTime) maxTime = rec[rec.length-1].t;
    });
    
    const tClick = ((x - padL) / plotW) * maxTime;
    const valClick = 1 - 2 * ((y - padT) / plotH);
    
    if (x < padL || x > w - padR || y < padT || y > h - padB) {
        selectedRecIndex = -1;
        togglePlaybackUI(false);
        return;
    }

    let closestIdx = -1;
    let minDiff = 0.3; 
    
    recordings.forEach((rec, idx) => {
        const valAtT = interpolateX(rec, tClick);
        if (valAtT !== null) {
            const diff = Math.abs(valAtT - valClick);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = idx;
            }
        }
    });
    
    if (closestIdx !== -1) {
        selectedRecIndex = closestIdx;
        togglePlaybackUI(true);
    } else {
        selectedRecIndex = -1;
        togglePlaybackUI(false);
    }
});

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenIcon.innerText = 'fullscreen_exit';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            fullscreenIcon.innerText = 'fullscreen';
        }
    }
});

clearBtn.addEventListener('click', () => {
    recordings = [];
    currentRec = [];
    selectedRecIndex = -1;
    togglePlaybackUI(false);
    isRecording = false;
});

// Loop
function loop() {
    const now = Date.now();
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    
    update(dt);
    drawSpace();
    drawPlot();
    requestAnimationFrame(loop);
}

function update(dt) {
    if (isRecording) {
        const t = (Date.now() - recStartTime) / 1000;
        currentRec.push({ t: t, x: ballPos });
    } else if (isPlaying && selectedRecIndex !== -1) {
        const rec = recordings[selectedRecIndex];
        const maxT = rec[rec.length-1].t;
        
        playbackTime += dt;
        if (playbackTime > maxT) {
            playbackTime = maxT;
            isPlaying = false;
            playIcon.innerText = 'play_arrow';
        }
        
        const val = interpolateX(rec, playbackTime);
        if (val !== null) ballPos = val;
        
        playbackTimeLabel.innerText = playbackTime.toFixed(1) + 's';
    }
}

function drawSpace() {
    const w = spaceCanvas.width / window.devicePixelRatio;
    const h = spaceCanvas.height / window.devicePixelRatio;
    
    spaceCtx.clearRect(0, 0, w, h);
    
    const padding = 60;
    
    spaceCtx.strokeStyle = COL_AXIS;
    spaceCtx.lineWidth = 2;
    spaceCtx.lineCap = 'round';
    spaceCtx.beginPath();
    
    let pStart, pEnd;
    if (isVertical) {
        pStart = {x: w/2, y: padding};
        pEnd = {x: w/2, y: h - padding};
    } else {
        pStart = {x: padding, y: h/2};
        pEnd = {x: w - padding, y: h/2};
    }
    
    spaceCtx.moveTo(pStart.x, pStart.y);
    spaceCtx.lineTo(pEnd.x, pEnd.y);
    spaceCtx.stroke();
    
    // Notches logic
    spaceCtx.fillStyle = COL_AXIS;
    spaceCtx.font = '12px Space Mono';
    
    // Base notches
    const mainNotches = [-1, -0.5, 0, 0.5, 1];
    
    // Extra notches if grid shown
    const allNotches = showGridCheckbox.checked ? 
        // Generates -1, -0.9, ... 1.0 (step 0.1)
        Array.from({length: 21}, (_, i) => -1 + i * 0.1) 
        : mainNotches;

    allNotches.forEach(val => {
        val = Math.round(val * 10) / 10; // Avoid float errors
        const pos = valToSpace(val);
        const isMain = mainNotches.includes(val);
        
        // Skip non-main if !showGrid (handled by list definition)
        // But if showGrid is true, we want to visually distinguish main vs sub
        
        spaceCtx.beginPath();
        
        const tickLen = isMain ? 10 : 5;
        spaceCtx.lineWidth = isMain ? 2 : 1;
        spaceCtx.strokeStyle = isMain ? COL_AXIS : '#999';

        if (isVertical) {
            spaceCtx.moveTo(pos.x - tickLen, pos.y);
            spaceCtx.lineTo(pos.x + tickLen, pos.y);
            
            // Labels only for main or all? "display time notches... and add MORE notches on position... maket these ... toggable"
            // Usually main labels always shown. Sub labels optional or omitted to avoid clutter.
            if (isMain) {
                spaceCtx.textAlign = 'right';
                spaceCtx.textBaseline = 'middle';
                spaceCtx.fillStyle = COL_AXIS;
                spaceCtx.fillText(val.toFixed(1), pos.x - 15, pos.y);
            }
        } else {
            spaceCtx.moveTo(pos.x, pos.y - tickLen);
            spaceCtx.lineTo(pos.x, pos.y + tickLen);
            
            if (isMain) {
                spaceCtx.textAlign = 'center';
                spaceCtx.textBaseline = 'bottom';
                spaceCtx.fillStyle = COL_AXIS;
                spaceCtx.fillText(val.toFixed(1), pos.x, pos.y - 15);
            }
        }
        spaceCtx.stroke();
    });
    
    // Trace
    if (showTraceCheckbox.checked && selectedRecIndex !== -1) {
        const rec = recordings[selectedRecIndex];
        const maxT = rec[rec.length-1].t;
        
        for (let t = 0; t <= maxT; t += TRACE_INTERVAL_MS/1000) {
            const val = interpolateX(rec, t);
            if (val !== null) {
                const pos = valToSpace(val);
                const progress = t / maxT; 
                const lightness = 75 - (progress * 75); 
                spaceCtx.fillStyle = `hsl(210, 10%, ${lightness}%)`; 
                spaceCtx.beginPath();
                spaceCtx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                spaceCtx.fill();
            }
        }
    }
    
    // Ball
    const pos = valToSpace(ballPos);
    spaceCtx.shadowColor = "rgba(0,0,0,0.2)";
    spaceCtx.shadowBlur = 10;
    spaceCtx.shadowOffsetY = 4;
    spaceCtx.beginPath();
    spaceCtx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
    spaceCtx.fillStyle = COL_ACCENT; 
    spaceCtx.fill();
    spaceCtx.shadowColor = "transparent";
    spaceCtx.shadowBlur = 0;
    spaceCtx.shadowOffsetY = 0;
    spaceCtx.strokeStyle = '#fff';
    spaceCtx.lineWidth = 3;
    spaceCtx.stroke();
}

function drawPlot() {
    const w = plotCanvas.width / window.devicePixelRatio;
    const h = plotCanvas.height / window.devicePixelRatio;
    
    plotCtx.clearRect(0, 0, w, h);
    
    const padL = 40, padR = 20, padT = 20, padB = 25; // More bottom padding for time labels
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    
    let maxTime = 5;
    const allRecs = [...recordings];
    if (isRecording) allRecs.push(currentRec);
    
    allRecs.forEach(rec => {
        if (rec.length > 0 && rec[rec.length-1].t > maxTime)
            maxTime = rec[rec.length-1].t;
    });
    
    // Y Axis Notches (Position)
    // Toggled extra notches
    const mainY = [-1, -0.5, 0, 0.5, 1];
    const ticksY = showGridCheckbox.checked ? 
        Array.from({length: 9}, (_, i) => -1 + i * 0.25) // Every 0.25
        : mainY;

    ticksY.forEach(val => {
        val = Math.round(val * 100) / 100;
        const norm = (val + 1) / 2;
        const yy = (h - padB) - (norm * plotH);
        
        plotCtx.beginPath();
        plotCtx.strokeStyle = mainY.includes(val) ? COL_GRID : '#f0f0f0';
        plotCtx.lineWidth = 1;
        plotCtx.moveTo(padL, yy);
        plotCtx.lineTo(w - padR, yy);
        plotCtx.stroke();
        
        // Labels for main only to avoid crowding
        if (mainY.includes(val)) {
            plotCtx.fillStyle = COL_GRID_TEXT;
            plotCtx.font = '10px Space Mono';
            plotCtx.textAlign = 'right';
            plotCtx.textBaseline = 'middle';
            plotCtx.fillText(val.toFixed(1), padL - 6, yy);
        }
    });
    
    // X Axis Notches (Time) - NEW
    // Adaptive step based on maxTime
    let tStep = 1;
    if (maxTime > 10) tStep = 2;
    if (maxTime > 30) tStep = 5;
    
    for (let t = 0; t <= Math.ceil(maxTime); t += tStep) {
        if (t > maxTime) break;
        const xx = padL + (t / maxTime) * plotW;
        
        plotCtx.beginPath();
        plotCtx.strokeStyle = COL_GRID;
        plotCtx.lineWidth = 1;
        // Grid line or just notch? "display time notches... on the plot" usually implies grid or ticks
        // Let's do ticks on bottom axis primarily, maybe full grid line if grid toggled?
        // Let's do full grid lines for time if grid is on, otherwise ticks.
        
        if (showGridCheckbox.checked) {
             plotCtx.moveTo(xx, padT);
             plotCtx.lineTo(xx, h - padB);
        } else {
             plotCtx.moveTo(xx, h - padB);
             plotCtx.lineTo(xx, h - padB - 5);
        }
        plotCtx.stroke();
        
        // Label
        plotCtx.fillStyle = COL_GRID_TEXT;
        plotCtx.font = '10px Space Mono';
        plotCtx.textAlign = 'center';
        plotCtx.textBaseline = 'top';
        plotCtx.fillText(t + 's', xx, h - padB + 5);
    }
    
    // Axis Lines
    plotCtx.beginPath();
    plotCtx.strokeStyle = '#aaa'; 
    plotCtx.lineWidth = 2; // Slightly thicker
    // Y-axis line
    plotCtx.moveTo(padL, h - padB);
    plotCtx.lineTo(padL, padT);
    // X-axis line
    plotCtx.moveTo(padL, h - padB);
    plotCtx.lineTo(w - padR, h - padB);
    plotCtx.stroke();
    
    // Curves
    recordings.forEach((rec, idx) => {
        const isSel = (idx === selectedRecIndex);
        let color, lw;
        if (isSel) {
            color = COL_ACCENT; 
            lw = 3;
        } else {
            color = 'rgba(20, 132, 230, 0.3)'; 
            lw = 2;
        }
        drawCurve(rec, maxTime, color, lw, plotW, plotH, padL, padB, h);
    });
    
    if (isRecording && currentRec.length > 0) {
        drawCurve(currentRec, maxTime, COL_ACCENT_DARK, 3, plotW, plotH, padL, padB, h);
    }
    
    if ((isPlaying || selectedRecIndex !== -1) && playbackTime > 0) {
        const xT = Math.round(padL + (playbackTime / maxTime) * plotW) + 0.5; // Snap to pixel
        if (xT <= w - padR) {
            plotCtx.strokeStyle = COL_ACCENT_DARK;
            plotCtx.lineWidth = 1;
            plotCtx.setLineDash([4, 4]);
            plotCtx.beginPath();
            plotCtx.moveTo(xT, padT);
            plotCtx.lineTo(xT, h - padB);
            plotCtx.stroke();
            plotCtx.setLineDash([]);
        }
    }
}

function drawCurve(rec, maxTime, color, lw, plotW, plotH, padL, padB, canvasH) {
    if (rec.length < 2) return;
    plotCtx.strokeStyle = color;
    plotCtx.lineWidth = lw;
    plotCtx.lineJoin = 'round';
    plotCtx.lineCap = 'round';
    plotCtx.beginPath();
    const getPt = (p) => {
        return {
            x: padL + (p.t / maxTime) * plotW,
            y: (canvasH - padB) - ((p.x + 1) / 2) * plotH
        };
    };
    const start = getPt(rec[0]);
    plotCtx.moveTo(start.x, start.y);
    for (let i = 1; i < rec.length; i++) {
        const pt = getPt(rec[i]);
        plotCtx.lineTo(pt.x, pt.y);
    }
    plotCtx.stroke();
}

function interpolateX(rec, t) {
    if (rec.length === 0) return null;
    if (t <= rec[0].t) return rec[0].x;
    if (t >= rec[rec.length-1].t) return rec[rec.length-1].x;
    for (let i = 0; i < rec.length - 1; i++) {
        if (t >= rec[i].t && t <= rec[i+1].t) {
            const r = (t - rec[i].t) / (rec[i+1].t - rec[i].t);
            return rec[i].x + r * (rec[i+1].x - rec[i].x);
        }
    }
    return rec[rec.length-1].x;
}

loop();
