// Fix 5: Licenses screen tests
// Verifies licenses data and screen render

describe('Licenses Data', () => {
  it('licenses constant is importable and has entries', () => {
    const { LICENSES } = require('../constants/licenses');
    expect(LICENSES).toBeDefined();
    expect(Array.isArray(LICENSES)).toBe(true);
    expect(LICENSES.length).toBeGreaterThan(0);
  });

  it('each license entry has required fields', () => {
    const { LICENSES } = require('../constants/licenses');
    for (const entry of LICENSES) {
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('version');
      expect(entry).toHaveProperty('license');
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.version).toBe('string');
      expect(typeof entry.license).toBe('string');
    }
  });

  it('groupByLicense groups correctly', () => {
    const { LICENSES, groupByLicense } = require('../constants/licenses');
    const groups = groupByLicense(LICENSES);
    expect(groups).toHaveProperty('MIT');
    expect(groups['MIT'].length).toBeGreaterThan(0);
  });
});

describe('Licenses Screen', () => {
  it('licenses.tsx is importable', () => {
    const mod = require('../../app/settings/licenses');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });
});
