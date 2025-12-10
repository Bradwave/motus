
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
const btnTrace = document.getElementById('btn-trace');
const btnVelocity = document.getElementById('btn-velocity'); // New Icon Button
const showBallOnPlotCheckbox = document.getElementById('show-ball-on-plot');
const btnTangent = document.getElementById('btn-tangent');
const btnGrid = document.getElementById('btn-grid');
const fullscreenBtn = document.getElementById('fullscreen-button');
const fullscreenIcon = document.getElementById('fullscreen-icon');
const rotateHint = document.getElementById('rotate-hint');
const dismissRotateHintBtn = document.getElementById('dismiss-rotate-hint');
const deleteRecBtn = document.getElementById('delete-recording-button'); // New
const smoothingSlider = document.getElementById('smoothing-slider'); // New
const smoothingValue = document.getElementById('smoothing-value'); // New
const leftHandedToggle = document.getElementById('left-handed-toggle'); // New Toggle
const trackControls = document.getElementById('track-controls');
let rawRecordings = []; // New
let recordingSmoothingValues = []; // Store smoothing value for each recording


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
        if (settings.showVelocity) resize();
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

// LocalStorage - save/load options
const STORAGE_KEY = 'motus_options';

// Settings state
const settings = {
    showTrace: false,
    showBallOnPlot: false,
    showTangents: false, // New setting
    showGrid: true,
    leftHanded: false
};

function updateButtonState(btn, active) {
    if (active) btn.classList.add('active');
    else btn.classList.remove('active');
}

function saveOptions() {
    const options = {
        showTrace: settings.showTrace,
        showBallOnPlot: showBallOnPlotCheckbox.checked,
        showVelocity: settings.showVelocity,
        showTangents: settings.showTangents,
        showGrid: settings.showGrid,
        smoothing: parseInt(smoothingSlider.value, 10),
        leftHanded: leftHandedToggle.checked
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
}

function loadOptions() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const options = JSON.parse(stored);
            if (typeof options.showTrace === 'boolean') settings.showTrace = options.showTrace;
            if (typeof options.showBallOnPlot === 'boolean') showBallOnPlotCheckbox.checked = options.showBallOnPlot;
            if (typeof options.showVelocity === 'boolean') {
                settings.showVelocity = options.showVelocity;
                velocityContainer.style.display = options.showVelocity ? 'block' : 'none';
            }
            if (typeof options.showTangents === 'boolean') settings.showTangents = options.showTangents;
            if (typeof options.showGrid === 'boolean') settings.showGrid = options.showGrid;
            if (typeof options.smoothing === 'number') {
                smoothingSlider.value = options.smoothing;
                smoothingValue.innerText = options.smoothing;
            }
            if (typeof options.leftHanded === 'boolean') {
                leftHandedToggle.checked = options.leftHanded;
                applyLeftHandedMode(options.leftHanded);
            }
        }
        
        // Update UI
        updateButtonState(btnTrace, settings.showTrace);
        updateButtonState(btnTangent, settings.showTangents);
        updateButtonState(btnGrid, settings.showGrid);
        updateButtonState(btnVelocity, settings.showVelocity);
    } catch (e) {
        console.warn('Failed to load options from localStorage:', e);
    }
}

function applyLeftHandedMode(enabled) {
    if (enabled) {
        document.body.classList.add('left-handed');
    } else {
        document.body.classList.remove('left-handed');
    }
}

// Event Listeners for Icon Buttons
btnGrid.addEventListener('click', () => {
    settings.showGrid = !settings.showGrid;
    updateButtonState(btnGrid, settings.showGrid);
    saveOptions();
    resize(); // Redraw
});

btnTrace.addEventListener('click', () => {
    settings.showTrace = !settings.showTrace;
    updateButtonState(btnTrace, settings.showTrace);
    saveOptions();
});

btnTangent.addEventListener('click', () => {
    settings.showTangents = !settings.showTangents;
    updateButtonState(btnTangent, settings.showTangents);
    saveOptions();
    // Redraw required if hovering
    if (isHoveringPlot && hoverTime !== null) requestAnimationFrame(drawPlot);
});

showBallOnPlotCheckbox.addEventListener('change', saveOptions);

