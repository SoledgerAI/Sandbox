// Fix 3: OfflineBanner layout test
// Verifies OfflineBanner is rendered in the root layout

import * as fs from 'fs';
import * as path from 'path';

describe('OfflineBanner in Layout', () => {
  it('OfflineBanner is imported in _layout.tsx', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/_layout.tsx'),
      'utf-8',
    );
    expect(source).toContain("import { OfflineBanner }");
  });

  it('OfflineBanner is rendered in the layout JSX', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/_layout.tsx'),
      'utf-8',
    );
    expect(source).toContain('<OfflineBanner');
  });

  it('OfflineBanner component is importable', () => {
    const mod = require('../components/common/OfflineBanner');
    expect(mod).toBeDefined();
    expect(mod.OfflineBanner).toBeDefined();
  });
});
