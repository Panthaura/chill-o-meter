const assert = require('assert');
const fs = require('fs');
const path = require('path');

// === Storage Tests ===
function testStorage() {
  console.log('\n=== Storage Tests ===\n');

  const TEST_DIR = path.join(__dirname, 'test-data');

  try {
    // Clean up any previous test data
    if (fs.existsSync(TEST_DIR)) {
      const rmRecursive = (p) => {
        if (fs.existsSync(p)) {
          const entries = fs.readdirSync(p, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(p, entry.name);
            if (entry.isDirectory()) {
              rmRecursive(fullPath);
            } else {
              fs.unlinkSync(fullPath);
            }
          }
          fs.rmdirSync(p);
        }
      };
      rmRecursive(TEST_DIR);
    }

    // Create test directory
    fs.mkdirSync(TEST_DIR, { recursive: true });

    // Patch storage.js to use test directory
    const storagePath = path.join(__dirname, '..', 'modules', 'storage.js');
    let storageCode = fs.readFileSync(storagePath, 'utf8');
    // Replace the dataDir line to use TEST_DIR directly
    storageCode = storageCode.replace(
      /const dataDir = path\.join\(process\.env\.HOME \|\| process\.env\.USERPROFILE \|\| '\.', '\.chill-o-meter'\);/,
      `const dataDir = ${JSON.stringify(TEST_DIR)};`
    );
    const patchedPath = path.join(__dirname, 'storage-patch.js');
    fs.writeFileSync(patchedPath, storageCode);

    // Clear all cache
    Object.keys(require.cache).forEach(key => {
      delete require.cache[key];
    });

    const storage = require('./storage-patch');
    storage.loadData();

    // Test: defaults are created
    const data = storage.get();
    assert.ok(data.stressHistory !== undefined, 'stressHistory should exist');
    assert.ok(data.settings !== undefined, 'settings should exist');
    assert.ok(data.achievements !== undefined, 'achievements should exist');
    assert.ok(data.boxBreathingTimers !== undefined, 'boxBreathingTimers should exist');
    console.log('  [PASS] Defaults are created');

    // Test: dot-notation get
    const interval = storage.get('settings.intervalMinutes');
    assert.strictEqual(interval, 180, 'Default interval should be 180');
    console.log('  [PASS] Dot-notation get works');

    // Test: dot-notation set
    storage.set('settings.intervalMinutes', 60);
    const newInterval = storage.get('settings.intervalMinutes');
    assert.strictEqual(newInterval, 60, 'Interval should be updated to 60');
    console.log('  [PASS] Dot-notation set works');

    // Test: deep set (nested object creation)
    storage.set('custom.nested.value', 42);
    const nestedValue = storage.get('custom.nested.value');
    assert.strictEqual(nestedValue, 42, 'Nested value should be 42');
    console.log('  [PASS] Deep nested set works');

    // Test: merge
    storage.set('settings.soundEnabled', false);
    storage.merge('settings', { intervalMinutes: 120, newSetting: true });
    const merged = storage.get('settings');
    assert.strictEqual(merged.intervalMinutes, 120, 'intervalMinutes should be 120 after merge');
    assert.strictEqual(merged.soundEnabled, false, 'soundEnabled should remain false after merge');
    assert.strictEqual(merged.newSetting, true, 'newSetting should be true after merge');
    console.log('  [PASS] Merge works');

    // Test: array operations
    storage.set('stressHistory', []);
    storage.set('stressHistory.0', { value: 5, timestamp: Date.now() });
    const history = storage.get('stressHistory');
    assert.strictEqual(history.length, 1, 'History should have 1 entry');
    assert.strictEqual(history[0].value, 5, 'First entry value should be 5');
    console.log('  [PASS] Array operations work');

    // Test: returns deep clone
    const obj1 = storage.get('settings');
    obj1.intervalMinutes = 999;
    const obj2 = storage.get('settings');
    assert.strictEqual(obj2.intervalMinutes, 120, 'Should return deep clone, not reference');
    console.log('  [PASS] Returns deep clone');

    console.log('\n  All storage tests passed!\n');

    // Cleanup
    if (fs.existsSync(patchedPath)) {
      fs.unlinkSync(patchedPath);
    }
    if (fs.existsSync(TEST_DIR)) {
      const rmRecursive = (p) => {
        if (fs.existsSync(p)) {
          const entries = fs.readdirSync(p, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(p, entry.name);
            if (entry.isDirectory()) {
              rmRecursive(fullPath);
            } else {
              fs.unlinkSync(fullPath);
            }
          }
          fs.rmdirSync(p);
        }
      };
      rmRecursive(TEST_DIR);
    }

  } catch (e) {
    console.error('  [FAIL]', e.message);
    const patchedPath = path.join(__dirname, 'storage-patch.js');
    if (fs.existsSync(patchedPath)) {
      fs.unlinkSync(patchedPath);
    }
    if (fs.existsSync(TEST_DIR)) {
      const rmRecursive = (p) => {
        if (fs.existsSync(p)) {
          const entries = fs.readdirSync(p, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(p, entry.name);
            if (entry.isDirectory()) {
              rmRecursive(fullPath);
            } else {
              fs.unlinkSync(fullPath);
            }
          }
          fs.rmdirSync(p);
        }
      };
      rmRecursive(TEST_DIR);
    }
    process.exit(1);
  }
}

// === Dashboard Tests ===
function testDashboard() {
  console.log('\n=== Dashboard Tests ===\n');

  try {
    const { calculateStats } = require('../modules/dashboard');

    // Test: empty data
    const emptyData = {
      stressHistory: [],
      interventionHistory: [],
      focusSessions: [],
      achievements: {
        totalChecks: 0,
        totalInterventions: 0,
        totalFocusMinutes: 0,
        consecutiveDays: 0,
        lastActiveDate: null,
      },
    };

    // Mock storage.get
    const storage = require('../modules/storage');
    const originalGet = storage.get;
    storage.get = (key) => {
      if (key === 'stressHistory') return emptyData.stressHistory;
      if (key === 'interventionHistory') return emptyData.interventionHistory;
      if (key === 'focusSessions') return emptyData.focusSessions;
      if (key === 'achievements') return emptyData.achievements;
      return null;
    };

    const emptyStats = calculateStats();
    assert.strictEqual(emptyStats.last7Days, 0, 'Should have 0 stress checks in last 7 days');
    assert.strictEqual(emptyStats.interventionsThisWeek, 0, 'Should have 0 interventions this week');
    assert.strictEqual(emptyStats.focusMinutesThisWeek, 0, 'Should have 0 focus minutes this week');
    console.log('  [PASS] Empty data returns zero stats');

    // Restore
    storage.get = originalGet;

    console.log('\n  All dashboard tests passed!\n');

  } catch (e) {
    console.error('  [FAIL]', e.message);
    process.exit(1);
  }
}

// Run tests
console.log('Running Chill-O-Meter tests...');
testStorage();
testDashboard();
console.log('All tests completed successfully!');
