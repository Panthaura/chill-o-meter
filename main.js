const { app, ipcMain, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { createTray, init: initTray, showTrayHelpIfNeeded, getTrayState, isTrayReady } = require('./main/tray');
const { showStressNotification, showFocusEndNotification } = require('./main/notifications');
const { StressScheduler, setupIpc: setupStressIpc } = require('./modules/stress-scheduler');
const { setupIpc: setupInterventionIpc } = require('./modules/interventions');
const { setupIpc: setupDashboardIpc } = require('./modules/dashboard');
const storage = require('./modules/storage');

let mainWindow = null;
let stressScheduler = null;
let isQuitting = false;

// Fix GL vsync errors by disabling GPU compositing
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-vsync');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 760,
    minWidth: 520,
    minHeight: 520,
    maxHeight: 900,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    resizable: true,
    transparent: false,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  mainWindow.on('close', (e) => {
    if (mainWindow && !isQuitting && isTrayReady()) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function hideWindow() {
  if (mainWindow) {
    mainWindow.hide();
  }
}

app.whenReady().then(() => {
  createWindow();
  initTray(mainWindow, showWindow, hideWindow);
  createTray();
  showTrayHelpIfNeeded();

  stressScheduler = new StressScheduler();
  stressScheduler.start();
  stressScheduler.on('check', () => {
    const focusStatus = stressScheduler._focusStatus || { active: false };
    if (!focusStatus.active) {
      showStressNotification();
      showWindow();
    }
  });

  setupStressIpc(stressScheduler);
  setupInterventionIpc();
  setupDashboardIpc();

  ipcMain.handle('app:show', () => showWindow());
  ipcMain.handle('app:hide', () => hideWindow());
  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
    return { success: true };
  });
  ipcMain.handle('app:toggle', () => {
    if (mainWindow && mainWindow.isVisible()) {
      hideWindow();
    } else {
      showWindow();
    }
  });

  ipcMain.handle('tray:get-state', () => getTrayState());
  ipcMain.handle('tray:show-help', () => showTrayHelpIfNeeded());

  // Clear all history
  ipcMain.handle('history:clear', () => {
    storage.set('stressHistory', []);
    storage.set('interventionHistory', []);
    storage.set('focusSessions', []);
    storage.set('achievements', {
      totalChecks: 0,
      totalInterventions: 0,
      totalFocusMinutes: 0,
      consecutiveDays: 0,
      lastActiveDate: null,
    });
    return { success: true };
  });

  // Custom box breathing timers
  ipcMain.handle('box-timers:get', () => {
    try {
      const timers = storage.get('boxBreathingTimers');
      return timers || { inhale: 4, hold: 4, exhale: 4, holdEmpty: 4 };
    } catch (e) {
      return { inhale: 4, hold: 4, exhale: 4, holdEmpty: 4 };
    }
  });

  ipcMain.handle('box-timers:save', (_event, timers) => {
    storage.set('boxBreathingTimers', timers);
    return true;
  });

  ipcMain.handle('ambient:play', (_event, type) => {
    if (mainWindow) {
      mainWindow.webContents.send('ambient:play', type);
    }
    return true;
  });

  ipcMain.handle('ambient:stop', () => {
    if (mainWindow) {
      mainWindow.webContents.send('ambient:stop');
    }
    return true;
  });

  ipcMain.handle('ambient:get-volume', () => {
    const settings = storage.get('settings') || {};
    return settings.ambientVolume !== undefined ? settings.ambientVolume : 0.3;
  });

  ipcMain.handle('ambient:set-volume', (_event, volume) => {
    const settings = storage.get('settings') || {};
    settings.ambientVolume = volume;
    storage.set('settings', settings);
    if (mainWindow) {
      mainWindow.webContents.send('ambient:volume', volume);
    }
    return true;
  });

  ipcMain.handle('ambient:get-active', () => {
    return null;
  });

  ipcMain.handle('settings:get-auto-minimize', () => {
    const settings = storage.get('settings') || {};
    return Boolean(settings.autoMinimize);
  });

  // Data export
  ipcMain.handle('data:export-html', async () => {
    const stressHistory = storage.get('stressHistory') || [];
    const interventionHistory = storage.get('interventionHistory') || [];
    const focusSessions = storage.get('focusSessions') || [];
    const achievements = storage.get('achievements') || {};
    const settings = storage.get('settings') || {};

    const now = new Date();
    const exportDate = now.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const exportTime = now.toLocaleTimeString('de-DE');

    const totalChecks = achievements.totalChecks || 0;
    const totalInterventions = achievements.totalInterventions || 0;
    const totalFocusMinutes = achievements.totalFocusMinutes || 0;
    const consecutiveDays = achievements.consecutiveDays || 0;

    const last7Days = stressHistory.filter(h => Date.now() - h.timestamp <= 7 * 24 * 60 * 60 * 1000);
    const avgStress = last7Days.length ? Math.round(last7Days.reduce((s, h) => s + h.value, 0) / last7Days.length * 10) / 10 : 0;

    const levelCounts = { low: 0, medium: 0, high: 0 };
    const last30Days = stressHistory.filter(h => Date.now() - h.timestamp <= 30 * 24 * 60 * 60 * 1000);
    last30Days.forEach(h => {
      if (h.value <= 3) levelCounts.low++;
      else if (h.value <= 6) levelCounts.medium++;
      else levelCounts.high++;
    });

    const chartBars = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const dayChecks = stressHistory.filter(h => h.timestamp && new Date(h.timestamp).toISOString().split('T')[0] === key);
      const avg = dayChecks.length > 0 ? Math.round(dayChecks.reduce((s, h) => s + h.value, 0) / dayChecks.length * 10) / 10 : 0;
      const dayName = date.toLocaleDateString('de-DE', { weekday: 'short' });
      chartBars.push({ day: dayName, avg, count: dayChecks.length });
    }

    const interventionNames = {
      'physiological-sigh': 'Physiologischer Seufzer',
      'box-breathing': 'Box-Breathing',
      '5-4-3-2-1': '5-4-3-2-1 Grounding',
      'pme': 'Progressive Muskelentspannung',
    };

    const interventionRows = interventionHistory.slice(-20).reverse().map(entry => {
      const date = new Date(entry.timestamp).toLocaleDateString('de-DE');
      const time = new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const name = interventionNames[entry.type] || entry.type;
      return `<tr><td>${date} ${time}</td><td>${name}</td><td>${entry.duration} Min</td></tr>`;
    }).join('');

    const focusRows = focusSessions.slice(-20).reverse().map(entry => {
      const start = new Date(entry.startTime).toLocaleDateString('de-DE');
      const startTime = new Date(entry.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const actual = entry.actualDuration ? `${entry.actualDuration} Min` : `${entry.duration} Min`;
      return `<tr><td>${start} ${startTime}</td><td>${actual}</td></tr>`;
    }).join('');

    const chartBarsHTML = chartBars.map(b => {
      const color = b.avg <= 3 ? 'var(--low-color, #51cf66)' : b.avg <= 6 ? 'var(--medium-color, #ffa94d)' : 'var(--high-color, #ff6b6b)';
      const height = b.avg > 0 ? Math.max(b.avg / 10 * 100, 5) : 2;
      return `<div class="chart-bar-item"><div class="chart-bar-fill" style="height:${height}%;background:${color}"></div><span class="chart-bar-label">${b.day}${b.count > 0 ? '·' + b.avg : ''}</span></div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chill-O-Meter Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0f0f1a;
      color: #e8e8f0;
      padding: 40px 20px;
      min-height: 100vh;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 {
      text-align: center;
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(135deg, #e8e8f0, #6c63ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    .subtitle {
      text-align: center;
      color: #8888a8;
      font-size: 14px;
      margin-bottom: 40px;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 24px;
      backdrop-filter: blur(10px);
    }
    .card h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #6c63ff;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .stat-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 20px 16px;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: #6c63ff;
      display: block;
      margin-bottom: 6px;
    }
    .stat-label {
      font-size: 12px;
      color: #555568;
      display: block;
    }
    .level-distribution {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }
    .level-item {
      flex: 1;
      text-align: center;
      padding: 12px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
    }
    .level-item .count {
      font-size: 24px;
      font-weight: 700;
      display: block;
    }
    .level-item .label {
      font-size: 11px;
      color: #8888a8;
    }
    .level-low .count { color: #51cf66; }
    .level-medium .count { color: #ffa94d; }
    .level-high .count { color: #ff6b6b; }
    .chart {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      height: 140px;
      padding: 16px 0;
    }
    .chart-bar-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
    }
    .chart-bar-fill {
      width: 100%;
      max-width: 40px;
      border-radius: 6px 6px 0 0;
      min-height: 4px;
      transition: height 0.3s;
    }
    .chart-bar-label {
      font-size: 11px;
      color: #555568;
      margin-top: 8px;
      text-align: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 10px 12px;
      font-size: 12px;
      color: #555568;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-weight: 500;
    }
    td {
      padding: 10px 12px;
      font-size: 13px;
      color: #8888a8;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }
    .empty-state {
      text-align: center;
      padding: 30px;
      color: #555568;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      color: #555568;
      font-size: 12px;
    }
    @media (max-width: 600px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .level-distribution { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Chill-O-Meter Report</h1>
    <p class="subtitle">Exportiert am ${exportDate} um ${exportTime}</p>

    <div class="card">
      <h2>📊 Zusammenfassung</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">${totalChecks}</span>
          <span class="stat-label">Stress-Checks</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${avgStress || '--'}</span>
          <span class="stat-label">Ø Stress (7T)</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${totalInterventions}</span>
          <span class="stat-label">Übungen</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${totalFocusMinutes}</span>
          <span class="stat-label">Fokus-Min</span>
        </div>
      </div>
      <div class="level-distribution">
        <div class="level-item level-low">
          <span class="count">${levelCounts.low}</span>
          <span class="label">Niedrig (1-3)</span>
        </div>
        <div class="level-item level-medium">
          <span class="count">${levelCounts.medium}</span>
          <span class="label">Mittel (4-6)</span>
        </div>
        <div class="level-item level-high">
          <span class="count">${levelCounts.high}</span>
          <span class="label">Hoch (7-10)</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>📈 Stress-Verlauf (7 Tage)</h2>
      <div class="chart">
        ${chartBarsHTML}
      </div>
    </div>

    <div class="card">
      <h2>🧘 Interventionen (letzte 20)</h2>
      ${interventionRows ? `
      <table>
        <thead><tr><th>Datum</th><th>Übung</th><th>Dauer</th></tr></thead>
        <tbody>${interventionRows}</tbody>
      </table>` : '<div class="empty-state">Noch keine Interventionen gespeichert</div>'}
    </div>

    <div class="card">
      <h2>🎯 Fokus-Sessions (letzte 20)</h2>
      ${focusRows ? `
      <table>
        <thead><tr><th>Datum</th><th>Dauer</th></tr></thead>
        <tbody>${focusRows}</tbody>
      </table>` : '<div class="empty-state">Noch keine Fokus-Sessions gespeichert</div>'}
    </div>

    <div class="footer">
      Erstellt mit Chill-O-Meter · Offline Stress Management App
    </div>
  </div>
</body>
</html>`;

    const { filePath } = await dialog.showSaveDialog({
      title: 'HTML-Export speichern',
      defaultPath: 'chill-o-meter-report.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    });
    if (!filePath) return { cancelled: true };
    const fs = require('fs');
    fs.writeFileSync(filePath, html, 'utf8');
    return { success: true };
  });

  ipcMain.handle('data:export-csv', async () => {
    const stressHistory = storage.get('stressHistory') || [];
    const interventionHistory = storage.get('interventionHistory') || [];
    const focusSessions = storage.get('focusSessions') || [];

    let csv = 'Typ;Datum;Wert;Details\n';
    stressHistory.forEach(entry => {
      const date = new Date(entry.timestamp).toLocaleString('de-DE');
      csv += `Stress-Check;${date};${entry.value};\n`;
    });
    interventionHistory.forEach(entry => {
      const date = new Date(entry.timestamp).toLocaleString('de-DE');
      csv += `Intervention;${date};${entry.type};\n`;
    });
    focusSessions.forEach(entry => {
      const start = new Date(entry.startTime).toLocaleString('de-DE');
      csv += `Fokus-Modus;${start};${entry.duration} Min;\n`;
    });

    const { filePath } = await dialog.showSaveDialog({
      title: 'CSV-Export speichern',
      defaultPath: 'chill-o-meter-export.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (!filePath) return { cancelled: true };
    const fs = require('fs');
    fs.writeFileSync(filePath, csv, 'utf8');
    return { success: true };
  });

  ipcMain.handle('app:resize', (_event, { width, height }) => {
    if (mainWindow) {
      mainWindow.setSize(width, height);
    }
    return { success: true };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
    if (stressScheduler && stressScheduler._focusStatus.active && stressScheduler._focusStatus.endTime) {
      const remaining = stressScheduler._focusStatus.endTime - Date.now();
      if (remaining <= 0) {
        showFocusEndNotification();
        stressScheduler.setFocusStatus({ active: false, remainingMs: 0, totalMs: 0 });
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (stressScheduler) {
    stressScheduler.stop();
  }
  // Keep app alive only when tray is available
  if (process.platform === 'darwin') {
    app.quit();
    return;
  }
  if (process.platform === 'linux' && !isTrayReady()) {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (stressScheduler) {
    stressScheduler.stop();
  }
});

module.exports = { showWindow, hideWindow };
