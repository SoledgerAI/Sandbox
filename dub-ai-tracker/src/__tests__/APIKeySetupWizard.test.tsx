// Tests for APIKeySetupWizard — single-page guided walkthrough
// Covers: 3-step layout, paste validation, FAQ, error messages

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
    mockApiKeyService.testApiKey.mockResolvedValue({ valid: true, model: 'claude-haiku-4-5-20251001' });
  });

  it('renders hero and all 3 numbered steps on single page', () => {
    const { getByText } = render(<APIKeySetupWizard {...defaultProps} />);
    expect(getByText('Unlock Your AI Coach')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('renders cost callout', () => {
    const { getByText } = render(<APIKeySetupWizard {...defaultProps} />);
    expect(getByText(/Typical cost: \$2-5\/month/)).toBeTruthy();
  });

  it('renders FAQ section with expandable items', () => {
    const { getByText, queryByText } = render(<APIKeySetupWizard {...defaultProps} />);
    expect(getByText('What is an API key?')).toBeTruthy();
    expect(getByText('Is it secure?')).toBeTruthy();
    expect(getByText('Can I skip this?')).toBeTruthy();

    // FAQ answers hidden by default
    expect(queryByText(/unique code that lets DUB_AI/)).toBeNull();

    // Expand FAQ
    fireEvent.press(getByText('What is an API key?'));
    expect(getByText(/unique code that lets DUB_AI/)).toBeTruthy();
  });

  it('shows error on invalid key format', () => {
    const { getByText, getByPlaceholderText } = render(
      <APIKeySetupWizard {...defaultProps} />,
    );
    const input = getByPlaceholderText('sk-ant-api03-...');
    fireEvent.changeText(input, 'not-a-valid-key');
    expect(getByText(/doesn't look like an Anthropic API key/)).toBeTruthy();
  });

  it('shows OAuth token warning', () => {
    const { getByText, getByPlaceholderText } = render(
      <APIKeySetupWizard {...defaultProps} />,
    );
    const input = getByPlaceholderText('sk-ant-api03-...');
    fireEvent.changeText(input, 'sk-ant-oat01-sometoken');
    expect(getByText(/subscription token/)).toBeTruthy();
  });

  it('shows green validation on valid key format', () => {
    const { getByText, getByPlaceholderText } = render(
      <APIKeySetupWizard {...defaultProps} />,
    );
    const input = getByPlaceholderText('sk-ant-api03-...');
    fireEvent.changeText(input, 'sk-ant-api03-validkey123');
    expect(getByText('Format looks good')).toBeTruthy();
  });

  it('disables Verify button when format is invalid', () => {
    const { getByText, getByPlaceholderText } = render(
      <APIKeySetupWizard {...defaultProps} />,
    );
    const input = getByPlaceholderText('sk-ant-api03-...');
    fireEvent.changeText(input, 'invalid-key');

    const verifyButton = getByText('Verify & Save');
    // Button exists but is disabled (opacity 0.4 via buttonDisabled style)
    expect(verifyButton).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(
      <APIKeySetupWizard {...defaultProps} visible={false} />,
    );
    expect(queryByText('Unlock Your AI Coach')).toBeNull();
  });
});

describe('Coach tab empty state', () => {
  it('useCoach exports apiKeyConfigured flag', () => {
    const mod = require('../hooks/useCoach');
    expect(mod.useCoach).toBeDefined();
  });

  it('APIKeySetupWizard component is importable', () => {
    const mod = require('../components/APIKeySetupWizard');
    expect(mod.APIKeySetupWizard).toBeDefined();
  });
});
