// === View Navigation ===
let currentView = 'stress';
let previousView = null;
let ipcCleanup = [];
let focusButtonInterval = null;

// === Window Presets ===
const WINDOW_PRESETS = {
  stress: { width: 700, height: 760 },
  subview: { width: 700, height: 760 },
  dashboard: { width: 760, height: 860 },
  focus: { width: 700, height: 760 },
  interventions: { width: 700, height: 760 },
  exercise: { width: 700, height: 760 },
  settings: { width: 700, height: 760 },
  'box-timers': { width: 700, height: 760 },
};

function applyWindowPreset(viewName) {
  const preset = WINDOW_PRESETS[viewName] || WINDOW_PRESETS.subview;
  window.electronAPI.resizeWindow(preset.width, preset.height);
}

function ensureDashboardWheelScroll() {
  const card = document.querySelector('#view-dashboard .glass-card');
  if (!card || card.dataset.wheelScrollBound === 'true') return;
  card.dataset.wheelScrollBound = 'true';
  card.addEventListener('wheel', (event) => {
    if (card.scrollHeight <= card.clientHeight) return;
    card.scrollTop += event.deltaY;
    event.preventDefault();
  }, { passive: false });
}

function showView(viewName) {
  if (currentView === 'focus' && viewName !== 'focus') {
    if (focusTimerInterval) {
      clearInterval(focusTimerInterval);
      focusTimerInterval = null;
    }
  }
  if (currentView === 'exercise' && viewName !== 'exercise') {
    resetExerciseState();
  }
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');
  currentView = viewName;
  if (viewName === 'dashboard') {
    loadDashboard();
  }
  if (viewName === 'settings') {
    loadSettings();
  }
  if (viewName === 'box-timers') {
    loadBoxTimers();
  }
  if (viewName === 'stress') {
    updateScale(0);
    updateLastStressComparison();
  }
  if (viewName === 'focus') {
    resumeFocusTimer();
  }
  previousView = viewName;
  applyWindowPreset(viewName);
  if (viewName === 'dashboard') ensureDashboardWheelScroll();
}

async function resumeFocusTimer() {
  const status = await window.electronAPI.getFocusStatus();
  if (status.active && status.remainingSeconds > 0) {
    document.getElementById('focus-timer').style.display = 'block';
    document.querySelectorAll('.duration-btn').forEach(b => b.style.display = 'none');
    initialFocusRemainingMs = undefined;
    startFocusTimerInterval(0);
    if (!focusButtonInterval) {
      focusButtonInterval = setInterval(updateFocusButton, 1000);
    }
    updateFocusButton();
  }
}

function updateFocusButton() {
  const btn = document.getElementById('btn-focus-mode');
  if (!btn) return;

  window.electronAPI.getFocusStatus().then((status) => {
    if (status.active && status.remainingSeconds > 0) {
      const min = Math.floor(status.remainingSeconds / 60);
      const sec = status.remainingSeconds % 60;
      btn.innerHTML = '<span class="focus-icon">◉</span> ' + min + ':' + sec.toString().padStart(2, '0') + ' verbleibend';
    } else {
      btn.innerHTML = '<span class="focus-icon">◉</span> Fokus-Modus starten';
    }
  }).catch((err) => {
    console.error('Focus button update failed:', err);
  });
}

function updateLastStressComparison() {
  const history = window._lastStressHistory || [];
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  const compEl = document.getElementById('stress-comparison');
  if (!compEl) return;
  if (!lastEntry) {
    compEl.style.display = 'none';
    return;
  }
  if (selectedStress === 0) {
    compEl.style.display = 'none';
    return;
  }
  compEl.style.display = 'flex';
  const diff = selectedStress - lastEntry.value;
  if (diff > 0) {
    compEl.innerHTML = '<span class="comparison-arrow">↑</span><span class="comparison-text">Letzte: ' + lastEntry.value + ' – niedriger als jetzt</span>';
    compEl.className = 'stress-comparison worse';
  } else if (diff < 0) {
    compEl.innerHTML = '<span class="comparison-arrow">↓</span><span class="comparison-text">Letzte: ' + lastEntry.value + ' – höher als jetzt</span>';
    compEl.className = 'stress-comparison better';
  } else {
    compEl.innerHTML = '<span class="comparison-arrow">＝</span><span class="comparison-text">Letzte: ' + lastEntry.value + ' – gleich wie jetzt</span>';
    compEl.className = 'stress-comparison same';
  }
}

ipcCleanup.push(window.electronAPI.onShowView((view) => {
  showView(view);
}));

ipcCleanup.push(window.electronAPI.onFocusEnd(() => {
    if (focusTimerInterval) clearInterval(focusTimerInterval);
    focusTimerInterval = null;
    window.electronAPI.endFocusMode();
    window.electronAPI.show();
    showView('stress');
  }));

ipcCleanup.push(window.electronAPI.onStressCheck(() => {
  window.audioEngine.playReminder();
  showView('stress');
}));

ipcCleanup.push(window.electronAPI.onTrayHelp(() => {
  showTrayHelpBanner();
}));

// === Tray Help Banner ===
function showTrayHelpBanner() {
  const banner = document.getElementById('tray-help-banner');
  if (banner) {
    banner.style.display = 'block';
    applyWindowPreset(currentView);
  }
}

function hideTrayHelpBanner() {
  const banner = document.getElementById('tray-help-banner');
  if (banner) {
    banner.style.display = 'none';
    applyWindowPreset(currentView);
  }
}

document.getElementById('btn-tray-help-dismiss').addEventListener('click', () => {
  hideTrayHelpBanner();
});

const closeModalOverlay = document.getElementById('close-modal-overlay');
const btnWindowClose = document.getElementById('btn-window-close');
const btnCloseToTray = document.getElementById('btn-close-to-tray');
const btnCloseAndQuit = document.getElementById('btn-close-and-quit');
const btnCloseCancel = document.getElementById('btn-close-cancel');
const closeModalRemember = document.getElementById('close-modal-remember');
const privacyModalOverlay = document.getElementById('privacy-modal-overlay');
const btnPrivacyAccept = document.getElementById('btn-privacy-accept');
const btnPrivacyDecline = document.getElementById('btn-privacy-decline');

function showPrivacyConsentModal() {
  if (privacyModalOverlay) privacyModalOverlay.style.display = 'flex';
}

