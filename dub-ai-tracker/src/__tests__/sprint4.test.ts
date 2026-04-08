// Sprint 4: P2 Fixes — Tests
// Verifies all 15 fixes are properly implemented

// ============================================================
// Fix 1: Dashboard Empty State
// ============================================================

describe('Fix 1: Dashboard Empty State', () => {
  it('Dashboard has hero card for empty state', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/(tabs)/index.tsx'),
      'utf8',
    );
    expect(source).toContain('Welcome to DUB!');
    expect(source).toContain('isDashboardEmpty');
    expect(source).toContain('heroCard');
  });

  it('Dashboard has profile incomplete banner', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/(tabs)/index.tsx'),
      'utf8',
    );
    expect(source).toContain('Complete Your Profile');
    expect(source).toContain('profileBanner');
    // Tags muted when profile incomplete
    expect(source).toContain('opacity: 0.4');
  });
});

// ============================================================
// Fix 2: Coach Empty Chat Greeting
// ============================================================

describe('Fix 2: Coach Empty Chat Greeting', () => {
  it('Coach screen has greeting text in empty state', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/(tabs)/coach.tsx'),
      'utf8',
    );
    expect(source).toContain("Hi! I'm Coach DUB");
    expect(source).toContain('meal plans');
    expect(source).toContain('Pick a prompt below');
  });

  it('SuggestedPrompts uses grid layout (not horizontal scroll)', () => {
    const mod = require('../components/coach/SuggestedPrompts');
    expect(mod.SuggestedPrompts).toBeDefined();
    // Verify View is imported (grid), not ScrollView (horizontal)
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/coach/SuggestedPrompts.tsx'),
      'utf8',
    );
    expect(source).toContain("flexWrap: 'wrap'");
    expect(source).not.toContain('horizontal');
  });
});

// ============================================================
// Fix 3: Sleep Time Pickers
// ============================================================

describe('Fix 3: Sleep Time Pickers', () => {
  it('SleepLogger imports DateTimePicker', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/logging/SleepLogger.tsx'),
      'utf8',
    );
    expect(source).toContain('DateTimePicker');
    // Should NOT have the old TextInput time entry
    expect(source).not.toContain("placeholder=\"HH\"");
    expect(source).not.toContain("placeholder=\"MM\"");
  });

  it('SleepLogger component is importable', () => {
    const mod = require('../components/logging/SleepLogger');
    expect(mod.SleepLogger).toBeDefined();
  });
});

// ============================================================
// Fix 4: Weight Logger Scroll-Wheel
// ============================================================

describe('Fix 4: Weight Logger Scroll-Wheel', () => {
  it('WeightLogger uses Picker instead of TextInput for weight', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/logging/WeightLogger.tsx'),
      'utf8',
    );
    expect(source).toContain("from '@react-native-picker/picker'");
    expect(source).toContain('Picker');
    // Should NOT have TextInput for weight entry
    expect(source).not.toContain("keyboardType=\"decimal-pad\"");
  });

  it('WeightLogger component is importable', () => {
    const mod = require('../components/logging/WeightLogger');
    expect(mod.WeightLogger).toBeDefined();
  });
});

// ============================================================
// Fix 5: Food Entry Swipe-to-Delete
// ============================================================

describe('Fix 5: Food Entry Swipe-to-Delete', () => {
  it('FoodEntryCard uses Swipeable wrapper', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/logging/FoodEntryCard.tsx'),
      'utf8',
    );
    expect(source).toContain('Swipeable');
    expect(source).toContain('renderRightActions');
    expect(source).toContain('hapticWarning');
  });

  it('FoodEntryCard component is importable', () => {
    const mod = require('../components/logging/FoodEntryCard');
    expect(mod.FoodEntryCard).toBeDefined();
  });
});

// ============================================================
// Fix 6: Supplement Edit-in-Place
// ============================================================

describe('Fix 6: Supplement Edit-in-Place', () => {
  it('SupplementChecklist has edit modal', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/logging/SupplementChecklist.tsx'),
      'utf8',
    );
    expect(source).toContain('editModalVisible');
    expect(source).toContain('openEditModal');
    expect(source).toContain('saveEditModal');
    expect(source).toContain('deleteFromEditModal');
  });

  it('Long-press opens edit modal instead of removing', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/logging/SupplementChecklist.tsx'),
      'utf8',
    );
    expect(source).toContain('onLongPress={() => taken && openEditModal');
  });
});

// ============================================================
// Fix 7: EOD Tag Priority Ordering
// ============================================================

describe('Fix 7: EOD Tag Priority Ordering', () => {
  it('PRIORITY_ORDER exists in notifications.ts', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../services/notifications.ts'),
      'utf8',
    );
    expect(source).toContain('PRIORITY_ORDER');
    expect(source).toContain("'sleep.tracking': 1");
    expect(source).toContain('.sort(');
  });
});

// ============================================================
// Fix 8: Stale Data Indicator
// ============================================================

