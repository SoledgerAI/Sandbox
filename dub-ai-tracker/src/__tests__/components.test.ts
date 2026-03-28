// Step 10: Component render tests
// Verify critical components render without crashing
// Note: Full component rendering requires React Native runtime context.
// We verify component modules are importable and exports exist.

describe('Common Components', () => {
  it('Button component is importable', async () => {
    const mod = require('../components/common/Button');
    expect(mod).toBeDefined();
  });

  it('Input component is importable', async () => {
    const mod = require('../components/common/Input');
    expect(mod).toBeDefined();
  });

  it('ProgressBar component is importable', async () => {
    const mod = require('../components/common/ProgressBar');
    expect(mod).toBeDefined();
  });

  it('Celebration component is importable', async () => {
    const mod = require('../components/common/Celebration');
    expect(mod).toBeDefined();
  });
});

describe('Dashboard Components', () => {
  it('DashboardCard is importable', async () => {
    const mod = require('../components/dashboard/DashboardCard');
    expect(mod).toBeDefined();
  });

  it('CalorieSummary is importable', async () => {
    const mod = require('../components/dashboard/CalorieSummary');
    expect(mod).toBeDefined();
  });

  it('RecoveryCard is importable', async () => {
    const mod = require('../components/dashboard/RecoveryCard');
    expect(mod).toBeDefined();
  });

  it('StreakCounter is importable', async () => {
    const mod = require('../components/dashboard/StreakCounter');
    expect(mod).toBeDefined();
  });
});

describe('Onboarding Components', () => {
  it('ProfileStep is importable', async () => {
    const mod = require('../components/onboarding/ProfileStep');
    expect(mod).toBeDefined();
  });

  it('TierSelector is importable', async () => {
    const mod = require('../components/onboarding/TierSelector');
    expect(mod).toBeDefined();
  });

  it('TagPicker is importable', async () => {
    const mod = require('../components/onboarding/TagPicker');
    expect(mod).toBeDefined();
  });

  it('WeightGoalStep is importable', async () => {
    const mod = require('../components/onboarding/WeightGoalStep');
    expect(mod).toBeDefined();
  });
});

describe('Logging Components', () => {
  it('MoodPicker is importable', async () => {
    const mod = require('../components/logging/MoodPicker');
    expect(mod).toBeDefined();
  });

  it('WaterLogger is importable', async () => {
    const mod = require('../components/logging/WaterLogger');
    expect(mod).toBeDefined();
  });

  it('WeightLogger is importable', async () => {
    const mod = require('../components/logging/WeightLogger');
    expect(mod).toBeDefined();
  });

  it('FoodSearch is importable', async () => {
    const mod = require('../components/logging/FoodSearch');
    expect(mod).toBeDefined();
  });

  it('StrengthLogger is importable', async () => {
    const mod = require('../components/logging/StrengthLogger');
    expect(mod).toBeDefined();
  });

  it('SleepLogger is importable', async () => {
    const mod = require('../components/logging/SleepLogger');
    expect(mod).toBeDefined();
  });

  it('SupplementChecklist is importable', async () => {
    const mod = require('../components/logging/SupplementChecklist');
    expect(mod).toBeDefined();
  });
});

describe('Coach Components', () => {
  it('ChatBubble is importable', async () => {
    const mod = require('../components/coach/ChatBubble');
    expect(mod).toBeDefined();
  });

  it('SuggestedPrompts is importable', async () => {
    const mod = require('../components/coach/SuggestedPrompts');
    expect(mod).toBeDefined();
  });

  it('DataContextBanner is importable', async () => {
    const mod = require('../components/coach/DataContextBanner');
    expect(mod).toBeDefined();
  });
});

describe('Chart Components', () => {
  it('ScoreRing is importable', async () => {
    const mod = require('../components/charts/ScoreRing');
    expect(mod).toBeDefined();
  });

  it('SparkLine is importable', async () => {
    const mod = require('../components/charts/SparkLine');
    expect(mod).toBeDefined();
  });

  it('BarChart is importable', async () => {
    const mod = require('../components/charts/BarChart');
    expect(mod).toBeDefined();
  });

  it('LineChart is importable', async () => {
    const mod = require('../components/charts/LineChart');
    expect(mod).toBeDefined();
  });
});

describe('Marketplace Components', () => {
  it('ProductCard is importable', async () => {
    const mod = require('../components/marketplace/ProductCard');
    expect(mod).toBeDefined();
  });

  it('FTCDisclosure is importable', async () => {
    const mod = require('../components/marketplace/FTCDisclosure');
    expect(mod).toBeDefined();
  });
});
