// Sprint 31 Commit 2: helpers for the wearable scan route's
// "morning report" date semantics. Recovery scans are taken in
// the morning for the previous night, so the route defaults to
// yesterday and lets the user adjust via DateContextBanner.

/**
 * Returns local-midnight of the day before today. The
 * subtract-24h then normalize-to-midnight pair is correct across
 * DST transitions: subtracting 24h on a spring-forward day
 * yields a Date one hour off, but zeroing the time fields
 * produces the same calendar day either way.
 */
export function computeYesterdayTimestamp(now: Date = new Date()): Date {
  const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "Mon, Apr 26" — used for smoke-test docs and tests. */
export function formatRecoveryDateLabel(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);
}
