const { ipcMain } = require('electron');
const storage = require('./storage');

function calculateStats() {
  const history = storage.get('stressHistory') || [];
  const interventionHistory = storage.get('interventionHistory') || [];
  const focusSessions = storage.get('focusSessions') || [];
  const achievements = storage.get('achievements') || {};

  const last7Days = history.filter((h) => {
    const diff = Date.now() - h.timestamp;
    return diff <= 7 * 24 * 60 * 60 * 1000;
  });

  const last30Days = history.filter((h) => {
    const diff = Date.now() - h.timestamp;
    return diff <= 30 * 24 * 60 * 60 * 1000;
  });

  const avgStress = last7Days.length
    ? last7Days.reduce((sum, h) => sum + h.value, 0) / last7Days.length
    : 0;

  const maxStress = last7Days.length
    ? Math.max(...last7Days.map((h) => h.value))
    : 0;

  const minStress = last7Days.length
    ? Math.min(...last7Days.map((h) => h.value))
    : 0;

  const interventionsThisWeek = interventionHistory.filter((i) => {
    const diff = Date.now() - i.timestamp;
    return diff <= 7 * 24 * 60 * 60 * 1000;
  });

  const focusMinutesThisWeek = focusSessions.filter((s) => {
    const diff = Date.now() - s.startTime;
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).reduce((sum, s) => sum + s.duration, 0);

  const weeklyBreakdown = {};
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    const dayChecks = history.filter((h) => h.timestamp && new Date(h.timestamp).toISOString().split('T')[0] === key);
    weeklyBreakdown[key] = dayChecks.length > 0
      ? { count: dayChecks.length, avg: dayChecks.reduce((s, h) => s + h.value, 0) / dayChecks.length }
      : { count: 0, avg: 0 };
  }

  const weeklyData = Object.entries(weeklyBreakdown).map(([dateStr, data]) => {
    const date = new Date(dateStr + 'T00:00:00');
    return {
      date: date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' }),
      avg: Math.round(data.avg * 10) / 10,
      count: data.count,
    };
  });

  const levelCounts = { low: 0, medium: 0, high: 0 };
  last30Days.forEach((h) => {
    if (h.value <= 3) levelCounts.low++;
    else if (h.value <= 6) levelCounts.medium++;
    else levelCounts.high++;
  });

  const totalChecks = achievements.totalChecks || 0;
  const totalInterventions = achievements.totalInterventions || 0;
  const totalFocusMinutes = achievements.totalFocusMinutes || 0;
  const consecutiveDays = achievements.consecutiveDays || 0;

  return {
    last7Days: last7Days.length,
    last30Days: last30Days.length,
    avgStress: Math.round(avgStress * 10) / 10,
    maxStress,
    minStress,
    interventionsThisWeek: interventionsThisWeek.length,
    focusMinutesThisWeek,
    weeklyData,
    levelCounts,
    totalChecks,
    totalInterventions,
    totalFocusMinutes,
    consecutiveDays,
    totalFocusSessions: focusSessions.length,
  };
}

function setupIpc() {
  ipcMain.handle('dashboard:get-stats', () => {
    return calculateStats();
  });

  ipcMain.handle('achievements:get', () => {
    return storage.get('achievements') || {};
  });
}

module.exports = { calculateStats, setupIpc };
