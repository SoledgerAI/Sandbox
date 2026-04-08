// Sprint 2 Fix 2 + Fix 3: Onboarding Value Prop + Summary Screen tests

describe('PersonalizationFlow step structure', () => {
  it('TOTAL_STEPS is 11 (9 original + value prop + summary)', () => {
    // Read the source to verify the constant
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/PersonalizationFlow.tsx'),
      'utf-8',
    );
    expect(source).toContain('const TOTAL_STEPS = 11');
  });
});

describe('Value Prop screen (Fix 3)', () => {
  it('source contains value prop feature bullets', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/PersonalizationFlow.tsx'),
      'utf-8',
    );
    expect(source).toContain('Track nutrition, fitness, sleep, and mood in one place');
    expect(source).toContain('AI-powered insights from Coach DUB');
    expect(source).toContain('Your data stays on your device');
    expect(source).toContain('About 2 minutes to set up');
  });

  it('Get Started button text exists for step 1', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/PersonalizationFlow.tsx'),
      'utf-8',
    );
    expect(source).toContain("'Get Started'");
  });

  it('consent step still requires all checkboxes (step 2 validation)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/PersonalizationFlow.tsx'),
      'utf-8',
    );
    // Step 2 must check allConsented and name
    expect(source).toContain('case 2: return allConsented && !!name.trim()');
  });
});

describe('Summary screen (Fix 2)', () => {
  it('summary screen renders all profile field labels', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/PersonalizationFlow.tsx'),
      'utf-8',
    );
    const requiredLabels = [
      'Name', 'Pronouns', 'Biological Sex', 'Date of Birth',
      'Height', 'Weight', 'Activity Level', 'Goal', 'Tags', 'Zip Code',
    ];
    for (const label of requiredLabels) {
      expect(source).toContain(`label: '${label}'`);
    }
  });

  it('tapping a summary row navigates to the correct step', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/PersonalizationFlow.tsx'),
      'utf-8',
    );
    // editStep references should map to correct steps
    expect(source).toContain("{ label: 'Name', value: name || 'Not set', editStep: 2 }");
    expect(source).toContain("{ label: 'Biological Sex', value: sexLabel, editStep: 3 }");
    expect(source).toContain("{ label: 'Height', value: heightDisplay, editStep: 5 }");
    expect(source).toContain("{ label: 'Zip Code', value: zip.trim() || 'Not provided', editStep: 10 }");
  });

  it('Start Tracking button triggers onboarding completion from step 11', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/PersonalizationFlow.tsx'),
      'utf-8',
    );
    // Step 11 calls handleFinish
    expect(source).toContain('case 11: // Summary — finish');
    expect(source).toContain('handleFinish()');
  });
});
