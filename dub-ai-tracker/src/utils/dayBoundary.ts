// Day boundary utility — standard calendar day (midnight to midnight)
// F-08: "Day Starts At" removed. All dates use local midnight boundary.

/**
 * Returns today's date string (YYYY-MM-DD) in local time.
 * Always uses standard calendar day (midnight boundary).
 */
export function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
