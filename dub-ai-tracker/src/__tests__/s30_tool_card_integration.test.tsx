// Sprint 30 (T41): integration smoke for ToolConfirmationCard mounted in
// the Coach chat surface. Verifies the JSX wiring only — card internals,
// dispatcher logic, and the hook's batch state machine are covered by
// existing tests (s30_tier_router, s30_multi_tool_loop, etc.).
//
// Why a harness instead of mounting CoachScreen directly:
// CoachScreen lives at app/(tabs)/coach.tsx and pulls in 12+ hooks and
// services (useNetworkStatus, useDailySummary, runPatternEngine, ScreenWrapper,
// expo-router deep-link params, AnthropicConsentModal, etc.) plus a 250-line
// StyleSheet that reads Platform.OS at module load. Under jest-expo's module
// isolation in this file, the global Platform patch from jest.setup.js doesn't
// reach coach.tsx's evaluation context, so importing it throws before any
// test runs. The prompt's fallback guidance ("If the chat screen is hard to
// test in isolation, mirror an existing pattern") authorizes this approach:
// a minimal harness that re-creates the EXACT wiring from coach.tsx (lines
// 402-435) and exercises the same contract — pendingBatch present → card
// mounted, with onLogAll/onCancel routed to confirmBatch/cancelBatch.

import React from 'react';
import { View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ToolConfirmationCard } from '../components/coach/ToolConfirmationCard';
import { useCoach } from '../hooks/useCoach';
import type { ToolUseRequest } from '../types/coach';

// ---------------------------------------------------------------------------
// Mock useCoach so we can drive pendingBatch / confirmBatch / cancelBatch
// directly from each test.
// ---------------------------------------------------------------------------

jest.mock('../hooks/useCoach');

const useCoachMock = useCoach as jest.MockedFunction<typeof useCoach>;

function defaultHookReturn(
  overrides: Partial<ReturnType<typeof useCoach>> = {},
): ReturnType<typeof useCoach> {
  return {
    messages: [],
    loading: false,
    sending: false,
    streaming: false,
    apiKeyConfigured: true,
    error: null,
    tagsLogged: [],
    lastUserMessage: null,
    activeExpert: undefined,
    pendingToolUse: null,
    pendingBatch: null,
    undoableTool: null,
    sendUserMessage: jest.fn(),
    confirmTool: jest.fn(),
    cancelTool: jest.fn(),
    confirmBatch: jest.fn(),
    cancelBatch: jest.fn(),
    undoLastTool: jest.fn(),
    retry: jest.fn(),
    clearHistory: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Harness — mirrors the wiring shape used by app/(tabs)/coach.tsx:
//   const { pendingBatch, confirmBatch, cancelBatch } = useCoach();
//   <FlatList ListFooterComponent={pendingBatch ? <View><ToolConfirmationCard
//     tools={pendingBatch} onLogAll={confirmBatch} onCancel={cancelBatch} /></View> : null} />
// FlatList is dropped here (it isn't part of the contract being tested and
// pulls in VirtualizedList → Platform); the conditional render + prop wiring
// is what this smoke covers. If coach.tsx renames pendingBatch or swaps the
// card's prop names, this harness must be updated to match — that's the
// integration contract.
// ---------------------------------------------------------------------------

function ChatHarness() {
  const { pendingBatch, confirmBatch, cancelBatch } = useCoach();
  return (
    <View>
      {pendingBatch ? (
        <View>
          <ToolConfirmationCard
            tools={pendingBatch}
            onLogAll={confirmBatch}
            onCancel={cancelBatch}
          />
        </View>
      ) : null}
    </View>
  );
}

const sampleBatch: ToolUseRequest[] = [
  {
    toolUseId: 'tu_1',
    name: 'log_drink',
    input: { amount_oz: 8, beverage_type: 'water' },
    status: 'pending',
    tier: 'checklist',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('T41 — ToolConfirmationCard wired into Coach chat', () => {
  it('does NOT render the card when pendingBatch is null', () => {
    useCoachMock.mockReturnValue(defaultHookReturn({ pendingBatch: null }));
    const { queryByText } = render(<ChatHarness />);
    expect(queryByText('Confirm what to log')).toBeNull();
    expect(queryByText('Log all')).toBeNull();
  });

  it('renders the card when pendingBatch is non-null', () => {
    useCoachMock.mockReturnValue(defaultHookReturn({ pendingBatch: sampleBatch }));
    const { getByText } = render(<ChatHarness />);
    expect(getByText('Confirm what to log')).toBeTruthy();
    expect(getByText('Log all')).toBeTruthy();
  });

  it('confirming the batch invokes confirmBatch from the hook', () => {
    const confirmBatch = jest.fn();
    useCoachMock.mockReturnValue(defaultHookReturn({ pendingBatch: sampleBatch, confirmBatch }));
    const { getByText } = render(<ChatHarness />);
    fireEvent.press(getByText('Log all'));
    expect(confirmBatch).toHaveBeenCalledTimes(1);
    // The card filters to checked fields before calling — the arg is an array.
    const arg = confirmBatch.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg.length).toBeGreaterThan(0);
  });

  it('canceling the batch invokes cancelBatch from the hook', () => {
    const cancelBatch = jest.fn();
    useCoachMock.mockReturnValue(defaultHookReturn({ pendingBatch: sampleBatch, cancelBatch }));
    const { getByText } = render(<ChatHarness />);
    fireEvent.press(getByText('Cancel'));
    expect(cancelBatch).toHaveBeenCalledTimes(1);
  });
});
