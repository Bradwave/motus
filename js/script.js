
const spaceCanvas = document.getElementById('space-canvas');
const spaceCtx = spaceCanvas.getContext('2d');
const plotCanvas = document.getElementById('plot-canvas');
const plotCtx = plotCanvas.getContext('2d');

const recordBtn = document.getElementById('record-button');
const recordIcon = document.getElementById('record-icon');
const recordText = document.getElementById('record-text');
const clearBtn = document.getElementById('clear-button');
const showTraceCheckbox = document.getElementById('show-trace');

// State
let ballPos = 0.5; // 0.0 to 1.0
let isDragging = false;
let isRecording = false;
let mousePos = { x: 0, y: 0 };
let recordings = []; // Array of arrays of {t, x}
let currentRec = [];
let recStartTime = 0;

// Config
const TRACE_INTERVAL_MS = 200; // Dot every 200ms
const MAX_PLOT_TIME = 10000; // Start with 10s default scale, extend if needed?
// Let's make plot auto-scale or fixed 10s window? Overlap implies they share the scale. 
// We'll auto-scale X to the longest recording value or a minimum of 5s.

// Colors (get from CSS if possible, else hardcode match)
const COL_ACCENT = '#1484e6';
const COL_BG = '#ffffff';
const COL_TEXT = '#000000';
const COL_TRACE = 'rgba(20, 132, 230, 0.4)';
const COL_PREV_REC = '#c3c7cb';

// Resize handling
function resize() {
    // Space Canvas
    const rect = spaceCanvas.parentElement.getBoundingClientRect();
    spaceCanvas.width = rect.width * window.devicePixelRatio;
    spaceCanvas.height = rect.height * window.devicePixelRatio;
    spaceCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    spaceCanvas.style.width = `${rect.width}px`;
    spaceCanvas.style.height = `${rect.height}px`;

    // Plot Canvas
    const rectP = plotCanvas.parentElement.getBoundingClientRect();
    // Use the width of the container, height fixed in CSS
    // The CSS says width 100%, height 250px.
    // getBoundingClientRect will give the actual pixel size.
    // Note: plotCanvas is inside .plots-container with padding.
    // The canvas element itself should be sized correctly by CSS.
    // We update the internal resolution.
    const plotRect = plotCanvas.getBoundingClientRect();
    plotCanvas.width = plotRect.width * window.devicePixelRatio;
    plotCanvas.height = plotRect.height * window.devicePixelRatio;
    plotCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    // Don't set style width/height here if CSS handles it, just internal width/height
}
window.addEventListener('resize', resize);
setTimeout(resize, 100); // Initial resize

// Interaction
function getSpaceX(pos) {
    const rect = spaceCanvas.getBoundingClientRect();
    // Margin of 50px on each side
    const width = rect.width - 100;
    return 50 + pos * width;
}

function getPosFromX(x) {
    const rect = spaceCanvas.getBoundingClientRect();
    const width = rect.width - 100;
    let val = (x - 50) / width;
    return Math.max(0, Math.min(1, val));
}

spaceCanvas.addEventListener('pointerdown', (e) => {
    const rect = spaceCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check collision with ball
    const bx = getSpaceX(ballPos);
    const by = rect.height / 2;
    const dist = Math.sqrt((x - bx)**2 + (y - by)**2);
    
    if (dist < 30) { // Hit radius
        isDragging = true;
        spaceCanvas.setPointerCapture(e.pointerId);
    }
});

spaceCanvas.addEventListener('pointermove', (e) => {
    if (isDragging) {
        const rect = spaceCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        ballPos = getPosFromX(x);
    }
});

spaceCanvas.addEventListener('pointerup', (e) => {
    isDragging = false;
});

// Recording controls
function toggleRecording() {
    if (isRecording) {
        // Stop
        isRecording = false;
        if (currentRec.length > 0) {
            recordings.push(currentRec);
        }
        currentRec = [];
        recordBtn.style.backgroundColor = ''; // Revert to defaults
        recordIcon.textContent = 'fiber_manual_record';
        recordText.textContent = 'RECORD';
    } else {
        // Start
        isRecording = true;
        recStartTime = Date.now();
        currentRec = [];
        recordBtn.style.backgroundColor = '#e63946'; // Red for recording
        recordIcon.textContent = 'stop_circle';
        recordText.textContent = 'STOP';
    }
}

recordBtn.addEventListener('click', toggleRecording);

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        toggleRecording();
    }
});

clearBtn.addEventListener('click', () => {
    recordings = [];
    currentRec = [];
    isRecording = false;
    // Reset UI if was recording
    recordBtn.style.backgroundColor = '';
    recordIcon.textContent = 'fiber_manual_record';
    recordText.textContent = 'RECORD';
});

// Loop
function loop() {
    update();
    drawSpace();
    drawPlot();
    requestAnimationFrame(loop);
}

function update() {
    if (isRecording) {
        const t = (Date.now() - recStartTime) / 1000; // seconds
        currentRec.push({ t: t, x: ballPos });
    }
}

