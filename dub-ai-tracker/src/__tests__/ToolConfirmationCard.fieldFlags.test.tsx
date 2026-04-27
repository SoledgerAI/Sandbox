// Sprint 31: ToolConfirmationCard fieldFlags prop tests.
// Verifies the optional fieldFlags map decorates rows without disturbing
// the existing check / edit / cancel behavior.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ToolConfirmationCard } from '../components/coach/ToolConfirmationCard';
import type { ToolUseRequest } from '../types/coach';

const recoveryTool: ToolUseRequest = {
  toolUseId: 'toolu_abc123',
  name: 'log_body_composition', // existing tool name; recovery tool comes later in the build
  input: {
    body_fat_pct: 22,
    skeletal_muscle_lbs: 76,
    bmi: 26,
  },
  status: 'pending',
  tier: 'checklist',
};

const secondTool: ToolUseRequest = {
  toolUseId: 'toolu_def456',
  name: 'log_weight',
  input: { weight_lbs: 195 },
  status: 'pending',
  tier: 'checklist',
};

describe('ToolConfirmationCard — fieldFlags (Sprint 31)', () => {
  it('renders identically when fieldFlags is undefined (regression guard)', () => {
    const { queryByText, getByText } = render(
      <ToolConfirmationCard
        tools={[recoveryTool]}
        onLogAll={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText('Body Fat Pct')).toBeTruthy();
    expect(queryByText('low confidence')).toBeNull();
    expect(queryByText('out of range')).toBeNull();
  });

  it("renders the 'low confidence' badge for a matched field", () => {
    const { getByText } = render(
      <ToolConfirmationCard
        tools={[recoveryTool]}
        onLogAll={jest.fn()}
        onCancel={jest.fn()}
        fieldFlags={{ 'toolu_abc123.body_fat_pct': 'low_confidence' }}
      />,
    );
    expect(getByText('low confidence')).toBeTruthy();
  });

  it("renders the 'out of range' badge for a matched field", () => {
    const { getByText } = render(
      <ToolConfirmationCard
        tools={[recoveryTool]}
        onLogAll={jest.fn()}
        onCancel={jest.fn()}
        fieldFlags={{ 'toolu_abc123.bmi': 'out_of_range' }}
      />,
    );
    expect(getByText('out of range')).toBeTruthy();
  });

  it('renders multiple flags across multiple tools correctly', () => {
    const { queryAllByText } = render(
      <ToolConfirmationCard
        tools={[recoveryTool, secondTool]}
        onLogAll={jest.fn()}
        onCancel={jest.fn()}
        fieldFlags={{
          'toolu_abc123.body_fat_pct': 'low_confidence',
          'toolu_abc123.bmi': 'out_of_range',
          'toolu_def456.weight_lbs': 'low_confidence',
        }}
      />,
    );
    expect(queryAllByText('low confidence')).toHaveLength(2);
    expect(queryAllByText('out of range')).toHaveLength(1);
  });

  it('flag presence does NOT change check or edit behavior', () => {
    const onLogAll = jest.fn();
    const { getByText } = render(
      <ToolConfirmationCard
        tools={[recoveryTool]}
        onLogAll={onLogAll}
        onCancel={jest.fn()}
        fieldFlags={{ 'toolu_abc123.body_fat_pct': 'low_confidence' }}
      />,
    );

    // Pressing "Log all" still produces the full tool batch with all fields
    // checked by default — the badge is purely cosmetic.
    fireEvent.press(getByText('Log all'));
    expect(onLogAll).toHaveBeenCalledTimes(1);
    const arg = onLogAll.mock.calls[0][0] as ToolUseRequest[];
    expect(arg).toHaveLength(1);
    expect(arg[0].input).toMatchObject({
      body_fat_pct: 22,
      skeletal_muscle_lbs: 76,
      bmi: 26,
    });
  });
});
