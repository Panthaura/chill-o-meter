const { ipcMain, app } = require('electron');
const storage = require('./storage');
const EventEmitter = require('events');
const { showFocusNotification, showFocusEndNotification, showInterventionNotification } = require('../main/notifications');

class StressScheduler extends EventEmitter {
  constructor() {
    super();
    this.timer = null;
    this.intervalMs = 180 * 60 * 1000;
    this._focusStatus = { active: false, remainingMs: 0 };
    this._loadInterval();
  }

  _loadInterval() {
    const settings = storage.get('settings') || {};
    this.intervalMs = (settings.intervalMinutes || 180) * 60 * 1000;
  }

  start() {
    this.stop();
    this._loadInterval();
    this.timer = setInterval(() => {
      if (!this._focusStatus.active) {
        this.emit('check');
      }
    }, this.intervalMs);

    setTimeout(() => {
      if (!this._focusStatus.active) {
        this.emit('check');
      }
    }, 5000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setIntervalMinutes(minutes) {
    this.intervalMs = minutes * 60 * 1000;
    this.start();
  }

  setFocusStatus(status) {
    this._focusStatus = status;
  }
}

function setupIpc(scheduler) {
  ipcMain.handle('stress:submit', (_event, value) => {
    value = Math.round(value);
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      return { success: false, error: 'Ungültiger Wert' };
    }
    const history = storage.get('stressHistory') || [];
    history.push({
      value,
      timestamp: Date.now(),
    });
    storage.set('stressHistory', history);

    if (value > 5) {
      showInterventionNotification();
    }

    const achievements = storage.get('achievements') || {};
    achievements.totalChecks = (achievements.totalChecks || 0) + 1;

    const today = new Date().toDateString();
    const lastDate = achievements.lastActiveDate;
    if (lastDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastDate === yesterday.toDateString()) {
        achievements.consecutiveDays = (achievements.consecutiveDays || 0) + 1;
      } else {
        achievements.consecutiveDays = 1;
      }
      achievements.lastActiveDate = today;
    }

    storage.set('achievements', achievements);
    return { success: true };
  });

  ipcMain.handle('stress:get-history', () => {
    return storage.get('stressHistory') || [];
  });

  ipcMain.handle('stress:force-check', () => {
    scheduler.emit('check');
    return { success: true };
  });

  ipcMain.handle('settings:get', () => {
    return storage.get('settings') || {};
  });

  ipcMain.handle('settings:update', (_event, settings) => {
    storage.merge('settings', settings);
    const updated = storage.get('settings') || {};
    if (settings.intervalMinutes) {
      if (Number.isInteger(settings.intervalMinutes) && settings.intervalMinutes > 0) {
        scheduler.setIntervalMinutes(settings.intervalMinutes);
      }
    }
    return updated;
  });

  ipcMain.handle('focus:start', (_event, duration) => {
    duration = Math.round(duration);
    if (!Number.isInteger(duration) || duration < 1) {
      return { active: false, error: 'Ungültige Dauer' };
    }
    const originalDuration = duration;
    duration = Math.min(480, duration);
    const endTime = Date.now() + duration * 60 * 1000;
    const totalMs = duration * 60 * 1000;
    scheduler.setFocusStatus({
      active: true,
      remainingMs: totalMs,
      endTime,
      totalMs,
    });

    const achievements = storage.get('achievements') || {};
    achievements.totalFocusMinutes = (achievements.totalFocusMinutes || 0) + duration;
    storage.set('achievements', achievements);

    const sessions = storage.get('focusSessions') || [];
    sessions.push({
      duration,
      startTime: Date.now(),
      endTime,
    });
    storage.set('focusSessions', sessions);

   if (originalDuration > 480) {
      const { Notification } = require('electron');
      new Notification({
        title: 'Chill-O-Meter',
        body: `Dauer auf 480 Minuten begrenzt. Fokus-Modus aktiv: ${duration} Minuten`,
        sound: false,
      }).show();
    }
    showFocusNotification(duration);

    return { active: true, remainingMs: scheduler._focusStatus.remainingMs, totalMs };
  });

  ipcMain.handle('focus:end', () => {
    const actualEnd = Date.now();
    if (scheduler._focusStatus.active) {
      showFocusEndNotification();
      const sessions = storage.get('focusSessions') || [];
      const lastSession = sessions[sessions.length - 1];
      if (lastSession && lastSession.endTime && !lastSession.actualEnd) {
        lastSession.actualEnd = actualEnd;
        lastSession.actualDuration = Math.round((actualEnd - lastSession.startTime) / 60000);
        storage.set('focusSessions', sessions);
      }
    }
    scheduler.setFocusStatus({ active: false, remainingMs: 0, totalMs: 0 });
    return { active: false };
  });

  ipcMain.handle('focus:get-status', () => {
    const status = scheduler._focusStatus;
    if (status.active && status.endTime) {
      status.remainingMs = status.endTime - Date.now();
      if (status.remainingMs <= 0) {
        showFocusEndNotification();
        scheduler.setFocusStatus({ active: false, remainingMs: 0, totalMs: 0 });
        return { active: false, totalMs: 0 };
      }
    }
    return {
      active: status.active,
      remainingMs: status.remainingMs,
      remainingSeconds: status.active ? Math.max(0, Math.ceil(status.remainingMs / 1000)) : 0,
      totalMs: status.totalMs || (status.active ? status.remainingMs : 0),
    };
  });
}

module.exports = { StressScheduler, setupIpc };
