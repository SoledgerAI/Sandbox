// TimestampOverride — Prompt 14: Reusable timestamp override for all log entries
// Wraps the existing TimestampPicker with active-date awareness.
// When backfilling, defaults to the active date with current time.
// Every log screen can import this and use its output as the entry timestamp.

import { useState, useEffect } from 'react';
import { TimestampPicker } from './common/TimestampPicker';
import { getActiveDate } from '../services/dateContextService';

interface TimestampOverrideProps {
  defaultDate?: string;   // YYYY-MM-DD, from getActiveDate() if omitted
  defaultTime?: string;   // HH:MM (24h), uses current time if omitted
  onTimestampChange: (isoString: string) => void;
}

function buildDefaultDate(dateStr: string, timeStr?: string): Date {
  const d = new Date(dateStr + 'T12:00:00');
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    const now = new Date();
    d.setHours(now.getHours(), now.getMinutes(), 0, 0);
  }
  return d;
}

export function TimestampOverride({
  defaultDate,
  defaultTime,
  onTimestampChange,
}: TimestampOverrideProps) {
  const activeDateStr = defaultDate ?? getActiveDate();
  const [value, setValue] = useState(() => buildDefaultDate(activeDateStr, defaultTime));

  // Re-sync when active date changes externally
  useEffect(() => {
    const newDate = buildDefaultDate(activeDateStr, defaultTime);
    setValue(newDate);
    onTimestampChange(newDate.toISOString());
  }, [activeDateStr]);

  const handleChange = (date: Date) => {
    setValue(date);
    onTimestampChange(date.toISOString());
  };

  return <TimestampPicker value={value} onChange={handleChange} />;
}
