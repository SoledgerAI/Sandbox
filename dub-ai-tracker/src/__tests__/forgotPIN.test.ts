// Sprint 2 Fix 5: Forgot PIN recovery tests

describe('Forgot PIN recovery (AuthGate)', () => {
  it('AuthGate module is importable', () => {
    const mod = require('../components/AuthGate');
    expect(mod).toBeDefined();
    expect(mod.AuthGate).toBeDefined();
  });

  it('source contains Forgot PIN link in PIN view', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/AuthGate.tsx'),
      'utf-8',
    );
    expect(source).toContain('Forgot PIN?');
    expect(source).toContain('forgotPinLink');
    expect(source).toContain('handleForgotPIN');
  });

  it('biometric available: shows reset option', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/AuthGate.tsx'),
      'utf-8',
    );
    expect(source).toContain('Reset PIN with');
    expect(source).toContain('verify your identity and set a new PIN');
  });

  it('biometric unavailable: shows warning message', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/AuthGate.tsx'),
      'utf-8',
    );
    expect(source).toContain('Cannot Reset PIN');
    expect(source).toContain('delete and reinstall the app');
    expect(source).toContain('all local data will be lost');
  });

  it('successful biometric auth triggers PIN reset flow via PINSetupModal', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/AuthGate.tsx'),
      'utf-8',
    );
    expect(source).toContain('setShowPinReset(true)');
    expect(source).toContain('<PINSetupModal');
    expect(source).toContain('visible={showPinReset}');
  });

  it('hapticWarning is called when Forgot PIN alert appears', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/AuthGate.tsx'),
      'utf-8',
    );
    // handleForgotPIN starts with hapticWarning
    const handler = source.substring(
      source.indexOf('const handleForgotPIN'),
      source.indexOf('const handleForgotPIN') + 200,
    );
    expect(handler).toContain('hapticWarning()');
  });
});
