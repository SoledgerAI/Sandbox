// Sprint 31 Commit 2: WearableLogger + route + helper tests.

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';

import {
  buildRecoveryToolRequest,
  mintSyntheticToolUseId,
  toCompoundKeyFlags,
  WearableLogger,
} from '../components/logging/WearableLogger';
import type {
  WearableScanData,
  WearableScanResult,
  WearableFieldFlag,
} from '../services/wearableScanService';
import type { ToolUseRequest } from '../types/coach';
import {
  setActiveDate,
  resetToToday,
  getActiveDate,
} from '../services/dateContextService';
import { storageGet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { todayDateString } from '../utils/dayBoundary';

// ---------- Mocks ----------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Stack: { Screen: 'Screen' },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

const mockStripExif = jest.fn(async (uri: string, _q: number) => `${uri}#stripped`);
jest.mock('../utils/imagePrivacy', () => ({
  stripExifMetadata: (uri: string, q: number) => mockStripExif(uri, q),
}));

const mockGetApiKey = jest.fn();
jest.mock('../services/anthropic', () => {
  class MockAnthropicError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, status?: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
      this.name = 'AnthropicError';
    }
  }
  return {
    getApiKey: () => mockGetApiKey(),
    AnthropicError: MockAnthropicError,
  };
});

const mockScanWearable = jest.fn();
jest.mock('../services/wearableScanService', () => ({
  scanWearableScreenshot: (...args: unknown[]) => mockScanWearable(...args),
}));

// ---------- Test data ----------

const fullScanData: WearableScanData = {
  sleep_score: { value: 84, confidence: 'high' },
  sleep_duration_hours: { value: 7.5, confidence: 'high' },
  hrv_ms: { value: 52, confidence: 'medium' },
  body_battery: { value: 78, confidence: 'high' },
  stress_baseline: { value: 25, confidence: 'high' },
  training_readiness: { value: 81, confidence: 'high' },
  vo2_max: { value: 50, confidence: 'high' },
  resting_heart_rate: { value: 58, confidence: 'high' },
  fields_extracted: [
    'sleep_score',
    'sleep_duration_hours',
    'hrv_ms',
    'body_battery',
    'stress_baseline',
    'training_readiness',
    'vo2_max',
    'resting_heart_rate',
  ],
};

function okResult(
  data: WearableScanData = fullScanData,
  fieldFlags?: Record<string, WearableFieldFlag>,
): WearableScanResult {
  return {
    ok: true,
    data,
    usage: { input_tokens: 100, output_tokens: 50 },
    ...(fieldFlags ? { fieldFlags } : {}),
  };
}

// =============================================================
// Helpers — pure unit tests
// =============================================================

describe('mintSyntheticToolUseId', () => {
  it('returns a string starting with toolu_ and 22 chars', () => {
    const id = mintSyntheticToolUseId();
    expect(id.startsWith('toolu_')).toBe(true);
    expect(id.length).toBe('toolu_'.length + 22);
  });

  it('returns unique values across calls', () => {
    const a = mintSyntheticToolUseId();
    const b = mintSyntheticToolUseId();
    expect(a).not.toBe(b);
  });
});

describe('buildRecoveryToolRequest', () => {
  it('flattens WearableField objects to bare numeric values', () => {
    const forDate = new Date('2026-04-26T12:00:00Z');
    const req = buildRecoveryToolRequest(fullScanData, forDate);
    expect(req.name).toBe('log_recovery_metrics');
    expect(req.input.sleep_score).toBe(84);
    expect(req.input.hrv_ms).toBe(52);
    expect(req.input.timestamp).toBe(forDate.toISOString());
    expect(req.input.extraction_source).toBe('wearable_scan');
    expect(req.status).toBe('pending');
    expect(req.tier).toBe('checklist');
  });

  it('omits absent fields entirely (no null / undefined keys)', () => {
    const partial: WearableScanData = {
      sleep_score: { value: 90, confidence: 'high' },
      fields_extracted: ['sleep_score'],
    };
    const req = buildRecoveryToolRequest(partial, new Date('2026-04-26T12:00:00Z'));
    expect(Object.keys(req.input)).toEqual(
      expect.arrayContaining(['sleep_score', 'timestamp', 'extraction_source']),
    );
    expect('hrv_ms' in req.input).toBe(false);
    expect('body_battery' in req.input).toBe(false);
    expect('vo2_max' in req.input).toBe(false);
  });
});