function hidePrivacyConsentModal() {
  if (privacyModalOverlay) privacyModalOverlay.style.display = 'none';
}

if (btnPrivacyAccept) {
  btnPrivacyAccept.addEventListener('click', async () => {
    await window.electronAPI.updateSettings({
      privacyConsentAccepted: true,
      privacyConsentAt: Date.now(),
    });
    hidePrivacyConsentModal();
  });
}

if (btnPrivacyDecline) {
  btnPrivacyDecline.addEventListener('click', async () => {
    await window.electronAPI.quit();
  });
}

async function openCloseModal(trayState) {
  const resolvedTrayState = trayState || await window.electronAPI.getTrayState().catch(() => ({ isAvailable: false }));
  if (btnCloseToTray) {
    btnCloseToTray.style.display = resolvedTrayState && resolvedTrayState.isAvailable ? '' : 'none';
  }
  if (closeModalRemember) closeModalRemember.checked = false;
  if (closeModalOverlay) closeModalOverlay.style.display = 'flex';
}

function closeCloseModal() {
  if (closeModalOverlay) closeModalOverlay.style.display = 'none';
}

if (btnWindowClose) {
  btnWindowClose.addEventListener('click', async () => {
    const [settings, trayState] = await Promise.all([
      window.electronAPI.getSettings().catch(() => ({})),
      window.electronAPI.getTrayState().catch(() => ({ isAvailable: false })),
    ]);
    const closeAction = settings && typeof settings.closeAction === 'string' ? settings.closeAction : 'ask';
    if (closeAction === 'tray' && trayState.isAvailable) {
      window.electronAPI.hide();
      return;
    }
    if (closeAction === 'quit') {
      await window.electronAPI.quit();
      return;
    }
    openCloseModal(trayState);
  });
}

async function applyCloseAction(action) {
  if (closeModalRemember && closeModalRemember.checked) {
    await window.electronAPI.updateSettings({ closeAction: action });
  }
}

if (btnCloseToTray) {
  btnCloseToTray.addEventListener('click', async () => {
    await applyCloseAction('tray');
    window.electronAPI.hide();
    closeCloseModal();
  });
}

if (btnCloseAndQuit) {
  btnCloseAndQuit.addEventListener('click', async () => {
    await applyCloseAction('quit');
    closeCloseModal();
    await window.electronAPI.quit();
  });
}

if (btnCloseCancel) {
  btnCloseCancel.addEventListener('click', () => {
    closeCloseModal();
  });
}

if (closeModalOverlay) {
  closeModalOverlay.addEventListener('click', (event) => {
    if (event.target === closeModalOverlay) closeCloseModal();
  });
}

document.getElementById('btn-ambient-sound').addEventListener('click', () => {
  const cycle = [null, 'rain', 'forest'];
  const currentIndex = cycle.indexOf(ambientSoundType);
  const nextType = cycle[(currentIndex + 1) % cycle.length];
  const ambientSelect = document.getElementById('setting-ambient');

  if (nextType) {
    lastAmbientSoundType = nextType;
    window.audioEngine.playAmbient(nextType);
    ambientSoundType = nextType;
    if (ambientSelect) ambientSelect.value = nextType;
  } else {
    window.audioEngine.stopAmbient();
    ambientSoundType = null;
    if (ambientSelect) ambientSelect.value = 'none';
  }
  updateAmbientSoundUI();
});

let ambientSoundType = null;
let ambientVolume = 0.3;
let lastAmbientSoundType = 'rain';

function updateAmbientSoundUI() {
  const btn = document.getElementById('btn-ambient-sound');
  if (!btn) return;
  if (ambientSoundType) {
    const labels = { rain: 'Regen', forest: 'Wald' };
    const icons = { rain: '🌧️', forest: '🌲' };
    btn.textContent = icons[ambientSoundType] || '🔊';
    btn.title = 'Hintergrundgeräusch: ' + (labels[ambientSoundType] || 'Aktiv');
    btn.setAttribute('aria-label', btn.title);
    btn.classList.add('ambient-active');
  } else {
    btn.textContent = '🔇';
    btn.title = 'Hintergrundgeräusch: Stumm';
    btn.setAttribute('aria-label', btn.title);
    btn.classList.remove('ambient-active');
  }
}

// === Toast Notifications ===
function showSaveToast(text, cssClass) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-message toast-save ' + (cssClass || '');
  toast.textContent = '✓ Wert gespeichert! ' + text;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('toast-enter');
  });
  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 500);
  }, 2000);
}

function showExerciseCompleteToast() {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-message toast-success';
  toast.textContent = '🎉 Gut gemacht! Übung abgeschlossen.';
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('toast-enter');
  });
  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 500);
  }, 2000);
  setTimeout(() => {
    window.electronAPI.getAutoMinimize().then((autoMin) => {
      if (autoMin) {
        window.electronAPI.hide();
      }
      setTimeout(() => {
        window.audioEngine.playSuccess();
        btnCompleteExercise.textContent = 'Fertig';
        resetExerciseState();
        showView('stress');
        selectedStress = 0;
        updateScale(0);
        scaleThumb.style.left = '0%';
        scaleFill.style.width = '0%';
        stressNumber.textContent = '?';
        stressLabel.textContent = 'Wähle einen Wert';
      }, 500);
    });
  }, 2500);
}

// === Stress Scale ===
let selectedStress = 0;
const scaleThumb = document.getElementById('scale-thumb');
const scaleFill = document.getElementById('scale-fill');
const scaleTrack = document.getElementById('scale-track');
const stressNumber = document.getElementById('stress-number');
const stressLabel = document.getElementById('stress-label');
const stressRingProgress = document.getElementById('stress-ring-progress');
const ambientOrb = document.getElementById('ambient-orb');
const exercisePhaseChip = document.getElementById('exercise-phase-chip');
const exercisePhaseTime = document.getElementById('exercise-phase-time');

const stressLabels = {
  1: 'Sehr niedrig',
  2: 'Niedrig',
  3: 'Ruhig',
  4: 'Leicht gestresst',
  5: 'Mittel',
  6: 'Etwas hoch',
  7: 'Hoch',
  8: 'Sehr hoch',
  9: 'Extrem',
  10: 'Maximal',
};

