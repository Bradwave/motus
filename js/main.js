
const spaceCanvas = document.getElementById('space-canvas');
const spaceCtx = spaceCanvas.getContext('2d');
const plotCanvas = document.getElementById('plot-canvas');
const plotCtx = plotCanvas.getContext('2d');

const recordBtn = document.getElementById('record-button');
const recordIcon = document.getElementById('record-icon');
const clearBtn = document.getElementById('clear-button');
const showTraceCheckbox = document.getElementById('show-trace');
const showGridCheckbox = document.getElementById('show-grid'); // New
const fullscreenBtn = document.getElementById('fullscreen-button');
const fullscreenIcon = document.getElementById('fullscreen-icon');
const rotateHint = document.getElementById('rotate-hint');
const dismissRotateHintBtn = document.getElementById('dismiss-rotate-hint');

// Playback UI
const playbackOverlay = document.getElementById('playback-overlay');
const playPauseBtn = document.getElementById('play-pause-button');
const playIcon = document.getElementById('play-icon');
const playbackTimeLabel = document.getElementById('playback-time');

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

    // Plot
    const rectP = plotCanvas.parentElement.getBoundingClientRect();
    plotCanvas.width = rectP.width * dpr;
    plotCanvas.height = rectP.height * dpr;
    plotCtx.resetTransform();
    plotCtx.scale(dpr, dpr);
}

window.addEventListener('resize', resize);
setTimeout(resize, 100);

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
        recordings.push(currentRec);
        selectedRecIndex = recordings.length - 1;
        togglePlaybackUI(true);
    }
    currentRec = [];
    
    recordBtn.classList.remove('recording');
    recordIcon.innerText = 'fiber_manual_record';
}

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

// Playback Logic
function togglePlaybackUI(show) {
    if (show) {
        playbackOverlay.classList.remove('hidden');
        isPlaying = false;
        playIcon.innerText = 'play_arrow';
        playbackTime = 0;
        playbackTimeLabel.innerText = '0.0s';
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
        if (rec[rec.length-1].t > maxTime) maxTime = rec[rec.length-1].t;
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
        const xT = padL + (playbackTime / maxTime) * plotW;
        if (xT <= w - padR) {
            plotCtx.strokeStyle = '#333';
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