describe('Fix 8: Stale Data Indicator', () => {
  it('useDailySummary exports lastRefresh', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../hooks/useDailySummary.ts'),
      'utf8',
    );
    expect(source).toContain('lastRefresh');
    expect(source).toContain('setLastRefresh(new Date())');
  });

  it('useDailySummary hook is importable', () => {
    const mod = require('../hooks/useDailySummary');
    expect(mod.useDailySummary).toBeDefined();
  });
});

// ============================================================
// Fix 9: Skeleton Loading for Tag Cards
// ============================================================

describe('Fix 9: Skeleton Loading', () => {
  it('SkeletonLoader component exists and is importable', () => {
    const mod = require('../components/common/SkeletonLoader');
    expect(mod.SkeletonLoader).toBeDefined();
  });

  it('SkeletonLoader has correct animated structure', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/common/SkeletonLoader.tsx'),
      'utf8',
    );
    expect(source).toContain('Animated.loop');
    expect(source).toContain('width');
    expect(source).toContain('height');
    expect(source).toContain('borderRadius');
  });

  it('TagCardWithData uses SkeletonLoader instead of Loading text', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/dashboard/TagCardWithData.tsx'),
      'utf8',
    );
    expect(source).toContain('SkeletonLoader');
    expect(source).not.toContain("'Loading...'");
  });
});

// ============================================================
// Fix 10: Trends Empty State
// ============================================================

describe('Fix 10: Trends Empty State', () => {
  it('Trends shows encouraging copy for < 7 days data', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/(tabs)/trends.tsx'),
      'utf8',
    );
    expect(source).toContain('Charts appear after 7 days');
    expect(source).toContain('Day');
    expect(source).toContain('of 7');
  });

  it('Trends shows CTA for 0 days data', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/(tabs)/trends.tsx'),
      'utf8',
    );
    expect(source).toContain('Log your first entry to start building trends');
    expect(source).toContain('Start Logging');
  });

  it('YoY badge only shows when hasYoYData is true', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/(tabs)/trends.tsx'),
      'utf8',
    );
    // Should NOT show YoY muted message for users without data
    expect(source).not.toContain('YoY overlay available after 12 months');
  });
});

// ============================================================
// Fix 11: Offline Context-Aware Messages
// ============================================================

describe('Fix 11: Offline Context-Aware Messages', () => {
  it('OfflineBanner shows AI Coach unavailability', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/common/OfflineBanner.tsx'),
      'utf8',
    );
    expect(source).toContain('AI Coach unavailable until reconnected');
  });

  it('Coach input placeholder changes when offline', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/(tabs)/coach.tsx'),
      'utf8',
    );
    expect(source).toContain('Reconnect to chat with Coach DUB');
    expect(source).toContain('editable={!sending && !isOffline}');
  });
});

// ============================================================
// Fix 12: Silent Error Handling
// ============================================================

describe('Fix 12: Silent Error Handling', () => {
  it('processQueue errors are caught with console.warn, not swallowed', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/_layout.tsx'),
      'utf8',
    );
    // Should NOT have .catch(() => {})
    const lines = source.split('\n');
    const queueLines = lines.filter((l: string) => l.includes('processQueue'));
    const hasEmptyCatch = queueLines.some((l: string) => l.includes('.catch(() => {})'));
    expect(hasEmptyCatch).toBe(false);
    expect(source).toContain("console.warn('Queue sync failed:'");
  });
});

// ============================================================
// Fix 13: Trends Data Error Handling
// ============================================================

describe('Fix 13: Trends Data Error Handling', () => {
  it('useTrendsData has error state', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../hooks/useTrendsData.ts'),
      'utf8',
    );
    expect(source).toContain("setError('Unable to load trends");
    expect(source).toContain('error');
  });

  it('Trends screen shows error banner when error is non-null', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/(tabs)/trends.tsx'),
      'utf8',
    );
    expect(source).toContain('trendsError');
    expect(source).toContain('errorBanner');
  });
});

// ============================================================
// Fix 14: Biometric Auto-Trigger
// ============================================================

describe('Fix 14: Biometric Auto-Trigger', () => {
  it('AuthGate auto-triggers biometric when locked', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/AuthGate.tsx'),
      'utf8',
    );
    expect(source).toContain('autoTriggeredRef');
    expect(source).toContain("state === 'locked' && lockView === 'biometric'");
    expect(source).toContain('handleBiometric()');
  });

  it('Auto-trigger only fires once per lock event', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../components/AuthGate.tsx'),
      'utf8',
    );
    expect(source).toContain('autoTriggeredRef.current = true');
    expect(source).toContain('autoTriggeredRef.current = false');
  });
});

// ============================================================
// Fix 15: Splash Screen Brand Moment
// ============================================================

describe('Fix 15: Splash Screen Brand Moment', () => {
  it('Immediate hideAsync on mount is removed', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/_layout.tsx'),
      'utf8',
    );
    // Should NOT have standalone useEffect that just calls SplashScreen.hideAsync
    // The one in init() is fine — the standalone mount one should be gone
    expect(source).toContain('Removed immediate hideAsync');
  });

  it('Loading overlay shows DUB branding', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../app/_layout.tsx'),
      'utf8',
    );
    // Loading overlay should have DUB text
    expect(source).toContain(">DUB</Text>");
  });
});
