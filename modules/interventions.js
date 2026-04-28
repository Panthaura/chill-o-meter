const { ipcMain } = require('electron');
const storage = require('./storage');

const interventions = {
  'physiological-sigh': {
    name: 'Physiologischer Seufzer',
    description: 'Zwei kurze Inspirationen durch die Nase, dann eine lange Exspiration durch den Mund',
    steps: [
      { text: 'Atme tief durch die Nase ein', duration: 4 },
      { text: 'Atme noch einmal kurz durch die Nase ein', duration: 2 },
      { text: 'Atme langsam und vollständig durch den Mund aus', duration: 6 },
    ],
  },
  'box-breathing': {
    name: 'Box-Breathing',
    description: '4-4-4-4 Atemtechnik für tiefe Entspannung',
    steps: [
      { text: 'Einatmen (4 Sek.)', duration: 4 },
      { text: 'Halten (4 Sek.)', duration: 4 },
      { text: 'Ausatmen (4 Sek.)', duration: 4 },
      { text: 'Halten (4 Sek.)', duration: 4 },
    ],
  },
  '5-4-3-2-1': {
    name: '5-4-3-2-1 Grounding',
    description: 'Sinneswahrnehmungen bewusst machen',
    steps: [
      { text: 'Nenne 5 Dinge, die du SEHEN kannst', duration: 15 },
      { text: 'Nenne 4 Dinge, die du FÜHLEN kannst', duration: 15 },
      { text: 'Nenne 3 Dinge, die du HÖREN kannst', duration: 15 },
      { text: 'Nenne 2 Dinge, die du RIECHEN kannst', duration: 10 },
      { text: 'Nenne 1 Sache, die du SCHMECKEN kannst', duration: 10 },
    ],
  },
  'pme': {
    name: 'Progressive Muskelentspannung',
    description: 'Muskeln nacheinander an- und entspannen',
    steps: [
      { text: 'Schultern hochziehen (5 Sek.) -> loslassen', duration: 10 },
      { text: 'Faust bilden (5 Sek.) -> loslassen', duration: 10 },
      { text: 'Bauch anspannen (5 Sek.) -> loslassen', duration: 10 },
      { text: 'Beine anspannen (5 Sek.) -> loslassen', duration: 10 },
    ],
  },
};

function setupIpc() {
  ipcMain.handle('intervention:get-by-type', (_event, type) => {
    return interventions[type] || null;
  });

  ipcMain.handle('intervention:complete', (_event, name, duration) => {
    const history = storage.get('interventionHistory') || [];
    history.push({
      type: name,
      duration,
      timestamp: Date.now(),
    });
    storage.set('interventionHistory', history);

    const achievements = storage.get('achievements') || {};
    achievements.totalInterventions = (achievements.totalInterventions || 0) + 1;
    storage.set('achievements', achievements);
    return { success: true };
  });

  ipcMain.handle('intervention:get-history', () => {
    return storage.get('interventionHistory') || [];
  });

  ipcMain.handle('intervention:get-all', () => {
    return interventions;
  });
}

module.exports = { interventions, setupIpc };
