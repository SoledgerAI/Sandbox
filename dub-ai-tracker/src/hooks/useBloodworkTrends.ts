// Bloodwork trending hook -- extract time series for a given marker
// Task 17: Bloodwork Trending + ApoB Marker

import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageList, STORAGE_KEYS } from '../utils/storage';
import type { BloodworkEntry } from '../types';

export interface BloodworkTrendPoint {
  date: string;       // ISO date
  value: number;      // marker value
  unit: string;       // mg/dL, nmol/L, etc.
  flagged: boolean;   // out of reference range
}

export interface BloodworkTrendData {
  markerName: string;
  unit: string;
  dataPoints: BloodworkTrendPoint[];
  referenceLow: number | null;
  referenceHigh: number | null;
}

export interface BloodworkMarkerSummary {
  name: string;
  unit: string;
  latestValue: number;
  latestDate: string;
  previousValue: number | null;
  direction: 'up' | 'down' | 'stable';
  dataPointCount: number;
  referenceLow: number | null;
  referenceHigh: number | null;
  flagged: boolean;
}

/**
 * Get trend data for a specific bloodwork marker across all dates.
 */
export function useBloodworkTrends(
  markerName: string | null,
  dateRange?: { start: string; end: string },
): { data: BloodworkTrendData | null; loading: boolean } {
  const [data, setData] = useState<BloodworkTrendData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!markerName) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const keys = await storageList(STORAGE_KEYS.LOG_BLOODWORK + '.');
      const sorted = keys.sort();

      const points: BloodworkTrendPoint[] = [];
      let unit = '';
      let refLow: number | null = null;
      let refHigh: number | null = null;

      for (const key of sorted) {
        const dateStr = key.replace(STORAGE_KEYS.LOG_BLOODWORK + '.', '');
        if (dateRange) {
          if (dateStr < dateRange.start || dateStr > dateRange.end) continue;
        }

        const entry = await storageGet<BloodworkEntry>(key);
        if (!entry) continue;

        const marker = entry.markers.find((m) => m.name === markerName);
        if (!marker) continue;

        unit = marker.unit;
        refLow = marker.reference_range_low;
        refHigh = marker.reference_range_high;

        points.push({
          date: dateStr,
          value: marker.value,
          unit: marker.unit,
          flagged: marker.flagged,
        });
      }

      if (points.length === 0) {
        setData(null);
      } else {
        setData({
          markerName,
          unit,
          dataPoints: points,
          referenceLow: refLow,
          referenceHigh: refHigh,
        });
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [markerName, dateRange?.start, dateRange?.end]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading };
}

/**
 * Get summary of all bloodwork markers that have 2+ data points (trendable).
 */
export function useBloodworkSummaries(): {
  summaries: BloodworkMarkerSummary[];
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [summaries, setSummaries] = useState<BloodworkMarkerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const keys = await storageList(STORAGE_KEYS.LOG_BLOODWORK + '.');
      const sorted = keys.sort();

      // Collect all values per marker: { name => { date, value, unit, flagged, refLow, refHigh }[] }
      const markerData = new Map<
        string,
        Array<{
          date: string;
          value: number;
          unit: string;
          flagged: boolean;
          refLow: number | null;
          refHigh: number | null;
        }>
      >();

      for (const key of sorted) {
        const dateStr = key.replace(STORAGE_KEYS.LOG_BLOODWORK + '.', '');
        const entry = await storageGet<BloodworkEntry>(key);
        if (!entry) continue;

        for (const marker of entry.markers) {
          const existing = markerData.get(marker.name) ?? [];
          existing.push({
            date: dateStr,
            value: marker.value,
            unit: marker.unit,
            flagged: marker.flagged,
            refLow: marker.reference_range_low,
            refHigh: marker.reference_range_high,
          });
          markerData.set(marker.name, existing);
        }
      }

      // Filter to markers with 2+ data points
      const result: BloodworkMarkerSummary[] = [];
      for (const [name, points] of markerData) {
        if (points.length < 2) continue;

        const latest = points[points.length - 1];
        const previous = points[points.length - 2];
        const diff = latest.value - previous.value;
        const direction: 'up' | 'down' | 'stable' =
          Math.abs(diff) < 0.01 ? 'stable' : diff > 0 ? 'up' : 'down';

        result.push({
          name,
          unit: latest.unit,
          latestValue: latest.value,
          latestDate: latest.date,
          previousValue: previous.value,
          direction,
          dataPointCount: points.length,
          referenceLow: latest.refLow,
          referenceHigh: latest.refHigh,
          flagged: latest.flagged,
        });
      }

      setSummaries(result);
    } catch {
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { summaries, loading, reload: loadData };
}