describe('toCompoundKeyFlags', () => {
  it('rewrites bare-key flags to ${toolUseId}.${field} keys', () => {
    const out = toCompoundKeyFlags('toolu_abc', {
      sleep_score: 'low_confidence',
      hrv_ms: 'out_of_range',
    });
    expect(out).toEqual({
      'toolu_abc.sleep_score': 'low_confidence',
      'toolu_abc.hrv_ms': 'out_of_range',
    });
  });

  it('returns an empty object when bareFlags is empty', () => {
    expect(toCompoundKeyFlags('toolu_abc', {})).toEqual({});
  });
});

// =============================================================
// WearableLogger integration
// =============================================================

describe('WearableLogger', () => {
  let alertSpy: jest.SpyInstance;
  let imagePicker: typeof import('expo-image-picker');

  beforeEach(() => {
    mockStripExif.mockClear();
    mockGetApiKey.mockReset();
    mockGetApiKey.mockResolvedValue('sk-ant-test-key');
    mockScanWearable.mockReset();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    resetToToday();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    imagePicker = require('expo-image-picker');
    (imagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (imagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///mock/photo.jpg' }],
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    resetToToday();
  });

  it('renders the Choose Photo button initially', () => {
    const { getByText } = render(<WearableLogger />);
    expect(getByText('Choose Photo')).toBeTruthy();
  });

  it('shows API Key Required Alert when no key is set, never calls scan', async () => {
    mockGetApiKey.mockResolvedValueOnce(null);
    const { getByText } = render(<WearableLogger />);
    fireEvent.press(getByText('Choose Photo'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('API Key Required');
    expect(mockScanWearable).not.toHaveBeenCalled();
  });

  it('runs strip → base64 → scan in order on a successful pick', async () => {
    mockScanWearable.mockResolvedValueOnce(okResult());
    const { getByText } = render(<WearableLogger />);
    await act(async () => {
      fireEvent.press(getByText('Choose Photo'));
    });
    await waitFor(() => expect(mockScanWearable).toHaveBeenCalledTimes(1));
    expect(mockStripExif).toHaveBeenCalledWith('file:///mock/photo.jpg', 0.7);
    const stripCallOrder = mockStripExif.mock.invocationCallOrder[0];
    const scanCallOrder = mockScanWearable.mock.invocationCallOrder[0];
    expect(stripCallOrder).toBeLessThan(scanCallOrder);
  });

  it('populates ToolConfirmationCard with extracted fields', async () => {
    mockScanWearable.mockResolvedValueOnce(okResult());
    const { getByText, queryByText } = render(<WearableLogger />);
    await act(async () => {
      fireEvent.press(getByText('Choose Photo'));
    });
    await waitFor(() => expect(getByText('Confirm what to log')).toBeTruthy());
    expect(getByText('Sleep Score')).toBeTruthy();
    expect(getByText('Hrv Ms')).toBeTruthy();
    expect(queryByText('Choose Photo')).toBeNull();
  });

  it('decorates rows with low-confidence / out-of-range badges via compound-key flags', async () => {
    mockScanWearable.mockResolvedValueOnce(
      okResult(fullScanData, { sleep_score: 'low_confidence', hrv_ms: 'out_of_range' }),
    );
    const { getByText } = render(<WearableLogger />);
    await act(async () => {
      fireEvent.press(getByText('Choose Photo'));
    });
    await waitFor(() => expect(getByText('Confirm what to log')).toBeTruthy());
    expect(getByText('low confidence')).toBeTruthy();
    expect(getByText('out of range')).toBeTruthy();
  });

  it('uses banner-bound active date as the tool input timestamp', async () => {
    setActiveDate('2026-04-20');
    mockScanWearable.mockResolvedValueOnce(okResult({
      sleep_score: { value: 70, confidence: 'high' },
      fields_extracted: ['sleep_score'],
    }));
    const { getByText } = render(<WearableLogger />);
    await act(async () => {
      fireEvent.press(getByText('Choose Photo'));
    });
    await waitFor(() => expect(getByText('Confirm what to log')).toBeTruthy());
    // Trigger Log all and inspect the storage key the executor wrote to.
    fireEvent.press(getByText('Log all'));
    await waitFor(async () => {
      const stored = await storageGet(
        dateKey(STORAGE_KEYS.LOG_RECOVERY_METRICS, '2026-04-20'),
      );
      expect(stored).not.toBeNull();
    });
  });

  it('freezes the timestamp at scan time — banner change after scan does not retroactively update', async () => {
    setActiveDate('2026-04-20');
    mockScanWearable.mockResolvedValueOnce(okResult({
      sleep_score: { value: 70, confidence: 'high' },
      fields_extracted: ['sleep_score'],
    }));
    const { getByText } = render(<WearableLogger />);
    await act(async () => {
      fireEvent.press(getByText('Choose Photo'));
    });
    await waitFor(() => expect(getByText('Confirm what to log')).toBeTruthy());
    // User changes banner date after scan but before tapping Log all.
    setActiveDate('2026-04-15');
    fireEvent.press(getByText('Log all'));
    await waitFor(async () => {
      const storedOriginal = await storageGet<unknown[]>(
        dateKey(STORAGE_KEYS.LOG_RECOVERY_METRICS, '2026-04-20'),
      );
      expect(storedOriginal).not.toBeNull();
      const storedChanged = await storageGet<unknown[]>(
        dateKey(STORAGE_KEYS.LOG_RECOVERY_METRICS, '2026-04-15'),
      );
      expect(storedChanged).toBeNull();
    });
  });

  it('shows Couldn’t-read Alert on scan failure (parse_error)', async () => {
    mockScanWearable.mockResolvedValueOnce({
      ok: false,
      error: 'Could not parse',
      code: 'parse_error',
    });
    const { getByText, queryByText } = render(<WearableLogger />);
    await act(async () => {
      fireEvent.press(getByText('Choose Photo'));
    });
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe("Couldn't read screenshot");
    expect(queryByText('Confirm what to log')).toBeNull();
  });

  it('shows Couldn’t-read Alert when no fields are extracted', async () => {
    mockScanWearable.mockResolvedValueOnce(okResult({ fields_extracted: [] }));
    const { getByText, queryByText } = render(<WearableLogger />);
    await act(async () => {
      fireEvent.press(getByText('Choose Photo'));
    });
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe("Couldn't read screenshot");
    expect(queryByText('Confirm what to log')).toBeNull();
  });

  it('writes through executeToolBatch on Log all and lands the entry under banner-date key', async () => {
    setActiveDate('2026-04-22');
    mockScanWearable.mockResolvedValueOnce(okResult({
      sleep_score: { value: 88, confidence: 'high' },
      hrv_ms: { value: 60, confidence: 'medium' },
      fields_extracted: ['sleep_score', 'hrv_ms'],
    }));
    const { getByText } = render(<WearableLogger />);
    await act(async () => {
      fireEvent.press(getByText('Choose Photo'));
    });
    await waitFor(() => expect(getByText('Confirm what to log')).toBeTruthy());
    fireEvent.press(getByText('Log all'));
    await waitFor(async () => {
      const stored = await storageGet<Array<Record<string, unknown>>>(
        dateKey(STORAGE_KEYS.LOG_RECOVERY_METRICS, '2026-04-22'),
      );
      expect(stored).toHaveLength(1);
      expect(stored![0]).toMatchObject({
        sleep_score: 88,
        hrv_ms: 60,
        date: '2026-04-22',
        extraction_source: 'wearable_scan',
      });
    });
  });
});

// =============================================================
// Route — sets banner date to yesterday on mount
// =============================================================

describe('app/log/wearable.tsx route', () => {
  beforeEach(() => {
    resetToToday();
  });

  afterEach(() => {
    resetToToday();
  });

  it('sets the active date to yesterday on mount when starting from today', () => {
    expect(getActiveDate()).toBe(todayDateString());
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WearableScreen = require('../../app/log/wearable').default;
    render(<WearableScreen />);
    const today = todayDateString();
    expect(getActiveDate()).not.toBe(today);
    // Resolve to a YYYY-MM-DD that is one calendar day before today
    const t = new Date(`${today}T12:00:00`);
    t.setDate(t.getDate() - 1);
    const expectedYesterday = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    expect(getActiveDate()).toBe(expectedYesterday);
  });

  it('does NOT override active date when user arrives already on a non-today date', () => {
    setActiveDate('2026-04-15');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WearableScreen = require('../../app/log/wearable').default;
    render(<WearableScreen />);
    expect(getActiveDate()).toBe('2026-04-15');
  });
});