function drawSpace() {
    const w = spaceCanvas.width / window.devicePixelRatio;
    const h = spaceCanvas.height / window.devicePixelRatio;
    
    spaceCtx.clearRect(0, 0, w, h);
    
    const centerY = h / 2;
    const startX = 50;
    const endX = w - 50;
    
    // Draw Line
    spaceCtx.beginPath();
    spaceCtx.moveTo(startX, centerY);
    spaceCtx.lineTo(endX, centerY);
    spaceCtx.strokeStyle = '#000';
    spaceCtx.lineWidth = 2;
    spaceCtx.stroke();
    
    // Draw Ticks (0, 0.5, 1)
    for (let p of [0, 0.5, 1]) {
        let tx = startX + p * (endX - startX);
        spaceCtx.beginPath();
        spaceCtx.moveTo(tx, centerY - 10);
        spaceCtx.lineTo(tx, centerY + 10);
        spaceCtx.stroke();
    }
    
    // Draw Trace (Last Recording)
    if (showTraceCheckbox.checked) {
        let lastRec = null;
        if (isRecording && recordings.length > 0) {
            lastRec = recordings[recordings.length - 1]; // Previous one while recording?
            // "the last recording is also displayed"
            // Usually means the completed one.
        } else if (recordings.length > 0) {
            lastRec = recordings[recordings.length - 1];
        }
        
        if (lastRec) {
            spaceCtx.fillStyle = COL_ACCENT;
            spaceCtx.globalAlpha = 0.5;
            
            // Sample points
            let maxT = lastRec[lastRec.length-1].t;
            for (let tTarget = 0; tTarget <= maxT; tTarget += TRACE_INTERVAL_MS/1000) {
                // Find closest point or interpolate
                // Simple helper to find x at t
                const xVal = interpolateX(lastRec, tTarget);
                if (xVal !== null) {
                    const cx = startX + xVal * (endX - startX);
                    spaceCtx.beginPath();
                    spaceCtx.arc(cx, centerY, 4, 0, Math.PI * 2);
                    spaceCtx.fill();
                }
            }
            spaceCtx.globalAlpha = 1.0;
        }
    }
    
    // Draw Ball
    const bx = startX + ballPos * (endX - startX);
    spaceCtx.beginPath();
    spaceCtx.arc(bx, centerY, 15, 0, Math.PI * 2);
    spaceCtx.fillStyle = COL_ACCENT;
    spaceCtx.fill();
    spaceCtx.strokeStyle = '#fff';
    spaceCtx.lineWidth = 2;
    spaceCtx.stroke();
}

function drawPlot() {
    const w = plotCanvas.width / window.devicePixelRatio;
    const h = plotCanvas.height / window.devicePixelRatio;
    
    plotCtx.clearRect(0, 0, w, h);
    
    // Padding
    const padL = 40;
    const padR = 20;
    const padT = 20;
    const padB = 30;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    
    // Determine scales
    // X axis: Time. Max time of all recordings + current
    let maxTime = 5; // Min 5s
    
    const allRecs = [...recordings];
    if (currentRec.length > 0) allRecs.push(currentRec);
    
    allRecs.forEach(rec => {
        if (rec.length > 0) {
            const t = rec[rec.length-1].t;
            if (t > maxTime) maxTime = t;
        }
    });
    
    // Y axis: 0 to 1
    
    // Draw Axes
    plotCtx.strokeStyle = '#000';
    plotCtx.lineWidth = 1;
    
    // Y axis
    plotCtx.beginPath();
    plotCtx.moveTo(padL, padT);
    plotCtx.lineTo(padL, h - padB);
    plotCtx.stroke();
    
    // X axis
    plotCtx.beginPath();
    plotCtx.moveTo(padL, h - padB);
    plotCtx.lineTo(w - padR, h - padB);
    plotCtx.stroke();
    
    // Labels
    plotCtx.fillStyle = '#000';
    plotCtx.font = '12px Space Mono';
    plotCtx.textAlign = 'right';
    plotCtx.textBaseline = 'middle';
    plotCtx.fillText('1.0', padL - 5, padT);
    plotCtx.fillText('0.0', padL - 5, h - padB);
    
    plotCtx.textAlign = 'center';
    plotCtx.textBaseline = 'top';
    plotCtx.fillText('0', padL, h - padB + 5);
    plotCtx.fillText(maxTime.toFixed(1) + 's', w - padR, h - padB + 5);
    
    // Draw recordings
    // Previous ones in grey
    recordings.forEach(rec => {
        drawCurve(rec, maxTime);
    });
    
    // Current one in accent
    if (currentRec.length > 0) {
        drawCurve(currentRec, maxTime, true);
    }
    
    function drawCurve(rec, maxT, isCurrent = false) {
        if (rec.length < 2) return;
        
        plotCtx.beginPath();
        // Move to first point
        // x = padL + (t / maxT) * plotW
        // y = padT + (1 - val) * plotH (since 1 is top)
        
        const getPx = (p) => {
            const xx = padL + (p.t / maxT) * plotW;
            const yy = h - padB - (p.x * plotH);
            return {x: xx, y: yy};
        };
        
        let start = getPx(rec[0]);
        plotCtx.moveTo(start.x, start.y);
        
        for (let i = 1; i < rec.length; i++) {
            let pt = getPx(rec[i]);
            plotCtx.lineTo(pt.x, pt.y);
        }
        
        plotCtx.strokeStyle = isCurrent ? COL_ACCENT : COL_PREV_REC;
        plotCtx.lineWidth = 2;
        plotCtx.stroke();
    }
}

function interpolateX(rec, t) {
    // rec is sorted by t
    if (t < rec[0].t) return rec[0].x;
    if (t > rec[rec.length-1].t) return rec[rec.length-1].x;
    
    // Binary search or linear scan
    // Linear scan is fine for small recs, binary better
    for (let i = 0; i < rec.length - 1; i++) {
        if (t >= rec[i].t && t <= rec[i+1].t) {
            const t0 = rec[i].t;
            const t1 = rec[i+1].t;
            const x0 = rec[i].x;
            const x1 = rec[i+1].x;
            const ratio = (t - t0) / (t1 - t0);
            return x0 + ratio * (x1 - x0);
        }
    }
    return null;
}

// Start
resize(); // Call resize immediately to set sizes
loop();