btnVelocity.addEventListener('click', () => {
    settings.showVelocity = !settings.showVelocity;
    updateButtonState(btnVelocity, settings.showVelocity);
    
    // Toggle container
    velocityContainer.style.display = settings.showVelocity ? 'block' : 'none';
    
    // Force reflow and resize
    void velocityContainer.offsetHeight;
    requestAnimationFrame(resize);
    
    saveOptions();
});

leftHandedToggle.addEventListener('change', () => {
    applyLeftHandedMode(leftHandedToggle.checked);
    saveOptions();
});

// Load options on startup
loadOptions();

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

// Hover State for plots - shared time for syncing between plots
let hoverTime = null; // Hovered time value (null = not hovering)
let isHoveringPlot = false; // True if hovering over position plot
let isHoveringVelocity = false; // True if hovering over velocity plot

// Resize Observer
const resizeObserver = new ResizeObserver(() => {
    resize();
});
resizeObserver.observe(document.getElementById('main-container'));

function resize() {
    const dpr = window.devicePixelRatio || 1;
    
    // Space - use canvas's own rect for correct sizing
    const rect = spaceCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    spaceCanvas.width = rect.width * dpr;
    spaceCanvas.height = rect.height * dpr;
    spaceCtx.resetTransform();
    spaceCtx.scale(dpr, dpr);
    
    isVertical = rect.height > rect.width;
    
    // Handle vertical/portrait mode layout
    handleOrientationLayout();

// ... Inside resize function
    // Plot
    const rectP = plotCanvas.parentElement.getBoundingClientRect();
    plotCanvas.width = rectP.width * dpr;
    plotCanvas.height = rectP.height * dpr;
    plotCtx.resetTransform();
    plotCtx.scale(dpr, dpr);
    
    // Velocity - only resize if visible
    if (settings.showVelocity && velocityContainer.style.display !== 'none') {
        const rectV = velocityCanvas.parentElement.getBoundingClientRect();
        velocityCanvas.width = rectV.width * dpr;
        velocityCanvas.height = rectV.height * dpr;
        velocityCtx.resetTransform();
        velocityCtx.scale(dpr, dpr);
    }
}

function handleOrientationLayout() {
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    
    if (isPortrait) {
        // Move record button and playback to track controls
        recordBtn.classList.add('in-track');
        playbackOverlay.classList.add('in-track');
        
        // Move elements to track controls directly
        if (trackControls && recordBtn.parentElement !== trackControls) {
            trackControls.appendChild(recordBtn);
            trackControls.appendChild(playbackOverlay);
        }
    } else {
        // Move back to section-track for landscape
        recordBtn.classList.remove('in-track');
        playbackOverlay.classList.remove('in-track');
        
        const sectionTrack = document.querySelector('.section-track');
        if (sectionTrack && recordBtn.parentElement !== sectionTrack) {
            // Insert at the beginning for left side positioning
            sectionTrack.insertBefore(recordBtn, sectionTrack.firstChild);
            // Playback overlay goes to plot section
            const sectionPlot = document.querySelector('.section-plot');
            if (sectionPlot) {
                sectionPlot.appendChild(playbackOverlay);
            }
        }
    }
}



