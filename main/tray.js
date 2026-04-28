const { app, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let mainWindowRef = null;
let showWindowRef = null;
let hideWindowRef = null;
let helpShown = false;

function init(window, showFn, hideFn) {
  mainWindowRef = window;
  showWindowRef = showFn;
  hideWindowRef = hideFn;
}

function isOnLinux() {
  return process.platform === 'linux';
}

function isOnLinuxGNOME() {
  if (!isOnLinux()) return false;
  const desktop = process.env.XDG_CURRENT_DESKTOP || '';
  const session = process.env.GDMSESSION || '';
  const deSession = process.env.DESKTOP_SESSION || '';
  const lower = desktop.toLowerCase() + session.toLowerCase() + deSession.toLowerCase();
  return lower.includes('gnome') || lower.includes('ubuntu') || lower.includes('cinnamon');
}

function showTrayHelpDialog() {
  if (helpShown) return;
  helpShown = true;

  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('tray:show-help');
    return;
  }

  dialog.showMessageBox({
    type: 'warning',
    title: 'Chill-O-Meter',
    message: 'System-Tray nicht verfügbar',
    detail: 'Auf GNOME/Linux muss die AppIndicator-Erweiterung installiert werden, damit das Tray-Icon angezeigt wird.\n\nInstallation:\n  sudo dnf install gnome-shell-extension-appindicator\n\nAnschließend die Erweiterung in "Extensionen" aktivieren.',
    buttons: ['Verstanden', 'Installation anzeigen'],
  }).then((result) => {
    if (result.response === 1) {
      require('child_process').exec(
        'xdg-open https://extensions.gnome.org/extension/615/appindicator-support/'
      );
    }
  });
}

function createTray() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '..', 'assets', 'icon.ico')
    : path.join(__dirname, '..', 'assets', 'tray-icon.png');
  let trayIcon;

  if (fs.existsSync(iconPath)) {
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
      if (trayIcon.isEmpty()) {
        trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
      }
      if (process.platform !== 'win32' && !trayIcon.isEmpty()) {
        trayIcon = trayIcon.resize({ width: 20, height: 20 });
      }
    } catch (e) {
      console.warn('Failed to load tray icon:', e.message);
      trayIcon = nativeImage.createEmpty();
    }
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  try {
    tray = new Tray(trayIcon);
  } catch (e) {
    console.warn('Failed to create tray:', e.message);
    tray = null;
    return null;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Fenster anzeigen',
      click: () => {
        showWindowRef();
      },
    },
    { type: 'separator' },
    {
      label: 'Stress-Check erzwingen',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.webContents.send('stress-check');
          showWindowRef();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Fokus-Modus beenden',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.webContents.send('focus-end');
          showWindowRef();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Statistik anzeigen',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.webContents.send('show-view', 'dashboard');
          showWindowRef();
        }
      },
    },
    {
      label: 'Interventionen anzeigen',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.webContents.send('show-view', 'interventions');
          showWindowRef();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Einstellungen',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.webContents.send('show-view', 'settings');
          showWindowRef();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Chill-O-Meter');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindowRef && mainWindowRef.isVisible()) {
      hideWindowRef();
    } else {
      showWindowRef();
    }
  });

  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });

  return tray;
}

function showTrayHelpIfNeeded() {
  if (!isOnLinuxGNOME()) return;
  if (mainWindowRef) {
    mainWindowRef.webContents.send('tray:show-help');
  }
}

function getTrayState() {
  if (!isOnLinux()) {
    return { isAvailable: true, desktopEnvironment: 'other', isTrayVisible: true };
  }
  if (!tray || tray.isDestroyed()) {
    return { isAvailable: false, desktopEnvironment: 'linux', isTrayVisible: false };
  }
  return {
    isAvailable: true,
    desktopEnvironment: isOnLinuxGNOME() ? 'gnome' : 'linux',
    isTrayVisible: true
  };
}

function isTrayReady() {
  return Boolean(tray && !tray.isDestroyed());
}

module.exports = { createTray, init, showTrayHelpIfNeeded, getTrayState, isOnLinuxGNOME, isTrayReady };
