// Fix 1: Privacy Policy screen test
// Verifies the component module exports and section content

describe('Privacy Policy Screen', () => {
  it('privacy.tsx is importable', () => {
    const mod = require('../../app/settings/privacy');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });

  it('contains all required section headers', () => {
    // Read the SECTIONS array by inspecting the module source
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/settings/privacy.tsx'),
      'utf-8',
    );

    const requiredSections = [
      'What Data We Collect',
      'How Data Is Stored',
      'When Data Is Transmitted',
      'Third-Party Services',
      'Your Rights',
      'Contact',
      'Effective Date',
      'Changes to This Policy',
    ];

    for (const section of requiredSections) {
      expect(source).toContain(section);
    }
  });

  it('references required data handling details', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/settings/privacy.tsx'),
      'utf-8',
    );

    expect(source).toContain('AsyncStorage');
    expect(source).toContain('SecureStore');
    expect(source).toContain('Anthropic');
    expect(source).toContain('privacy@soledgerai.com');
    expect(source).toContain('SoledgerAI');
    expect(source).toContain('April 2026');
  });
});
