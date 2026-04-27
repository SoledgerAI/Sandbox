// S29-C: Dashboard wires storage subscriptions so a write from any
// surface (Coach DUB, logger, background sync) refreshes the cards.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('S29-C: Dashboard live-refresh wiring', () => {
  it('Home dashboard subscribes via useStorageWatcher', () => {
    const src = read('app/(tabs)/index.tsx');
    expect(src).toContain('useStorageWatcher');
  });

  it('Home dashboard watches today\'s log keys', () => {
    const src = read('app/(tabs)/index.tsx');
    expect(src).toContain('dateKey(STORAGE_KEYS.LOG_FOOD');
    expect(src).toContain('dateKey(STORAGE_KEYS.LOG_BODY');
    expect(src).toContain('dateKey(STORAGE_KEYS.LOG_SLEEP');
  });

  it('Home dashboard re-runs refresh + loadDashboardExtras on change', () => {
    const src = read('app/(tabs)/index.tsx');
    expect(src).toMatch(
      /useStorageWatcher\(watchedKeys,\s*\(\)\s*=>\s*\{[^}]*refresh\(\);[^}]*loadDashboardExtras\(\);[^}]*\}\)/s,
    );
  });

  it('BodyCard subscribes to dub.log.body changes', () => {
    const src = read('src/components/dashboard/BodyCard.tsx');
    expect(src).toContain('useStorageWatcher');
    expect(src).toContain('STORAGE_KEYS.LOG_BODY');
    expect(src).toMatch(/prefix:\s*true/);
  });

  it('DailySnapshotCard re-loads yesterday sleep on change', () => {
    const src = read('src/components/dashboard/DailySnapshotCard.tsx');
    expect(src).toContain('useStorageWatcher');
    expect(src).toContain('yesterdaySleepKey');
  });

  it('pull-to-refresh stays wired on the dashboard', () => {
    const src = read('app/(tabs)/index.tsx');
    expect(src).toContain('RefreshControl');
    expect(src).toContain('onPullRefresh');
  });
});