// Save options when other controls change
// Save options when other controls change
smoothingSlider.addEventListener('change', saveOptions); // Save on release, not every input



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
        
        // Find max velocity using central difference with interval of 5
        const velInterval = 5;
        for(let i = velInterval; i < rec.length - velInterval; i++) {
            const dx = rec[i + velInterval].x - rec[i - velInterval].x;
            const dt = rec[i + velInterval].t - rec[i - velInterval].t;
            const v = dt > 0 ? dx / dt : 0;
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

        if (settings.showGrid) {
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
        
        // Use central difference with wider interval for smoother velocity
        // Interval = 5 points on each side (or as many as available)
        const velInterval = 5;
        
        const getVelocity = (i) => {
            // Central difference: use points before and after
            const halfInterval = Math.min(velInterval, i, rec.length - 1 - i);
            if (halfInterval < 1) return 0;
            
            const iPrev = i - halfInterval;
            const iNext = i + halfInterval;
            const dx = rec[iNext].x - rec[iPrev].x;
            const dt = rec[iNext].t - rec[iPrev].t;
            return dt > 0 ? dx / dt : 0;
        };
        
        const getPt = (i) => {
            const v = getVelocity(i);
            const norm = (v + maxV) / (2 * maxV);
            return {
                x: padL + (rec[i].t / maxTime) * plotW,
                y: (h - padB) - norm * plotH
            };
        };
        
        // Start from first valid point
        if (rec.length <= velInterval * 2) return; // Not enough points
        const start = getPt(velInterval);
        if(!start) return; // safety
        
        velocityCtx.moveTo(start.x, start.y);
        for(let i = velInterval + 1; i < rec.length - velInterval; i++) {
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
    
    // Hover line and coordinates (synced with position plot)
    if (hoverTime !== null && hoverTime >= 0 && hoverTime <= maxTime) {
        const hoverX = padL + (hoverTime / maxTime) * plotW;
        
        // Draw dashed vertical line
        velocityCtx.strokeStyle = '#666';
        velocityCtx.lineWidth = 1;
        velocityCtx.setLineDash([4, 4]);
        velocityCtx.beginPath();
        velocityCtx.moveTo(hoverX, padT);
        velocityCtx.lineTo(hoverX, h - padB);
        velocityCtx.stroke();
        velocityCtx.setLineDash([]);
        
        // Snap to selected recording and show highlighted point
        if (selectedRecIndex !== -1 && recordings[selectedRecIndex]) {
            const rec = recordings[selectedRecIndex];
            const velInterval = 5;
            
            // Only show blue dot if hoverTime is within the recording's time range
            const recMinTime = rec[0].t;
            const recMaxTime = rec[rec.length - 1].t;
            const isInTimeRange = hoverTime >= recMinTime && hoverTime <= recMaxTime;
            
            // Find velocity at hover time (only if in range)
            let velValue = null;
            if (isInTimeRange) {
                for (let i = velInterval; i < rec.length - velInterval; i++) {
                    if (rec[i].t >= hoverTime) {
                        const halfInt = Math.min(velInterval, i, rec.length - 1 - i);
                        if (halfInt >= 1) {
                            const dx = rec[i + halfInt].x - rec[i - halfInt].x;
                            const dt = rec[i + halfInt].t - rec[i - halfInt].t;
                            velValue = dt > 0 ? dx / dt : 0;
                        }
                        break;
                    }
                }
            }
            
            if (velValue !== null) {
                // Calculate Y position on the velocity graph
                const norm = (velValue + maxV) / (2 * maxV);
                const velY = (h - padB) - norm * plotH;
                
                // Draw highlighted point on the velocity curve
                velocityCtx.beginPath();
                velocityCtx.arc(hoverX, velY, 6, 0, Math.PI * 2);
                velocityCtx.fillStyle = COL_ACCENT;
                velocityCtx.fill();
                velocityCtx.strokeStyle = '#fff';
                velocityCtx.lineWidth = 2;
                velocityCtx.stroke();
                
                // Draw coordinate label if hovering this plot
                if (isHoveringVelocity) {
                    const labelText = `t: ${hoverTime.toFixed(2)}s, v: ${velValue.toFixed(2)}`;
                    
                    velocityCtx.font = '11px Space Mono';
                    const textWidth = velocityCtx.measureText(labelText).width;
                    const labelX = Math.min(hoverX + 15, w - padR - textWidth - 5);
                    const labelY = Math.max(velY - 15, padT + 15);
                    
                    velocityCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    velocityCtx.fillRect(labelX - 4, labelY - 11, textWidth + 8, 16);
                    
                    velocityCtx.fillStyle = '#333';
                    velocityCtx.textAlign = 'left';
                    velocityCtx.textBaseline = 'middle';
                    velocityCtx.fillText(labelText, labelX, labelY);
                }
            } else if (isHoveringVelocity) {
                // Graph selected but pointer NOT in time range - show only time
                const labelText = `t: ${hoverTime.toFixed(2)}s`;
                
                velocityCtx.font = '11px Space Mono';
                const textWidth = velocityCtx.measureText(labelText).width;
                const labelX = Math.min(hoverX + 8, w - padR - textWidth - 5);
                const labelY = padT + 15;
                
                velocityCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                velocityCtx.fillRect(labelX - 3, labelY - 11, textWidth + 6, 14);
                
                velocityCtx.fillStyle = '#333';
                velocityCtx.textAlign = 'left';
                velocityCtx.textBaseline = 'middle';
                velocityCtx.fillText(labelText, labelX, labelY);
            }
        } else if (isHoveringVelocity) {
            // No recording selected, just show time
            const labelText = `t: ${hoverTime.toFixed(2)}s`;
            
            velocityCtx.font = '11px Space Mono';
            const textWidth = velocityCtx.measureText(labelText).width;
            const labelX = Math.min(hoverX + 8, w - padR - textWidth - 5);
            const labelY = padT + 15;
            
            velocityCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            velocityCtx.fillRect(labelX - 3, labelY - 11, textWidth + 6, 14);
            
            velocityCtx.fillStyle = '#333';
            velocityCtx.textAlign = 'left';
            velocityCtx.textBaseline = 'middle';
            velocityCtx.fillText(labelText, labelX, labelY);
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
    // Dynamic padding - smaller for compact canvases
    const paddingH = Math.min(30, h * 0.15);
    const paddingW = Math.min(30, w * 0.1);

    if (isVertical) {
        const effectiveH = h - 2 * paddingH;
        const norm = (val + 1) / 2; 
        return { 
            x: w / 2, 
            y: h - paddingH - (norm * effectiveH) 
        };
    } else {
        const effectiveW = w - 2 * paddingW;
        const norm = (val + 1) / 2;
        return { 
            x: paddingW + norm * effectiveW, 
            y: h / 2 
        };
    }
}

function spaceToVal(x, y) {
    const w = spaceCanvas.width / window.devicePixelRatio;
    const h = spaceCanvas.height / window.devicePixelRatio;
    // Dynamic padding - smaller for compact canvases
    const paddingH = Math.min(60, h * 0.15);
    const paddingW = Math.min(60, w * 0.1);
    
    if (isVertical) {
        const effectiveH = h - 2 * paddingH;
        let norm = (h - paddingH - y) / effectiveH;
        return Math.max(0, Math.min(1, norm)) * 2 - 1;
    } else {
        const effectiveW = w - 2 * paddingW;
        let norm = (x - paddingW) / effectiveW;
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

// Haptic feedback helper
function triggerHaptic(type = 'light') {
    if ('vibrate' in navigator) {
        switch(type) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(25);
                break;
            case 'heavy':
                navigator.vibrate([50, 30, 50]);
                break;
        }
    }
}

// Recording
function startRecording() {
    if (isRecording || isPlaying) return;
    isRecording = true;
    recStartTime = Date.now();
    currentRec = [];
    
    recordBtn.classList.add('recording');
    recordIcon.innerText = 'stop_circle';
    
    // Haptic feedback on mobile
    triggerHaptic('medium');
    
    selectedRecIndex = -1;
    togglePlaybackUI(false);
}

function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    
    // Haptic feedback on mobile
    triggerHaptic('heavy');
    
    if (currentRec.length > 1) {
        // Save to raw
        rawRecordings.push(currentRec);
        
        // Apply current smoothing and save the value
        const smVal = parseInt(smoothingSlider.value, 10);
        recordingSmoothingValues.push(smVal);
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
        recordingSmoothingValues[selectedRecIndex] = val; // Save new value
        const smoothed = smoothRecording(rawRecordings[selectedRecIndex], val);
        recordings[selectedRecIndex] = smoothed;
        
        requestAnimationFrame(() => {
            drawSpace();
            drawPlot();
            if (settings.showVelocity) drawVelocity();
        });
    }
});

// Delete Logic
deleteRecBtn.addEventListener('click', () => {
    if (selectedRecIndex !== -1) {
        recordings.splice(selectedRecIndex, 1);
        rawRecordings.splice(selectedRecIndex, 1);
        recordingSmoothingValues.splice(selectedRecIndex, 1);
        
        selectedRecIndex = -1;
        togglePlaybackUI(false);
        
        requestAnimationFrame(() => {
            drawSpace();
            drawPlot();
            if (settings.showVelocity) drawVelocity();
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

// Plot Hover Events - calculate shared time for syncing
// Helper function to handle hover on plot canvas
function handlePlotHover(clientX) {
    const rect = plotCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const w = plotCanvas.width / window.devicePixelRatio;
    const padL = 40, padR = 20;
    const plotW = w - padL - padR;
    
    // Calculate max time from recordings
    let maxTime = 5;
    recordings.forEach(rec => {
        if (rec.length > 0 && rec[rec.length-1].t > maxTime) maxTime = rec[rec.length-1].t;
    });
    
    if (x >= padL && x <= w - padR) {
        hoverTime = ((x - padL) / plotW) * maxTime;
    } else {
        hoverTime = null;
    }
    isHoveringPlot = true;
    isHoveringVelocity = false;
}

// Helper function to handle hover on velocity canvas
function handleVelocityHover(clientX) {
    const rect = velocityCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const w = velocityCanvas.width / window.devicePixelRatio;
    const padL = 40, padR = 20;
    const plotW = w - padL - padR;
    
    // Calculate max time from recordings
    let maxTime = 5;
    recordings.forEach(rec => {
        if (rec.length > 0 && rec[rec.length-1].t > maxTime) maxTime = rec[rec.length-1].t;
    });
    
    if (x >= padL && x <= w - padR) {
        hoverTime = ((x - padL) / plotW) * maxTime;
    } else {
        hoverTime = null;
    }
    isHoveringPlot = false;
    isHoveringVelocity = true;
}

// Mouse events - plot canvas
plotCanvas.addEventListener('mousemove', (e) => handlePlotHover(e.clientX));
plotCanvas.addEventListener('mouseleave', () => {
    hoverTime = null;
    isHoveringPlot = false;
});

// Touch events - plot canvas
plotCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        handlePlotHover(e.touches[0].clientX);
    }
}, { passive: true });
plotCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        handlePlotHover(e.touches[0].clientX);
    }
}, { passive: true });
plotCanvas.addEventListener('touchend', () => {
    // Keep showing the last position for a moment on touch end
    setTimeout(() => {
        hoverTime = null;
        isHoveringPlot = false;
    }, 1500);
});

// Mouse events - velocity canvas
velocityCanvas.addEventListener('mousemove', (e) => handleVelocityHover(e.clientX));
velocityCanvas.addEventListener('mouseleave', () => {
    hoverTime = null;
    isHoveringVelocity = false;
});

// Touch events - velocity canvas
velocityCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        handleVelocityHover(e.touches[0].clientX);
    }
}, { passive: true });
velocityCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        handleVelocityHover(e.touches[0].clientX);
    }
}, { passive: true });
velocityCanvas.addEventListener('touchend', () => {
    // Keep showing the last position for a moment on touch end
    setTimeout(() => {
        hoverTime = null;
        isHoveringVelocity = false;
    }, 1500);
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
        
        // Update smoothing slider to show this recording's value
        const recSmoothing = recordingSmoothingValues[closestIdx] || 0;
        smoothingSlider.value = recSmoothing;
        smoothingValue.innerText = recSmoothing;
        
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
    if (settings.showVelocity) drawVelocity();
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
    
    // Dynamic padding - smaller for compact canvases
    const paddingH = Math.min(30, h * 0.15);
    const paddingW = Math.min(30, w * 0.1);
    
    spaceCtx.strokeStyle = COL_AXIS;
    spaceCtx.lineWidth = 2;
    spaceCtx.lineCap = 'round';
    spaceCtx.beginPath();
    
    let pStart, pEnd;
    if (isVertical) {
        pStart = {x: w/2, y: paddingH};
        pEnd = {x: w/2, y: h - paddingH};
    } else {
        pStart = {x: paddingW, y: h/2};
        pEnd = {x: w - paddingW, y: h/2};
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
    const allNotches = settings.showGrid ? 
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
    
    // Trace (Previous Recordings)
    if (settings.showTrace && selectedRecIndex !== -1) {
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

    // Real-time Trace (Current Recording)
    if (settings.showTrace && isRecording && currentRec.length > 0) {
        const maxT = currentRec[currentRec.length-1].t;
        
        // Sample points at regular intervals for consistent look
        // We can just iterate through currentRec since it's discrete points, 
        // but sampling by time is cleaner if frame rate varies.
        // For performance/simplicity in real-time, just iterating works well enough 
        // if we skip points closer than TRACE_INTERVAL_MS.
        
        let lastTraceTime = -1;
        
        currentRec.forEach(pt => {
             if (pt.t - lastTraceTime >= TRACE_INTERVAL_MS/1000) {
                const pos = valToSpace(pt.x);
                // Use a simpler fixed style for real-time or fade based on time relative to now?
                // Fading relative to now (newest = dark) matches the playback style
                
                const age = maxT - pt.t; // 0 = newest
                // Let's fade out over 5 seconds or just show all like playback? 
                // Playback shows full path. Let's show full path.
                
                // Construct progress for coloring
                // In playback: lightness = 75 - (progress * 75) => starts light, ends dark (newest)
                const progress = pt.t / Math.max(0.1, maxT);
                const lightness = 75 - (progress * 75);
                
                spaceCtx.fillStyle = `hsl(210, 10%, ${lightness}%)`; 
                spaceCtx.beginPath();
                spaceCtx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                spaceCtx.fill();
                
                lastTraceTime = pt.t;
             }
        });
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
    const ticksY = settings.showGrid ? 
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
        
        if (settings.showGrid) {
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
    
    // Hover line and coordinates (synced with velocity plot)
    if (hoverTime !== null && hoverTime >= 0 && hoverTime <= maxTime) {
        const hoverX = padL + (hoverTime / maxTime) * plotW;
        
        // Draw dashed vertical line
        plotCtx.strokeStyle = '#666';
        plotCtx.lineWidth = 1;
        plotCtx.setLineDash([4, 4]);
        plotCtx.beginPath();
        plotCtx.moveTo(hoverX, padT);
        plotCtx.lineTo(hoverX, h - padB);
        plotCtx.stroke();
        plotCtx.setLineDash([]);
        
        // Snap to selected recording and show enhanced info
        if (selectedRecIndex !== -1 && recordings[selectedRecIndex]) {
            const rec = recordings[selectedRecIndex];
            
            // Check if hoverTime is within the recording's time range
            const recMinTime = rec[0].t;
            const recMaxTime = rec[rec.length - 1].t;
            const isInTimeRange = hoverTime >= recMinTime && hoverTime <= recMaxTime;
            
            // Only get position value if in time range
            const posValue = isInTimeRange ? interpolateX(rec, hoverTime) : null;
            
            if (posValue !== null) {
                // Calculate Y position on the graph
                const posY = (h - padB) - ((posValue + 1) / 2) * plotH;
                
                // Draw highlighted point on the curve (only if in time range)
                plotCtx.beginPath();
                plotCtx.arc(hoverX, posY, 6, 0, Math.PI * 2);
                plotCtx.fillStyle = COL_ACCENT;
                plotCtx.fill();
                plotCtx.strokeStyle = '#fff';
                plotCtx.lineWidth = 2;
                plotCtx.stroke();
                
                // Calculate velocity/slope using central difference
                const velInterval = 5;
                let velocity = null;
                for (let i = velInterval; i < rec.length - velInterval; i++) {
                    if (rec[i].t >= hoverTime) {
                        const halfInt = Math.min(velInterval, i, rec.length - 1 - i);
                        if (halfInt >= 1) {
                            const dx = rec[i + halfInt].x - rec[i - halfInt].x;
                            const dt = rec[i + halfInt].t - rec[i - halfInt].t;
                            velocity = dt > 0 ? dx / dt : 0;
                        }
                        break;
                    }
                }
                
                // Draw tangent line if hovering this plot AND enabled
                if (settings.showTangents && isHoveringPlot && velocity !== null) {
                    const tangentLen = 50; // length in pixels on each side
                    // Slope in screen coordinates: dY/dX = (velocity * plotH / 2) / (plotW / maxTime)
                    const screenSlope = -(velocity * (plotH / 2)) / (plotW / maxTime);
                    const angle = Math.atan(screenSlope);
                    
                    plotCtx.beginPath();
                    plotCtx.strokeStyle = COL_ACCENT;
                    plotCtx.lineWidth = 2;
                    plotCtx.moveTo(hoverX - tangentLen * Math.cos(angle), posY - tangentLen * Math.sin(angle));
                    plotCtx.lineTo(hoverX + tangentLen * Math.cos(angle), posY + tangentLen * Math.sin(angle));
                    plotCtx.stroke();
                }
                
                // Draw coordinate label with slope (full info when in range)
                if (isHoveringPlot) {
                    let labelText;
                    if (settings.showTangents && velocity !== null) {
                        labelText = `t: ${hoverTime.toFixed(2)}s, x: ${posValue.toFixed(2)}, v: ${velocity.toFixed(2)}`;
                    } else {
                        labelText = `t: ${hoverTime.toFixed(2)}s, x: ${posValue.toFixed(2)}`;
                    }
                    
                    plotCtx.font = '11px Space Mono';
                    const textWidth = plotCtx.measureText(labelText).width;
                    const labelX = Math.min(hoverX + 15, w - padR - textWidth - 5);
                    const labelY = Math.max(posY - 15, padT + 15);
                    
                    // Background for readability
                    plotCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    plotCtx.fillRect(labelX - 4, labelY - 11, textWidth + 8, 16);
                    
                    plotCtx.fillStyle = '#333';
                    plotCtx.textAlign = 'left';
                    plotCtx.textBaseline = 'middle';
                    plotCtx.fillText(labelText, labelX, labelY);
                }
            } else if (isHoveringPlot) {
                // Graph selected but pointer NOT in time range - show only time
                const labelText = `t: ${hoverTime.toFixed(2)}s`;
                
                plotCtx.font = '11px Space Mono';
                const textWidth = plotCtx.measureText(labelText).width;
                const labelX = Math.min(hoverX + 8, w - padR - textWidth - 5);
                const labelY = padT + 15;
                
                plotCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                plotCtx.fillRect(labelX - 3, labelY - 11, textWidth + 6, 14);
                
                plotCtx.fillStyle = '#333';
                plotCtx.textAlign = 'left';
                plotCtx.textBaseline = 'middle';
                plotCtx.fillText(labelText, labelX, labelY);
            }
        } else if (isHoveringPlot) {
            // No recording selected, just show time
            const labelText = `t: ${hoverTime.toFixed(2)}s`;
            
            plotCtx.font = '11px Space Mono';
            const textWidth = plotCtx.measureText(labelText).width;
            const labelX = Math.min(hoverX + 8, w - padR - textWidth - 5);
            const labelY = padT + 15;
            
            plotCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            plotCtx.fillRect(labelX - 3, labelY - 11, textWidth + 6, 14);
            
            plotCtx.fillStyle = '#333';
            plotCtx.textAlign = 'left';
            plotCtx.textBaseline = 'middle';
            plotCtx.fillText(labelText, labelX, labelY);
        }
    }
    
    // Draw ball position on Y-axis if enabled
    if (showBallOnPlotCheckbox.checked) {
        const ballY = (h - padB) - ((ballPos + 1) / 2) * plotH;
        
        // Draw ball marker on Y-axis
        plotCtx.beginPath();
        plotCtx.arc(padL, ballY, 8, 0, Math.PI * 2);
        plotCtx.fillStyle = COL_ACCENT;
        plotCtx.fill();
        plotCtx.strokeStyle = '#fff';
        plotCtx.lineWidth = 2;
        plotCtx.stroke();
        
        // Draw horizontal guide line
        plotCtx.beginPath();
        plotCtx.strokeStyle = 'rgba(20, 132, 230, 0.3)';
        plotCtx.lineWidth = 1;
        plotCtx.setLineDash([3, 3]);
        plotCtx.moveTo(padL, ballY);
        plotCtx.lineTo(w - padR, ballY);
        plotCtx.stroke();
        plotCtx.setLineDash([]);
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

// Listen for orientation changes
window.matchMedia('(orientation: portrait)').addEventListener('change', () => {
    handleOrientationLayout();
});

// Initial layout setup
handleOrientationLayout();

loop();
