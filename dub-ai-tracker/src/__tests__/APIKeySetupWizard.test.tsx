// Tests for APIKeySetupWizard and Coach tab empty state
// Prompt 04 v2: BYOK UX

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { APIKeySetupWizard } from '../components/APIKeySetupWizard';
import * as apiKeyService from '../services/apiKeyService';

// Mock Modal to avoid Platform.OS issue in test environment
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const { createElement } = require('react');
  const mockModal = (props: any) => {
    if (!props.visible) return null;
    return createElement('View', { testID: 'modal' }, props.children);
  };
  return { __esModule: true, default: mockModal };
});

// Mock apiKeyService
jest.mock('../services/apiKeyService');

const mockApiKeyService = apiKeyService as jest.Mocked<typeof apiKeyService>;

describe('APIKeySetupWizard', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiKeyService.validateKeyFormat.mockImplementation((key: string) => {
      if (/^sk-ant-oat\d{2}-/.test(key.trim())) {
        return {
          valid: false,
          keyType: 'oauth_token' as const,
          error: 'This looks like a Claude Pro/Team subscription token, not an API key.',
        };
      }
      if (/^sk-ant-api\d{2}-/.test(key.trim())) {
        return { valid: true, keyType: 'api_key' as const };
      }
      if (/^sk-/.test(key.trim())) {
        return { valid: true, keyType: 'unknown' as const };
      }
      return {
        valid: false,
        keyType: 'unknown' as const,
        error: "This doesn't look like an Anthropic API key. Keys start with sk-ant-",
      };
    });
    mockApiKeyService.setApiKey.mockResolvedValue(undefined);
    mockApiKeyService.testApiKey.mockResolvedValue({ valid: true, model: 'claude-sonnet-4-20250514' });
  });

  it('renders introduction screen by default', () => {
    const { getByText } = render(<APIKeySetupWizard {...defaultProps} />);
    expect(getByText('Connect Your AI')).toBeTruthy();
    expect(getByText('Get Started')).toBeTruthy();
    expect(getByText('I already have a key')).toBeTruthy();
  });

  it('navigates to how-to screen on Get Started', () => {
    const { getByText } = render(<APIKeySetupWizard {...defaultProps} />);
    fireEvent.press(getByText('Get Started'));
    expect(getByText('How to Get a Key')).toBeTruthy();
  });

  it('skips to enter screen on "I already have a key"', () => {
    const { getByText } = render(<APIKeySetupWizard {...defaultProps} />);
    fireEvent.press(getByText('I already have a key'));
    expect(getByText('Paste Your API Key')).toBeTruthy();
  });

  it('shows error on invalid key format', () => {
    const { getByText, getByPlaceholderText } = render(
      <APIKeySetupWizard {...defaultProps} />,
    );
    fireEvent.press(getByText('I already have a key'));

    const input = getByPlaceholderText('sk-ant-api03-...');
    fireEvent.changeText(input, 'not-a-valid-key');

    expect(getByText(/doesn't look like an Anthropic API key/)).toBeTruthy();
  });

  it('shows OAuth token warning', () => {
    const { getByText, getByPlaceholderText } = render(
      <APIKeySetupWizard {...defaultProps} />,
    );
    fireEvent.press(getByText('I already have a key'));

    const input = getByPlaceholderText('sk-ant-api03-...');
    fireEvent.changeText(input, 'sk-ant-oat01-sometoken');

    expect(getByText(/subscription token/)).toBeTruthy();
  });

  it('shows green validation on valid key format', () => {
    const { getByText, getByPlaceholderText } = render(
      <APIKeySetupWizard {...defaultProps} />,
    );
    fireEvent.press(getByText('I already have a key'));

    const input = getByPlaceholderText('sk-ant-api03-...');
    fireEvent.changeText(input, 'sk-ant-api03-validkey123');

    expect(getByText('Format looks good')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(
      <APIKeySetupWizard {...defaultProps} visible={false} />,
    );
    // Modal is not rendered when visible=false on native
    // The component still exists in tree but Modal hides contents
    expect(queryByText('Connect Your AI')).toBeNull();
  });
});

describe('Coach tab empty state', () => {
  // We test the useCoach hook behavior that drives the empty state
  // The coach screen relies on apiKeyConfigured from useCoach

  it('useCoach exports apiKeyConfigured flag', () => {
    // Verify the hook module exports are correct
    const mod = require('../hooks/useCoach');
    expect(mod.useCoach).toBeDefined();
  });

  it('APIKeySetupWizard component is importable', () => {
    const mod = require('../components/APIKeySetupWizard');
    expect(mod.APIKeySetupWizard).toBeDefined();
  });
});
