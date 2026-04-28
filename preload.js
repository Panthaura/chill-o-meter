const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App controls
  show: () => ipcRenderer.invoke('app:show'),
  hide: () => ipcRenderer.invoke('app:hide'),
  quit: () => ipcRenderer.invoke('app:quit'),
  toggle: () => ipcRenderer.invoke('app:toggle'),

  // Stress meter
  submitStress: (value) =>
    ipcRenderer.invoke('stress:submit', value),
  getStressHistory: () => ipcRenderer.invoke('stress:get-history'),
  forceCheck: () => ipcRenderer.invoke('stress:force-check'),

  // Focus mode
  startFocusMode: (duration) => ipcRenderer.invoke('focus:start', duration),
  endFocusMode: () => ipcRenderer.invoke('focus:end'),
  getFocusStatus: () => ipcRenderer.invoke('focus:get-status'),

  // Interventions
  completeIntervention: (name, duration) =>
    ipcRenderer.invoke('intervention:complete', name, duration),
  getInterventionHistory: () =>
    ipcRenderer.invoke('intervention:get-history'),
  getInterventionByType: (type) =>
    ipcRenderer.invoke('intervention:get-by-type', type),
  getInterventionAll: () =>
    ipcRenderer.invoke('intervention:get-all'),

  // Dashboard
  getStats: () => ipcRenderer.invoke('dashboard:get-stats'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) =>
    ipcRenderer.invoke('settings:update', settings),
  getAutoMinimize: () => ipcRenderer.invoke('settings:get-auto-minimize'),

  // History
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Box breathing custom timers
  getBoxTimers: () => ipcRenderer.invoke('box-timers:get'),
  saveBoxTimers: (timers) => ipcRenderer.invoke('box-timers:save', timers),

  // Data export
  exportHtml: () => ipcRenderer.invoke('data:export-html'),
  exportCsv: () => ipcRenderer.invoke('data:export-csv'),

  resizeWindow: (width, height) => ipcRenderer.invoke('app:resize', { width, height }),

  ambientPlay: (type) => ipcRenderer.invoke('ambient:play', type),
  ambientStop: () => ipcRenderer.invoke('ambient:stop'),
  ambientGetVolume: () => ipcRenderer.invoke('ambient:get-volume'),
  ambientSetVolume: (volume) => ipcRenderer.invoke('ambient:set-volume', volume),
  ambientGetActive: () => ipcRenderer.invoke('ambient:get-active'),

  getTrayState: () => ipcRenderer.invoke('tray:get-state'),
  showTrayHelp: () => ipcRenderer.invoke('tray:show-help'),

  // IPC listeners
  onShowView: (callback) => {
    const handler = (_event, view) => callback(view);
    ipcRenderer.on('show-view', handler);
    return () => ipcRenderer.removeListener('show-view', handler);
  },
  onFocusEnd: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('focus-end', handler);
    return () => ipcRenderer.removeListener('focus-end', handler);
  },
  onStressCheck: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('stress-check', handler);
    return () => ipcRenderer.removeListener('stress-check', handler);
  },
  onTrayHelp: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('tray:show-help', handler);
    return () => ipcRenderer.removeListener('tray:show-help', handler);
  },
});
