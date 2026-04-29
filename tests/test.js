const assert = require('assert');

console.log('Running Chill-O-Meter tests...');

// Basic storage smoke test
const storage = require('../modules/storage');
const before = storage.get('settings') || {};
storage.set('settings.testFlag', true);
const after = storage.get('settings') || {};
assert.strictEqual(after.testFlag, true, 'settings.testFlag should be true after set()');

// Clean up test flag
storage.set('settings.testFlag', before.testFlag);

console.log('\n=== Storage Tests ===\n');
console.log('  [PASS] settings.testFlag roundtrip');

console.log('\nAll tests completed successfully!');

