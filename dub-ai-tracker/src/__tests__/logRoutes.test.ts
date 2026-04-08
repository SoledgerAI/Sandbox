// Fix 2: Log route validation test
// Verifies all routes in CATEGORY_SECTIONS resolve to existing files

import * as fs from 'fs';
import * as path from 'path';

describe('Log Hub Route Validation', () => {
  it('does not contain a /log/steps route', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/(tabs)/log.tsx'),
      'utf-8',
    );
    expect(source).not.toContain("'/log/steps'");
  });

  it('all routes in CATEGORY_SECTIONS resolve to existing files', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../app/(tabs)/log.tsx'),
      'utf-8',
    );

    // Extract all route strings from the source
    const routeMatches = source.match(/route:\s*'([^']+)'/g) || [];
    const routes = routeMatches.map((m) => {
      const match = m.match(/route:\s*'([^']+)'/);
      return match ? match[1] : '';
    }).filter(Boolean);

    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      // Convert route like '/log/food' to file path 'app/log/food.tsx'
      const filePath = path.join(__dirname, '../../app', route + '.tsx');
      const exists = fs.existsSync(filePath);
      if (!exists) {
        fail(`Route ${route} does not resolve to file: ${filePath}`);
      }
    }
  });
});