const stressColors = {
  1: '#51cf66', 2: '#69db7c', 3: '#94d82d', 4: '#d4e45a',
  5: '#fcc419', 6: '#ffa94d', 7: '#ff922b', 8: '#ff6b6b',
  9: '#f06595', 10: '#e64980',
};

function updateStressVisualTheme(value) {
  const color = stressColors[value] || '#7b73ff';
  if (stressRingProgress) {
    const pct = value > 0 ? value / 10 : 0;
    const circumference = 326.72;
    stressRingProgress.style.strokeDashoffset = String(circumference * (1 - pct));
    stressRingProgress.style.stroke = color;
  }
  if (ambientOrb) {
    ambientOrb.style.background = `radial-gradient(circle, ${color}55 0%, ${color}20 36%, rgba(123,115,255,0) 72%)`;
  }
  stressNumber.classList.remove('emoji-pop');
  requestAnimationFrame(() => stressNumber.classList.add('emoji-pop'));
}

function updateScale(value) {
  if (value === 0) {
    selectedStress = 0;
    stressNumber.textContent = '?';
    stressNumber.style.color = '#fff';
    stressLabel.textContent = 'Wähle einen Wert';
    updateStressVisualTheme(0);
    scaleThumb.style.left = '0%';
    scaleFill.style.width = '0%';
    return;
  }
  selectedStress = value;
  const pct = ((value - 1) / 9) * 100;
  scaleThumb.style.left = pct + '%';
  scaleFill.style.width = pct + '%';
  stressNumber.textContent = value;
  stressNumber.style.color = stressColors[value] || '#fff';
  stressLabel.textContent = stressLabels[value] || '';
  updateStressVisualTheme(value);
}

let isDragging = false;

function handleScaleInput(clientX) {
  const rect = scaleTrack.getBoundingClientRect();
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const pct = x / rect.width;
  const value = Math.round(pct * 9) + 1;
  updateScale(value);
}

scaleThumb.addEventListener('mousedown', (e) => {
  isDragging = true;
  e.preventDefault();
});

scaleTrack.addEventListener('mousedown', (e) => {
  window.audioEngine.init();
  isDragging = true;
  handleScaleInput(e.clientX);
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) handleScaleInput(e.clientX);
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

scaleThumb.addEventListener('touchstart', (e) => {
  isDragging = true;
  e.preventDefault();
});

scaleTrack.addEventListener('touchstart', (e) => {
  isDragging = true;
  handleScaleInput(e.touches[0].clientX);
});

document.addEventListener('touchmove', (e) => {
  if (isDragging) handleScaleInput(e.touches[0].clientX);
});

document.addEventListener('touchend', () => {
  isDragging = false;
});

// === Submit Stress ===
document.getElementById('btn-submit-stress').addEventListener('click', async () => {
  if (selectedStress === 0) return;

  const btn = document.getElementById('btn-submit-stress');
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';

  window.electronAPI.submitStress(selectedStress).then(async (result) => {
    window.audioEngine.playGong();
    window._lastStressHistory = await window.electronAPI.getStressHistory();

    const history = window._lastStressHistory || [];
    const lastEntry = history.length > 0 ? history[history.length - 1] : null;
    let comparisonText = '';
    let comparisonClass = '';
    if (lastEntry) {
      const diff = selectedStress - lastEntry.value;
      if (diff > 0) {
        comparisonText = '↑ Höher als letzte: ' + lastEntry.value;
        comparisonClass = 'worse';
      } else if (diff < 0) {
        comparisonText = '↓ Niedriger als letzte: ' + lastEntry.value;
        comparisonClass = 'better';
      } else {
        comparisonText = '＝ Gleich wie letzte: ' + lastEntry.value;
        comparisonClass = 'same';
      }
    } else {
      comparisonText = 'Erster Wert gespeichert';
      comparisonClass = 'same';
    }
    showSaveToast(comparisonText, comparisonClass);

    return window.electronAPI.getFocusStatus().then((focusStatus) => {
      if (focusStatus && focusStatus.active) {
        showView('focus');
      } else if (selectedStress > 5) {
        showView('interventions');
      } else {
        showView('stress');
      }
    }).catch(() => {
      if (selectedStress > 5) {
        showView('interventions');
      } else {
        showView('stress');
      }
    });
  }).catch(() => {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  }).finally(() => {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  });
});

// === Focus Mode ===
document.getElementById('btn-focus-mode').addEventListener('click', () => {
  showView('focus');
  document.getElementById('focus-timer').style.display = 'none';
  document.querySelectorAll('.duration-btn').forEach(b => b.style.display = '');
});

let selectedFocusMinutes = 60;

document.querySelectorAll('.duration-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const minutes = parseInt(btn.dataset.minutes);
    selectedFocusMinutes = minutes;
    window.electronAPI.startFocusMode(minutes).then(() => {
      window.audioEngine.playSuccess();
      document.getElementById('focus-timer').style.display = 'block';
      const startingMs = Math.min(minutes, 480) * 60 * 1000;
      startFocusTimerInterval(startingMs);
      window.electronAPI.getAutoMinimize().then((autoMin) => {
        if (autoMin) {
          window.electronAPI.hide();
        }
      });
    });
  });
});

let focusTimerInterval = null;
let initialFocusRemainingMs = undefined;
let focusUpdatePromise = null;

function startFocusTimerInterval(startingMs) {
  if (focusTimerInterval) clearInterval(focusTimerInterval);
  if (startingMs) initialFocusRemainingMs = startingMs;
  focusTimerInterval = setInterval(updateFocusTimer, 1000);
  updateFocusTimer();
  if (!focusButtonInterval) {
    focusButtonInterval = setInterval(updateFocusButton, 1000);
  }
  updateFocusButton();
}

