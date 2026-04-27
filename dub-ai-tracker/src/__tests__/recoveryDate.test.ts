// Sprint 31 Commit 2: recoveryDate utility tests.

import {
  computeYesterdayTimestamp,
  formatRecoveryDateLabel,
} from '../utils/recoveryDate';

describe('computeYesterdayTimestamp', () => {
  it('returns local midnight (00:00:00.000)', () => {
    const y = computeYesterdayTimestamp();
    expect(y.getHours()).toBe(0);
    expect(y.getMinutes()).toBe(0);
    expect(y.getSeconds()).toBe(0);
    expect(y.getMilliseconds()).toBe(0);
  });

  it('returns the day before today (calendar day, not 24h)', () => {
    // Inject a known mid-morning local time on a non-DST day.
    const now = new Date(2026, 3, 27, 9, 30, 0); // Mon Apr 27 2026 09:30 local
    const y = computeYesterdayTimestamp(now);
    expect(y.getFullYear()).toBe(2026);
    expect(y.getMonth()).toBe(3); // April
    expect(y.getDate()).toBe(26);
  });

  it('accepts an injected `now` parameter', () => {
    const inject = new Date(2026, 0, 15, 14, 0, 0);
    const y = computeYesterdayTimestamp(inject);
    expect(y.getDate()).toBe(14);
    expect(y.getMonth()).toBe(0);
    expect(y.getFullYear()).toBe(2026);
  });

  it('handles DST spring-forward correctly (US Eastern 2026-03-08)', () => {
    // 2026-03-08 is "spring forward" in US Eastern. Calling
    // computeYesterdayTimestamp at 09:00 on that day must
    // produce 2026-03-07 at local midnight regardless of the
    // 23-hour DST day. The midnight zeroing makes this safe.
    const now = new Date(2026, 2, 8, 9, 0, 0);
    const y = computeYesterdayTimestamp(now);
    expect(y.getDate()).toBe(7);
    expect(y.getMonth()).toBe(2); // March
    expect(y.getHours()).toBe(0);
  });

  it('crosses month boundaries correctly', () => {
    const now = new Date(2026, 4, 1, 8, 0, 0); // May 1
    const y = computeYesterdayTimestamp(now);
    expect(y.getMonth()).toBe(3); // April
    expect(y.getDate()).toBe(30);
  });

  it('crosses year boundaries correctly', () => {
    const now = new Date(2026, 0, 1, 8, 0, 0); // Jan 1
    const y = computeYesterdayTimestamp(now);
    expect(y.getFullYear()).toBe(2025);
    expect(y.getMonth()).toBe(11); // December
    expect(y.getDate()).toBe(31);
  });
});

describe('formatRecoveryDateLabel', () => {
  it('produces "Wkday, Mon DD" format', () => {
    const d = new Date(2026, 3, 26, 0, 0, 0); // Sun Apr 26 2026
    const label = formatRecoveryDateLabel(d);
    expect(label).toMatch(/^[A-Z][a-z]{2,3},?\s+[A-Z][a-z]{2,3}\s+\d{1,2}$/);
    expect(label).toMatch(/Apr/);
    expect(label).toMatch(/26/);
  });

  it('uses single-digit day without padding', () => {
    const d = new Date(2026, 3, 7, 0, 0, 0); // Apr 7 2026
    const label = formatRecoveryDateLabel(d);
    expect(label).toMatch(/\b7\b/);
    expect(label).not.toMatch(/\b07\b/);
  });
});
