const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.chill-o-meter');
const dataFile = path.join(dataDir, 'data.json');

const defaults = {
  stressHistory: [],
  interventionHistory: [],
  focusSessions: [],
  settings: {
    intervalMinutes: 180,
    soundEnabled: true,
    launchOnStartup: false,
  },
  achievements: {
    totalChecks: 0,
    totalInterventions: 0,
    totalFocusMinutes: 0,
    consecutiveDays: 0,
    lastActiveDate: null,
  },
  boxBreathingTimers: {
    inhale: 4,
    hold: 4,
    exhale: 4,
    holdEmpty: 4,
  },
};

function loadData() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(dataFile)) {
      saveData(defaults);
      return { ...defaults };
    }
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { ...defaults };
  }
}

let cached = null;

function get(key) {
  if (cached === null) cached = loadData();
  if (key === undefined) return JSON.parse(JSON.stringify(cached));
  const parts = key.split('.');
  let obj = cached;
  for (const part of parts) {
    if (obj === undefined || obj === null) return null;
    obj = obj[part];
  }
  if (obj === undefined || obj === null) return null;
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function set(key, value) {
  if (cached === null) cached = loadData();
  if (typeof key === 'object' && !Array.isArray(key)) {
    deepMerge(cached, key);
  } else {
    const parts = key.split('.');
    let obj = cached;
    for (let i = 0; i < parts.length - 1; i++) {
      const nextPart = parts[i + 1];
      const isNextArray = nextPart !== undefined && !isNaN(nextPart) && Array.isArray(obj);
      if (obj[parts[i]] === undefined || obj[parts[i]] === null || typeof obj[parts[i]] !== 'object') {
        obj[parts[i]] = isNextArray ? [] : {};
      }
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }
  saveData(cached);
}

function merge(key, value) {
  if (cached === null) cached = loadData();
  const parts = key.split('.');
  let obj = cached;
  for (let i = 0; i < parts.length - 1; i++) {
    const isNextArray = parts[i + 1] !== undefined && !isNaN(parts[i + 1]) && Array.isArray(obj);
    if (obj[parts[i]] === undefined || obj[parts[i]] === null || typeof obj[parts[i]] !== 'object') {
      obj[parts[i]] = isNextArray ? [] : {};
    }
    obj = obj[parts[i]];
  }
  const target = obj[parts[parts.length - 1]] || {};
  obj[parts[parts.length - 1]] = { ...target, ...value };
  saveData(cached);
}

function saveData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

module.exports = {
  get,
  set,
  merge,
  loadData,
};