function updateFocusTimer() {
  focusUpdatePromise = window.electronAPI.getFocusStatus().then((status) => {
    if (!status.active || status.remainingSeconds <= 0) {
      if (focusTimerInterval) {
        clearInterval(focusTimerInterval);
        focusTimerInterval = null;
      }
      if (focusButtonInterval) {
        clearInterval(focusButtonInterval);
        focusButtonInterval = null;
      }
      updateFocusButton();
      const timerText = document.getElementById('timer-text');
      const timerProgress = document.getElementById('timer-progress');
      if (timerText) timerText.textContent = '00:00';
      if (timerProgress) timerProgress.style.strokeDashoffset = 565.48;
      window.audioEngine.playSuccess();
      window.electronAPI.show();
      showView('stress');
      return;
    }

    const timerText = document.getElementById('timer-text');
    const timerProgress = document.getElementById('timer-progress');
    const min = Math.floor(status.remainingSeconds / 60);
    const sec = status.remainingSeconds % 60;
    timerText.textContent = `${min}:${sec.toString().padStart(2, '0')}`;

    const totalMs = status.totalMs || (initialFocusRemainingMs ?? (selectedFocusMinutes * 60 * 1000));
    if (initialFocusRemainingMs === undefined) {
      initialFocusRemainingMs = totalMs;
    }
    const progress = Math.max(0, Math.min(status.remainingMs / totalMs, 1));
    const circumference = 565.48;
    timerProgress.style.strokeDashoffset = circumference * (1 - progress);

    const circleEl = document.getElementById('focus-timer-circle');
    if (circleEl) {
      circleEl.style.setProperty('--timer-color', 'var(--focus-color)');
    }
  }).catch((err) => {
    console.error('Focus timer status update failed:', err);
  });
}

document.getElementById('btn-end-focus').addEventListener('click', () => {
  if (focusTimerInterval) clearInterval(focusTimerInterval);
  window.electronAPI.endFocusMode();
  window.electronAPI.show();
  showView('stress');
});

document.getElementById('btn-back-focus').addEventListener('click', () => {
  showView('stress');
});

// === Exercise State ===
let currentExerciseType = null;
let exerciseCycleState = 0;
let boxBreathingTimeout = null;
let boxBreathingInterval = null;
let sighTimeout = null;
let sighInterval = null;
let currentExerciseControllers = {};
let groundingInputHandlers = [];
let groundingState = null;
let pmeStepsLocal = null;
let pmeTextLocal = null;
let pmeAutoCountdownInterval = null;
let pmeAutoAdvanceTimeout = null;
let pmeSecondsRemaining = 5;
let customBoxTimers = { inhale: 4, hold: 4, exhale: 4, holdEmpty: 4 };
let btnCompleteExercise = null;
let exerciseStartTime = null;

function setExercisePhaseMeta(label, timeText) {
  if (exercisePhaseChip) exercisePhaseChip.textContent = label || 'Bereit';
  if (exercisePhaseTime) exercisePhaseTime.textContent = timeText || '--';
}

function resetExerciseState() {
  if (btnCompleteExercise) btnCompleteExercise.textContent = 'Fertig';

  if (currentExerciseType && currentExerciseControllers[currentExerciseType] && typeof currentExerciseControllers[currentExerciseType].stop === 'function') {
    currentExerciseControllers[currentExerciseType].stop();
    delete currentExerciseControllers[currentExerciseType];
  }

  if (boxBreathingTimeout) { clearTimeout(boxBreathingTimeout); boxBreathingTimeout = null; }
  if (boxBreathingInterval) { clearInterval(boxBreathingInterval); boxBreathingInterval = null; }
  if (sighTimeout) { clearTimeout(sighTimeout); sighTimeout = null; }
  if (sighInterval) { clearInterval(sighInterval); sighInterval = null; }
  if (pmeAutoCountdownInterval) { clearInterval(pmeAutoCountdownInterval); pmeAutoCountdownInterval = null; }
  if (pmeAutoAdvanceTimeout) { clearTimeout(pmeAutoAdvanceTimeout); pmeAutoAdvanceTimeout = null; }
  pmeSecondsRemaining = 5;

  const groundingInputs = [
    document.getElementById('grounding-input-1'),
    document.getElementById('grounding-input-2'),
    document.getElementById('grounding-input-3'),
    document.getElementById('grounding-input-4'),
    document.getElementById('grounding-input-5'),
  ];
  groundingInputs.forEach((input, i) => {
    if (input && groundingInputHandlers[i]) {
      input.removeEventListener('input', groundingInputHandlers[i]);
      groundingInputHandlers[i] = null;
    }
  });

  currentExerciseType = null;
  exerciseCycleState = 0;
  exerciseStartTime = null;
  pmeStepsLocal = null;
  pmeTextLocal = null;
  groundingState = null;
  setExercisePhaseMeta('Bereit', '--');

  clearAmbientParticles();
}

let ambientParticleInterval = null;

function clearAmbientParticles() {
  if (ambientParticleInterval) { clearInterval(ambientParticleInterval); ambientParticleInterval = null; }
  const container = document.getElementById('exercise-container');
  if (container) {
    container.querySelectorAll('.breathing-particle').forEach(p => p.remove());
  }
}

function startAmbientParticles() {
  clearAmbientParticles();
  const container = document.getElementById('exercise-container');
  if (!container) return;

  function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'breathing-particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.bottom = '0';
    particle.style.animationDuration = (4 + Math.random() * 4) + 's';
    particle.style.animationDelay = Math.random() * 2 + 's';
    particle.style.width = (3 + Math.random() * 4) + 'px';
    particle.style.height = particle.style.width;
    container.appendChild(particle);
    setTimeout(() => { if (particle.parentNode) particle.remove(); }, 8000);
  }

  for (let i = 0; i < 8; i++) {
    setTimeout(createParticle, i * 300);
  }
  ambientParticleInterval = setInterval(createParticle, 800);
}

// === Interventions ===
btnCompleteExercise = document.getElementById('btn-complete-exercise');

document.querySelectorAll('.intervention-card').forEach((card) => {
  card.addEventListener('click', () => {
    const type = card.dataset.type;
    startExercise(type);
  });
});

// === Random Spinner ===
document.getElementById('btn-random-intervention').addEventListener('click', () => {
  const cards = Array.from(document.querySelectorAll('.intervention-card'));
  const types = ['physiological-sigh', 'box-breathing', '5-4-3-2-1', 'pme'];
  let spins = 0;
  const totalSpins = 15 + Math.floor(Math.random() * 8);
  let speed = 80;

  cards.forEach(c => c.classList.remove('spinner-active', 'spinner-selected'));

  function spin() {
    cards.forEach(c => c.classList.remove('spinner-active'));

    const idx = spins % types.length;
    cards[idx].classList.add('spinner-active');
    spins++;

    if (spins > totalSpins) {
      cards.forEach(c => c.classList.remove('spinner-active'));
      cards[idx].classList.add('spinner-selected');
      setTimeout(() => {
        cards.forEach(c => c.classList.remove('spinner-selected'));
        startExercise(types[idx]);
      }, 600);
      return;
    }

    if (spins > totalSpins - 5) {
      speed += 60;
    } else if (spins > totalSpins - 10) {
      speed += 30;
    }

    setTimeout(spin, speed);
  }

  spin();
});

