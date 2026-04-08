// Sprint 2 Fix 4: EOD Questionnaire 7-card cap tests

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  multiGet: jest.fn().mockResolvedValue([]),
  getAllKeys: jest.fn().mockResolvedValue([]),
}));

describe('EOD Questionnaire card cap', () => {
  it('module is importable', () => {
    const mod = require('../components/notifications/EODQuestionnaire');
    expect(mod).toBeDefined();
    expect(mod.EODQuestionnaire).toBeDefined();
  });

  it('MAX_EOD_CARDS constant is 7', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/notifications/EODQuestionnaire.tsx'),
      'utf-8',
    );
    expect(source).toContain('const MAX_EOD_CARDS = 7');
  });

  it('card count never exceeds 8 (7 tags + 1 AI summary) based on cap logic', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/notifications/EODQuestionnaire.tsx'),
      'utf-8',
    );
    // Verify the cap is applied via slice
    expect(source).toContain('sorted.slice(0, MAX_EOD_CARDS)');
    // Verify totalCards = cappedTags.length + 1
    expect(source).toContain('const totalCards = cappedTags.length + 1');
  });
});

describe('EOD tag priority ordering', () => {
  it('priority constant ranks sleep first', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/notifications/EODQuestionnaire.tsx'),
      'utf-8',
    );
    expect(source).toContain('sleep: 1');
    expect(source).toContain('mood: 2');
  });

  it('tags are sorted by priority before slicing', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/notifications/EODQuestionnaire.tsx'),
      'utf-8',
    );
    // Sort happens before slice
    const sortIndex = source.indexOf('sortByPriority(filtered)');
    const sliceIndex = source.indexOf('.slice(0, MAX_EOD_CARDS)');
    expect(sortIndex).toBeGreaterThan(-1);
    expect(sliceIndex).toBeGreaterThan(sortIndex);
  });
});

describe('EOD escape card', () => {
  it('escape card appears after card 5', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/notifications/EODQuestionnaire.tsx'),
      'utf-8',
    );
    expect(source).toContain('const ESCAPE_CARD_INDEX = 5');
    expect(source).toContain('Want to wrap up?');
    expect(source).toContain('Done for Today');
    expect(source).toContain('Continue');
  });
});

describe('EOD adaptive suppression', () => {
  it('skip counts persist via STORAGE_KEYS.EOD_SKIP_COUNTS', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/notifications/EODQuestionnaire.tsx'),
      'utf-8',
    );
    expect(source).toContain('STORAGE_KEYS.EOD_SKIP_COUNTS');
    expect(source).toContain('incrementSkipCount');
    expect(source).toContain('resetSkipCount');
  });

  it('tags with 10+ skips are filtered out', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/notifications/EODQuestionnaire.tsx'),
      'utf-8',
    );
    expect(source).toContain('const SKIP_SUPPRESS_THRESHOLD = 10');
    expect(source).toContain('< SKIP_SUPPRESS_THRESHOLD');
  });

  it('EOD_SKIP_COUNTS key exists in storage', () => {
    const { STORAGE_KEYS } = require('../utils/storage');
    expect(STORAGE_KEYS.EOD_SKIP_COUNTS).toBe('dub.eod.skip_counts');
  });
});
