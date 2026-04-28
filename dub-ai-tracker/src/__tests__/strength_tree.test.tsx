// S36: Body-region tree picker tests for ExercisePickerTree.
// Tested in isolation (without StrengthLogger / KeyboardAvoidingView)
// because the picker is a pure presentational component — all state is
// owned by callbacks. Mounting the full logger triggers jest-expo's
// Platform-undefined issue with Modal mocks; isolated mounting avoids it.

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ExercisePickerTree } from '../components/logging/ExercisePickerTree';

interface HarnessOpts {
  equipment?: ('bodyweight' | 'dumbbells' | 'barbell' | 'kettlebell' | 'cable' | 'machine' | 'bands' | 'smith' | 'trx' | 'bench')[];
  electedExercises?: string[];
  usageCounts?: Record<string, number>;
  onSelect?: jest.Mock;
  onToggleElection?: jest.Mock;
  onClose?: jest.Mock;
}

function makeHarness(opts: HarnessOpts = {}) {
  const onSelect = opts.onSelect ?? jest.fn();
  const onToggleElection = opts.onToggleElection ?? jest.fn();
  const onClose = opts.onClose ?? jest.fn();
  const rendered = render(
    <ExercisePickerTree
      equipment={opts.equipment ?? ['bodyweight']}
      electedExercises={opts.electedExercises ?? []}
      usageCounts={opts.usageCounts ?? {}}
      onSelect={onSelect}
      onToggleElection={onToggleElection}
      onClose={onClose}
    />,
  );
  return { rendered, onSelect, onToggleElection, onClose };
}

describe('ExercisePickerTree (S36)', () => {
  it('renders all 7 top-level region chips (5 leaves + arms + legs groups)', () => {
    const { rendered } = makeHarness();
    expect(rendered.getByTestId('region-chip-chest')).toBeTruthy();
    expect(rendered.getByTestId('region-chip-back')).toBeTruthy();
    expect(rendered.getByTestId('region-chip-shoulders')).toBeTruthy();
    expect(rendered.getByTestId('region-chip-core')).toBeTruthy();
    expect(rendered.getByTestId('region-chip-full_body')).toBeTruthy();
    expect(rendered.getByTestId('region-group-arms')).toBeTruthy();
    expect(rendered.getByTestId('region-group-legs')).toBeTruthy();
  });

  it('expanding the Arms group reveals the 3 leaf regions', () => {
    const { rendered } = makeHarness();
    fireEvent.press(rendered.getByTestId('region-group-arms'));
    expect(rendered.getByTestId('region-chip-biceps')).toBeTruthy();
    expect(rendered.getByTestId('region-chip-triceps')).toBeTruthy();
    expect(rendered.getByTestId('region-chip-forearms')).toBeTruthy();
  });

  it('tapping a region navigates to its exercise list', () => {
    const { rendered } = makeHarness({ equipment: ['bodyweight', 'dumbbells', 'barbell', 'cable', 'machine', 'smith', 'bench'] });
    fireEvent.press(rendered.getByTestId('region-chip-chest'));
    // After navigating, exercise rows are visible
    expect(rendered.getByTestId('select-push-up')).toBeTruthy();
    expect(rendered.getByTestId('select-barbell-bench-press')).toBeTruthy();
  });

  it('equipment filter hides exercises requiring unowned equipment', () => {
    const { rendered } = makeHarness({ equipment: ['bodyweight'] });
    fireEvent.press(rendered.getByTestId('region-chip-chest'));
    // Push-Up is bodyweight → visible
    expect(rendered.queryByTestId('select-push-up')).toBeTruthy();
    // Smith Bench Press is smith+bench only → hidden until expand
    expect(rendered.queryByTestId('select-smith-bench-press')).toBeNull();
  });

  it('"Show all" expands to the full unfiltered catalog for the region', async () => {
    const { rendered } = makeHarness({ equipment: ['bodyweight'] });
    fireEvent.press(rendered.getByTestId('region-chip-chest'));
    expect(rendered.queryByTestId('select-smith-bench-press')).toBeNull();
    fireEvent.press(rendered.getByTestId('expand-all-btn'));
    await waitFor(() => {
      expect(rendered.getByTestId('select-smith-bench-press')).toBeTruthy();
    });
  });

  it('tapping the elect (star) icon fires onToggleElection with the exercise id', () => {
    const { rendered, onToggleElection } = makeHarness();
    fireEvent.press(rendered.getByTestId('region-chip-chest'));
    fireEvent.press(rendered.getByTestId('elect-push-up'));
    expect(onToggleElection).toHaveBeenCalledWith('push-up');
  });

  it('tapping an exercise fires onSelect with name + catalog id', () => {
    const { rendered, onSelect } = makeHarness();
    fireEvent.press(rendered.getByTestId('region-chip-chest'));
    fireEvent.press(rendered.getByTestId('select-push-up'));
    expect(onSelect).toHaveBeenCalledWith('Push-Up', 'push-up');
  });
});