// === Custom Timers Button ===
document.getElementById('btn-custom-timers').addEventListener('click', () => {
  showView('box-timers');
});

function startExercise(type) {
  resetExerciseState();
  document.querySelectorAll('.exercise-content').forEach((c) => c.style.display = 'none');

  const exerciseData = {
    'physiological-sigh': {
      id: 'exercise-sigh',
      title: 'Physiologischer Seufzer',
      desc: '2x einatmen durch die Nase, dann 6s ausatmen durch den Mund',
    },
    'box-breathing': {
      id: 'exercise-box',
      title: 'Box-Breathing',
      desc: `${customBoxTimers.inhale}-${customBoxTimers.hold}-${customBoxTimers.exhale}-${customBoxTimers.holdEmpty} Atemtechnik`,
    },
    '5-4-3-2-1': {
      id: 'exercise-grounding',
      title: '5-4-3-2-1 Grounding',
      desc: 'Sinneswahrnehmungen bewusst machen',
    },
    'pme': {
      id: 'exercise-pme',
      title: 'Progressive Muskelentspannung',
      desc: 'Muskeln nacheinander an- und entspannen',
    },
  };

  const data = exerciseData[type];
  if (!data) return;

  document.getElementById('exercise-title').textContent = data.title;
  document.getElementById('exercise-desc').textContent = data.desc;
  document.getElementById(data.id).style.display = 'flex';
  setExercisePhaseMeta('Start', '--');

  if (type === 'box-breathing') {
    currentExerciseType = 'box-breathing';
    const controller = startBoxBreathing();
    currentExerciseControllers['box-breathing'] = controller;
    startAmbientParticles();
  } else if (type === 'physiological-sigh') {
    currentExerciseType = 'physiological-sigh';
    startSighExercise();
    startAmbientParticles();
  } else if (type === '5-4-3-2-1') {
    currentExerciseType = '5-4-3-2-1';
    groundingState = { currentStep: 0, stepFilledCount: 0 };
    startGrounding();
    startAmbientParticles();
  } else if (type === 'pme') {
    currentExerciseType = 'pme';
    exerciseCycleState = 0;
    window.electronAPI.getInterventionByType('pme').then((pmeData) => {
      if (!pmeData) return;
      pmeStepsLocal = pmeData.steps.map((step) => ({
        text: step.text,
        zone: 'pme',
      }));
      btnCompleteExercise.textContent = 'Weiter';
      pmeTextLocal = document.getElementById('pme-step-text');
      const progress = document.getElementById('pme-progress');
      progress.innerHTML = '';
      pmeStepsLocal.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'pme-progress-dot';
        dot.dataset.index = i;
        progress.appendChild(dot);
      });
      updatePmeDisplay();
      startPmeAutoTimer();
      startAmbientParticles();
    });
  }

  showView('exercise');
  exerciseStartTime = Date.now();
}

// === Complete Exercise ===
document.getElementById('btn-complete-exercise').addEventListener('click', () => {
  if (currentExerciseType === '5-4-3-2-1') {
    const duration = Math.max(1, Math.round((Date.now() - exerciseStartTime) / 60000));
    window.electronAPI.completeIntervention('5-4-3-2-1', duration);
    window.audioEngine.playSuccess();
    btnCompleteExercise.textContent = 'Fertig';
    resetExerciseState();
    showExerciseCompleteToast();
    return;
  }

  if (currentExerciseType === 'box-breathing') {
    const duration = Math.max(1, Math.round((Date.now() - exerciseStartTime) / 60000));
    window.electronAPI.completeIntervention('box-breathing', duration);
    window.audioEngine.playSuccess();
    btnCompleteExercise.textContent = 'Fertig';
    resetExerciseState();
    showExerciseCompleteToast();
    return;
  }

  if (currentExerciseType === 'physiological-sigh') {
    const duration = Math.max(1, Math.round((Date.now() - exerciseStartTime) / 60000));
    window.electronAPI.completeIntervention('physiological-sigh', duration);
    window.audioEngine.playSuccess();
    btnCompleteExercise.textContent = 'Fertig';
    resetExerciseState();
    showExerciseCompleteToast();
    return;
  }

  if (currentExerciseType === 'pme') {
    completePmeExercise();
    return;
  }
});

function completePmeExercise() {
  const duration = Math.max(1, Math.round((Date.now() - exerciseStartTime) / 60000));
  window.electronAPI.completeIntervention('pme', duration);
  window.audioEngine.playSuccess();
  btnCompleteExercise.textContent = 'Fertig';
  resetExerciseState();
  showExerciseCompleteToast();
}

function updatePmeButtonCountdown() {
  if (!btnCompleteExercise) return;
  btnCompleteExercise.textContent = `Nächster Schritt in ${pmeSecondsRemaining}s`;
}

function startPmeAutoTimer() {
  if (!pmeStepsLocal || !pmeStepsLocal.length) return;
  if (pmeAutoCountdownInterval) clearInterval(pmeAutoCountdownInterval);
  if (pmeAutoAdvanceTimeout) clearTimeout(pmeAutoAdvanceTimeout);

  pmeSecondsRemaining = 5;
  setExercisePhaseMeta('PME Schritt', `${pmeSecondsRemaining}s`);
  updatePmeButtonCountdown();

  pmeAutoCountdownInterval = setInterval(() => {
    pmeSecondsRemaining--;
    if (pmeSecondsRemaining < 0) pmeSecondsRemaining = 0;
    setExercisePhaseMeta('PME Schritt', `${pmeSecondsRemaining}s`);
    updatePmeButtonCountdown();
    if (pmeSecondsRemaining > 0) {
      window.audioEngine.playTimerTick();
    }
  }, 1000);

  pmeAutoAdvanceTimeout = setTimeout(() => {
    if (pmeAutoCountdownInterval) {
      clearInterval(pmeAutoCountdownInterval);
      pmeAutoCountdownInterval = null;
    }
    if (!pmeStepsLocal) return;
    if (exerciseCycleState >= pmeStepsLocal.length - 1) {
      completePmeExercise();
      return;
    }
    exerciseCycleState++;
    updatePmeDisplay();
    startPmeAutoTimer();
  }, 5000);
}

