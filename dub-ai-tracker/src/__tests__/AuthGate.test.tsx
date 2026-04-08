// Tests for AuthGate component
// Prompt 01 v2: App Lock & Biometric Authentication

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AuthGate } from '../components/AuthGate';
import * as authService from '../services/authService';
import { Text } from 'react-native';

// Mock PINSetupModal to avoid Modal rendering issues in test
jest.mock('../components/PINSetupModal', () => ({
  PINSetupModal: () => null,
}));

// Mock authService
jest.mock('../services/authService');

const mockAuthService = authService as jest.Mocked<typeof authService>;

function ChildContent() {
  return <Text>App Content</Text>;
}

describe('AuthGate', () => {
  beforeEach(() => {
    mockAuthService.isLockEnabled.mockResolvedValue(false);
    mockAuthService.getAuthMethod.mockResolvedValue('biometric');
    mockAuthService.isBiometricAvailable.mockResolvedValue({
      available: true,
      biometryType: 'Face ID',
    });
  });

  it('renders children when lock is disabled', async () => {
    const { getByText } = render(
      <AuthGate>
        <ChildContent />
      </AuthGate>,
    );

    await waitFor(() => {
      expect(getByText('App Content')).toBeTruthy();
    });
  });

  it('shows lock screen when lock is enabled', async () => {
    mockAuthService.isLockEnabled.mockResolvedValue(true);

    const { getByText, queryByText } = render(
      <AuthGate>
        <ChildContent />
      </AuthGate>,
    );

    await waitFor(() => {
      expect(getByText('DUB_AI')).toBeTruthy();
    });
    // Children always render (lock UI is an overlay), so App Content is in the tree
    expect(queryByText('App Content')).toBeTruthy();
  });

  it('shows PIN view when auth method is pin', async () => {
    mockAuthService.isLockEnabled.mockResolvedValue(true);
    mockAuthService.getAuthMethod.mockResolvedValue('pin');

    const { getByText } = render(
      <AuthGate>
        <ChildContent />
      </AuthGate>,
    );

    await waitFor(() => {
      expect(getByText('Enter your PIN')).toBeTruthy();
    });
  });

  it('shows biometric view with Face ID label', async () => {
    mockAuthService.isLockEnabled.mockResolvedValue(true);
    mockAuthService.getAuthMethod.mockResolvedValue('biometric');

    const { getByText } = render(
      <AuthGate>
        <ChildContent />
      </AuthGate>,
    );

    await waitFor(() => {
      expect(getByText('Tap to unlock')).toBeTruthy();
    });
  });

  it('falls back to PIN view when biometric not available', async () => {
    mockAuthService.isLockEnabled.mockResolvedValue(true);
    mockAuthService.getAuthMethod.mockResolvedValue('biometric');
    mockAuthService.isBiometricAvailable.mockResolvedValue({
      available: false,
      biometryType: null,
    });

    const { getByText } = render(
      <AuthGate>
        <ChildContent />
      </AuthGate>,
    );

    await waitFor(() => {
      expect(getByText('Enter your PIN')).toBeTruthy();
    });
  });
});
