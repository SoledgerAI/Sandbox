// S29-B: Recovery card deep-links to a Recovery screen, not the
// Body Metrics screen. A new app/recovery.tsx aggregates yesterday's
// sleep + today's mood/stress.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('S29-B: Recovery card navigation', () => {
  it('app/recovery.tsx exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'app/recovery.tsx'))).toBe(true);
  });

  it('RecoveryCard insufficient-data tap routes to /recovery', () => {
    const src = read('src/components/dashboard/RecoveryCard.tsx');
    expect(src).toContain("router.push('/recovery')");
    expect(src).not.toMatch(/router\.push\(['"]\/log\/body-measurements['"]\)/);
  });

  it('RecoveryCard does not navigate to Body Metrics anywhere', () => {
    const src = read('src/components/dashboard/RecoveryCard.tsx');
    expect(src).not.toContain('/log/body-measurements');
    expect(src).not.toContain('/log/body');
  });

  it('Recovery screen surfaces sleep, mood, and stress with empty-state prompts', () => {
    const src = read('app/recovery.tsx');
    expect(src).toContain('LOG_SLEEP');
    expect(src).toContain('LOG_MOOD');
    expect(src).toContain('LOG_STRESS');
    expect(src).toContain("Log last night's sleep");
  });

  it('Recovery screen uses yesterday for sleep, today for mood/stress', () => {
    const src = read('app/recovery.tsx');
    expect(src).toContain('yesterdayDateString');
    expect(src).toContain('todayDateString');
  });
});