function updatePmeDisplay() {
  if (!pmeStepsLocal) return;
  const step = pmeStepsLocal[exerciseCycleState];
  pmeTextLocal.textContent = step.text;
  document.querySelectorAll('.pme-progress-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i <= exerciseCycleState);
  });
}

// === Box Breathing - Improved ===
function startBoxBreathing() {
  const ring = document.getElementById('box-ring');
  const label = document.getElementById('breathing-label');
  const timerEl = document.getElementById('breathing-timer');
  const dots = document.querySelectorAll('.phase-dot');

  const phases = [
    { cls: 'phase-inhale', text: 'Einatmen', dur: customBoxTimers.inhale * 1000 },
    { cls: 'phase-hold', text: 'Halten', dur: customBoxTimers.hold * 1000 },
    { cls: 'phase-exhale', text: 'Ausatmen', dur: customBoxTimers.exhale * 1000 },
    { cls: 'phase-hold-empty', text: 'Warten', dur: customBoxTimers.holdEmpty * 1000 },
  ];

  let phaseIdx = 0;
  let active = true;
  let countdown = phases[0].dur / 1000;
  let hasStarted = false;

  function updateDots() {
    dots.forEach((dot, i) => {
      dot.classList.remove('active', 'completed');
      if (i === phaseIdx) dot.classList.add('active');
      else if (i < phaseIdx) dot.classList.add('completed');
    });
  }

  function runPhase() {
    if (!active) return;
    if (phaseIdx >= phases.length) phaseIdx = 0;
    const phase = phases[phaseIdx];
    countdown = phase.dur / 1000;

    // Make inhale/exhale size transitions follow the full phase duration
    // so the ring grows/shrinks continuously instead of snapping quickly.
    ring.style.transition = [
      `transform ${phase.dur}ms linear`,
      'border-radius 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      'box-shadow 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      'background 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      'border-color 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
    ].join(', ');

    if (!hasStarted) {
      ring.className = 'box-ring';
      // Force initial style application so first inhale transition animates.
      ring.getBoundingClientRect();
      requestAnimationFrame(() => {
        if (!active) return;
        ring.className = 'box-ring ' + phase.cls;
      });
      hasStarted = true;
    } else {
      ring.className = 'box-ring ' + phase.cls;
    }
    label.textContent = phase.text;
    timerEl.textContent = countdown;
    setExercisePhaseMeta(phase.text, `${countdown}s`);
    updateDots();

    boxBreathingInterval = setInterval(() => {
      countdown--;
      if (countdown < 0) countdown = 0;
      timerEl.textContent = countdown;
      setExercisePhaseMeta(phase.text, `${countdown}s`);
      if (countdown > 0) {
        window.audioEngine.playTimerTick();
      }
    }, 1000);

    boxBreathingTimeout = setTimeout(() => {
      if (boxBreathingInterval) { clearInterval(boxBreathingInterval); boxBreathingInterval = null; }
      phaseIdx++;
      runPhase();
    }, phase.dur);
  }

  runPhase();

  return {
    stop: () => {
      active = false;
      if (boxBreathingTimeout) { clearTimeout(boxBreathingTimeout); boxBreathingTimeout = null; }
      if (boxBreathingInterval) { clearInterval(boxBreathingInterval); boxBreathingInterval = null; }
    }
  };
}

// === Physiological Sigh - Continuous Loop ===
function startSighExercise() {
  const lung = document.getElementById('sigh-lung');
  const text = document.getElementById('sigh-text');
  const timer = document.getElementById('sigh-timer');
  const dots = document.querySelectorAll('.sigh-dot');
  const particles = document.querySelectorAll('.air-particle');

  exerciseCycleState = 0;
  btnCompleteExercise.textContent = 'Beenden';
  const steps = [
    { text: 'Tief einatmen...', phase: 'inhale-1', dur: 2000, particleClass: 'animate-in' },
    { text: 'Noch kurz nachatmen!', phase: 'inhale-2', dur: 2000, particleClass: 'animate-in' },
    { text: 'Langsam ausatmen...', phase: 'exhale', dur: 6000, particleClass: 'animate-out' },
  ];

  function updateSighDots() {
    dots.forEach((dot, i) => {
      dot.classList.remove('active', 'completed');
      if (i === exerciseCycleState) dot.classList.add('active');
      else if (i < exerciseCycleState) dot.classList.add('completed');
    });
  }

  function animateParticles(cls) {
    particles.forEach(p => {
      p.className = 'air-particle';
    });
    if (cls) {
      requestAnimationFrame(() => {
        particles.forEach(p => {
          p.classList.add(cls);
        });
      });
    }
  }

  function runSighStep() {
    const step = steps[exerciseCycleState];
    text.textContent = step.text;
    lung.className = 'sigh-lung ' + step.phase;
    animateParticles(step.particleClass);
    updateSighDots();
    btnCompleteExercise.textContent = 'Beenden';

    let remaining = step.dur / 1000;
    timer.textContent = remaining;
    setExercisePhaseMeta(step.text.replace('...', ''), `${remaining}s`);

    sighInterval = setInterval(() => {
      remaining--;
      if (remaining < 0) remaining = 0;
      timer.textContent = remaining;
      setExercisePhaseMeta(step.text.replace('...', ''), `${remaining}s`);
      if (remaining > 0) {
        window.audioEngine.playTimerTick();
      }
    }, 1000);

    sighTimeout = setTimeout(() => {
      if (sighInterval) { clearInterval(sighInterval); sighInterval = null; }
      exerciseCycleState++;
      if (exerciseCycleState >= steps.length) exerciseCycleState = 0;
      runSighStep();
    }, step.dur);
  }

  runSighStep();
}

