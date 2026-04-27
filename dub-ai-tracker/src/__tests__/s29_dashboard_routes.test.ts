// S29-D: Dashboard tile and snapshot route validation.
// Static checks that prevent regressions like '/log/mood_mental' (file
// is mood-mental.tsx) shipping again.

import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_DASHBOARD_TILES,
  KNOWN_LOG_ROUTES,
  findUnresolvableTileRoutes,
} from '../constants/dashboardTiles';

const APP_ROOT = path.join(__dirname, '../..', 'app');

describe('S29-D: Dashboard tile route audit', () => {
  it('every tile route resolves to a file under app/', () => {
    for (const tile of ALL_DASHBOARD_TILES) {
      const filePath = path.join(APP_ROOT, tile.route + '.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('findUnresolvableTileRoutes returns no offenders on a clean tree', () => {
    expect(findUnresolvableTileRoutes()).toEqual([]);
  });

  it('KNOWN_LOG_ROUTES matches the actual app/log/*.tsx files', () => {
    const actual = fs
      .readdirSync(path.join(APP_ROOT, 'log'))
      .filter((f) => f.endsWith('.tsx') && !f.startsWith('_'))
      .map((f) => `/log/${f.replace(/\.tsx$/, '')}`)
      .sort();
    const known = [...KNOWN_LOG_ROUTES].sort();
    expect(known).toEqual(actual);
  });

  it('DailySnapshotCard mood route uses the hyphenated file name', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../components/dashboard/DailySnapshotCard.tsx'),
      'utf-8',
    );
    expect(source).not.toContain("'/log/mood_mental'");
    expect(source).toContain("'/log/mood-mental'");
  });

  it('every route in DailySnapshotCard quickStats resolves to a file', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../components/dashboard/DailySnapshotCard.tsx'),
      'utf-8',
    );
    const matches = source.match(/route:\s*'(\/[^']+)'/g) ?? [];
    const routes = matches
      .map((m) => m.match(/route:\s*'([^']+)'/)?.[1] ?? '')
      .filter(Boolean);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const filePath = path.join(APP_ROOT, route + '.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });
});
