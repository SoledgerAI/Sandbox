// Tests for OnboardingGate component
// Prompt 03 v2: Smart Onboarding

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { OnboardingGate } from '../components/OnboardingGate';
import * as onboardingService from '../services/onboardingService';
import { Text } from 'react-native';

// Mock onboardingService
jest.mock('../services/onboardingService');

const mockService = onboardingService as jest.Mocked<typeof onboardingService>;

function ChildContent() {
  return <Text>Main App Content</Text>;
}

// Mock PersonalizationFlow since it's a complex component
jest.mock('../components/PersonalizationFlow', () => ({
  PersonalizationFlow: ({ onComplete }: { onComplete: () => void }) => {
    const { Text, TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity onPress={onComplete} testID="complete-onboarding">
        <Text>Personalization Flow</Text>
      </TouchableOpacity>
    );
  },
}));

describe('OnboardingGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when onboarding is complete', async () => {
    mockService.isOnboardingComplete.mockResolvedValue(true);

    const { getByText } = render(
      <OnboardingGate>
        <ChildContent />
      </OnboardingGate>,
    );

    await waitFor(() => {
      expect(getByText('Main App Content')).toBeTruthy();
    });
  });

  it('renders PersonalizationFlow when onboarding is not complete', async () => {
    mockService.isOnboardingComplete.mockResolvedValue(false);

    const { getByText } = render(
      <OnboardingGate>
        <ChildContent />
      </OnboardingGate>,
    );

    await waitFor(() => {
      expect(getByText('Personalization Flow')).toBeTruthy();
    });
  });

  it('shows loading indicator while checking', () => {
    // Never resolve to keep in loading state
    mockService.isOnboardingComplete.mockReturnValue(new Promise(() => {}));

    const { queryByText } = render(
      <OnboardingGate>
        <ChildContent />
      </OnboardingGate>,
    );

    expect(queryByText('Main App Content')).toBeNull();
    expect(queryByText('Personalization Flow')).toBeNull();
  });

  it('transitions to children after onboarding completes', async () => {
    mockService.isOnboardingComplete.mockResolvedValue(false);

    const { getByText, getByTestId, queryByText } = render(
      <OnboardingGate>
        <ChildContent />
      </OnboardingGate>,
    );

    await waitFor(() => {
      expect(getByText('Personalization Flow')).toBeTruthy();
    });

    // Simulate completing onboarding
    const { fireEvent } = require('@testing-library/react-native');
    fireEvent.press(getByTestId('complete-onboarding'));

    await waitFor(() => {
      expect(getByText('Main App Content')).toBeTruthy();
      expect(queryByText('Personalization Flow')).toBeNull();
    });
  });
});