// === 5-4-3-2-1 Grounding ===
function startGrounding() {
  const groundingText = document.getElementById('grounding-text');
  const groundingCounter = document.getElementById('grounding-counter');
  const inputs = [
    document.getElementById('grounding-input-1'),
    document.getElementById('grounding-input-2'),
    document.getElementById('grounding-input-3'),
    document.getElementById('grounding-input-4'),
    document.getElementById('grounding-input-5'),
  ];

  const steps = [
    { text: 'Nenne 5 Dinge, die du SEHEN kannst', count: 5 },
    { text: 'Nenne 4 Dinge, die du FÜHLEN kannst', count: 4 },
    { text: 'Nenne 3 Dinge, die du HÖREN kannst', count: 3 },
    { text: 'Nenne 2 Dinge, die du RIECHEN kannst', count: 2 },
    { text: 'Nenne 1 Sache, die du SCHMECKEN kannst', count: 1 },
  ];

  inputs.forEach((input) => {
    if (input) input.value = '';
  });

  function updateGroundingInputVisibility(activeCount) {
    inputs.forEach((input, index) => {
      if (!input) return;
      const isVisible = index < activeCount;
      input.style.display = isVisible ? '' : 'none';
      if (!isVisible) input.value = '';
    });
  }

  const handleGroundingInput = () => {
    if (!groundingState) return;
    const currentStep = steps[groundingState.currentStep];
    const currentStepCount = currentStep.count;
    const stepInputs = inputs.slice(0, currentStepCount);
    groundingState.stepFilledCount = stepInputs.filter((i) => i && i.value.trim()).length;
    groundingCounter.textContent = `${groundingState.stepFilledCount} / ${currentStepCount}`;

    if (groundingState.stepFilledCount >= currentStepCount) {
      groundingState.stepFilledCount = 0;
      inputs.forEach((i) => { if (i) i.value = ''; });
      groundingState.currentStep++;
      if (groundingState.currentStep >= steps.length) {
        groundingState.currentStep = steps.length;
        groundingText.textContent = 'Fertig! Sehr gut gemacht.';
        groundingCounter.textContent = 'Alle Schritte abgeschlossen';
        btnCompleteExercise.textContent = 'Fertig';
        updateGroundingInputVisibility(0);
        updateGrounding();
        return;
      }
      updateGrounding();
      return;
    }
  };

  inputs.forEach((input, i) => {
    if (input) {
      groundingInputHandlers[i] = handleGroundingInput;
      input.addEventListener('input', handleGroundingInput);
    }
  });

  function updateGrounding() {
    if (!groundingState) return;
    const dots = document.querySelectorAll('#grounding-step-dots .grounding-step-dot');
    if (groundingState.currentStep >= steps.length) {
      groundingText.textContent = 'Fertig! Sehr gut gemacht.';
      groundingCounter.textContent = 'Alle Schritte abgeschlossen';
      setExercisePhaseMeta('Grounding', 'Fertig');
      updateGroundingInputVisibility(0);
      dots.forEach(d => { d.classList.add('completed'); d.classList.remove('active'); });
    } else {
      const step = steps[groundingState.currentStep];
      groundingText.textContent = step.text;
      groundingCounter.textContent = `0 / ${step.count}`;
      setExercisePhaseMeta('Grounding', `${step.count} Punkte`);
      updateGroundingInputVisibility(step.count);
      dots.forEach((d, i) => {
        d.classList.remove('active', 'completed');
        if (i < groundingState.currentStep) d.classList.add('completed');
        if (i === groundingState.currentStep) d.classList.add('active');
      });
    }
  }

  updateGrounding();
}

// === Dashboard ===
document.getElementById('btn-back-to-stress').addEventListener('click', () => {
  showView('stress');
});

document.getElementById('btn-clear-history').addEventListener('click', async () => {
  if (confirm('Möchtest du wirklich deinen gesamten Verlauf löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
    await window.electronAPI.clearHistory();
    loadDashboard();
  }
});

document.getElementById('btn-export-html').addEventListener('click', async () => {
  const result = await window.electronAPI.exportHtml();
  if (result && !result.cancelled) {
    window.audioEngine.playSuccess();
  }
});

document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const result = await window.electronAPI.exportCsv();
  if (result && !result.cancelled) {
    window.audioEngine.playSuccess();
  }
});

async function loadDashboard() {
  const stats = await window.electronAPI.getStats();

  document.getElementById('stat-avg-stress').textContent = stats.last7Days > 0 ? stats.avgStress : '--';
  document.getElementById('stat-interventions').textContent = stats.interventionsThisWeek || 0;
  document.getElementById('stat-focus-min').textContent = (stats.focusMinutesThisWeek || 0) + ' Min';
  document.getElementById('stat-consecutive').textContent = stats.consecutiveDays || 0;
  document.getElementById('stat-total-checks').textContent = stats.totalChecks || 0;
  document.getElementById('stat-total-interventions').textContent = stats.totalInterventions || 0;
  document.getElementById('stat-total-focus').textContent = (stats.totalFocusMinutes || 0) + ' Min';

  const chartBars = document.getElementById('chart-bars');
  chartBars.innerHTML = '';

  if ((stats.last7Days || 0) > 0 && stats.weeklyData && stats.weeklyData.length > 0) {
    const maxAvg = Math.max(...stats.weeklyData.map((d) => d.avg), 1);
    stats.weeklyData.forEach((day) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'chart-bar-wrapper';

      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      const heightPct = (day.avg / maxAvg) * 80;
      bar.style.height = Math.max(heightPct, 2) + '%';

      const color = day.avg <= 3 ? 'var(--low-color)' : day.avg <= 6 ? 'var(--medium-color)' : 'var(--high-color)';
      bar.style.background = color;

      const label = document.createElement('span');
      label.className = 'chart-bar-label';
      label.textContent = day.date;

      wrapper.appendChild(bar);
      wrapper.appendChild(label);
      chartBars.appendChild(wrapper);
    });
  } else {
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const wrapper = document.createElement('div');
      wrapper.className = 'chart-bar-wrapper';
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      bar.style.height = '2%';
      bar.style.opacity = '0.2';
      const label = document.createElement('span');
      label.className = 'chart-bar-label';
      label.textContent = date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
      wrapper.appendChild(bar);
      wrapper.appendChild(label);
      chartBars.appendChild(wrapper);
    }
  }

  const total = (stats.levelCounts?.low || 0) + (stats.levelCounts?.medium || 0) + (stats.levelCounts?.high || 0);
  const lowPct = total ? ((stats.levelCounts.low / total) * 100) : 0;
  const medPct = total ? ((stats.levelCounts.medium / total) * 100) : 0;
  const highPct = total ? ((stats.levelCounts.high / total) * 100) : 0;

  document.getElementById('bar-low').style.width = lowPct + '%';
  document.getElementById('bar-medium').style.width = medPct + '%';
  document.getElementById('bar-high').style.width = highPct + '%';
  document.getElementById('bar-low-count').textContent = stats.levelCounts?.low || 0;
  document.getElementById('bar-medium-count').textContent = stats.levelCounts?.medium || 0;
  document.getElementById('bar-high-count').textContent = stats.levelCounts?.high || 0;
  applyWindowPreset('dashboard');
}

// === Quick Navigation ===
document.getElementById('btn-open-dashboard').addEventListener('click', () => {
  showView('dashboard');
});

document.getElementById('btn-open-settings').addEventListener('click', () => {
  showView('settings');
});

// === Settings ===
document.getElementById('btn-save-settings').addEventListener('click', () => {
  const interval = parseInt(document.getElementById('setting-interval').value);
  const sound = document.getElementById('setting-sound').checked;
  const ambientSound = ambientSoundType;
  const ambientVolumeVal = ambientVolume;

  window.electronAPI.updateSettings({ intervalMinutes: interval, soundEnabled: sound, ambientSound, ambientVolume: ambientVolumeVal }).then(() => {
    window.audioEngine.setEnabled(sound);
    window.audioEngine.setAmbientVolume(ambientVolumeVal);
    showView('stress');
  });
});

document.getElementById('setting-ambient').addEventListener('change', (e) => {
  const type = e.target.value === 'none' ? null : e.target.value;
  if (type) {
    lastAmbientSoundType = type;
    window.audioEngine.playAmbient(type);
  } else {
    window.audioEngine.stopAmbient();
  }
  ambientSoundType = type;
  updateAmbientSoundUI();
});

document.getElementById('setting-ambient-volume').addEventListener('input', (e) => {
  ambientVolume = parseInt(e.target.value) / 100;
  window.audioEngine.setAmbientVolume(ambientVolume);
});

document.getElementById('btn-back-from-settings').addEventListener('click', () => {
  showView('stress');
});

async function loadSettings() {
  const settings = await window.electronAPI.getSettings();
  applySettingsToUI(settings, true);
}

function applySettingsToUI(settings, applyPreset) {
  if (settings.intervalMinutes) {
    document.getElementById('setting-interval').value = settings.intervalMinutes;
  }
  if (settings.soundEnabled === false) {
    document.getElementById('setting-sound').checked = false;
    window.audioEngine.setEnabled(false);
  } else {
    document.getElementById('setting-sound').checked = true;
    window.audioEngine.setEnabled(true);
  }

  ambientVolume = settings.ambientVolume !== undefined ? settings.ambientVolume : 0.3;
  ambientSoundType = settings.ambientSound || null;
  if (ambientSoundType) lastAmbientSoundType = ambientSoundType;
  const ambientSelect = document.getElementById('setting-ambient');
  if (ambientSelect) ambientSelect.value = ambientSoundType || 'none';
  const ambientVolumeSlider = document.getElementById('setting-ambient-volume');
  if (ambientVolumeSlider) ambientVolumeSlider.value = Math.round(ambientVolume * 100);
  if (applyPreset) applyWindowPreset('settings');
}

// === Custom Box Timers ===
document.getElementById('btn-save-box-timers').addEventListener('click', async () => {
  const inhale = clamp(parseInt(document.getElementById('timer-inhale').value) || 4, 1, 20);
  const hold = clamp(parseInt(document.getElementById('timer-hold').value) || 4, 1, 20);
  const exhale = clamp(parseInt(document.getElementById('timer-exhale').value) || 4, 1, 20);
  const holdEmpty = clamp(parseInt(document.getElementById('timer-hold-empty').value) || 4, 1, 20);

  customBoxTimers = { inhale, hold, exhale, holdEmpty };
  await window.electronAPI.saveBoxTimers(customBoxTimers);
  window.audioEngine.playSuccess();
  showView('interventions');
});

document.getElementById('btn-back-from-box-timers').addEventListener('click', () => {
  showView('interventions');
});

async function loadBoxTimers() {
  const timers = await window.electronAPI.getBoxTimers();
  customBoxTimers = timers && typeof timers === 'object' ? timers : { inhale: 4, hold: 4, exhale: 4, holdEmpty: 4 };
  document.getElementById('timer-inhale').value = customBoxTimers.inhale;
  document.getElementById('timer-hold').value = customBoxTimers.hold;
  document.getElementById('timer-exhale').value = customBoxTimers.exhale;
  document.getElementById('timer-hold-empty').value = customBoxTimers.holdEmpty;
  applyWindowPreset('box-timers');
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// === Init ===
(async () => {
  const timersPromise = window.electronAPI.getBoxTimers();
  const settingsPromise = window.electronAPI.getSettings();
  const statusPromise = window.electronAPI.getFocusStatus();
  const stressHistoryPromise = window.electronAPI.getStressHistory();

  const [timers, settings, status] = await Promise.all([timersPromise, settingsPromise, statusPromise]);
  customBoxTimers = timers && typeof timers === 'object' ? timers : { inhale: 4, hold: 4, exhale: 4, holdEmpty: 4 };
  applySettingsToUI(settings || {}, false);
  if (!settings || settings.privacyConsentAccepted !== true) {
    showPrivacyConsentModal();
  }

  updateAmbientSoundUI();
  ensureDashboardWheelScroll();
  applyWindowPreset('stress');

  if (status.active) {
    showView('focus');
    document.getElementById('focus-timer').style.display = 'block';
    document.querySelectorAll('.duration-btn').forEach(b => b.style.display = 'none');
    startFocusTimerInterval(0);
    if (!focusButtonInterval) {
      focusButtonInterval = setInterval(updateFocusButton, 1000);
    }
    updateFocusButton();
  }

  stressHistoryPromise.then((history) => {
    window._lastStressHistory = history;
  }).catch(() => {
    window._lastStressHistory = [];
  });

  if (ambientSoundType) {
    window.audioEngine.playAmbient(ambientSoundType);
    window.audioEngine.setAmbientVolume(ambientVolume);
  }
})();
