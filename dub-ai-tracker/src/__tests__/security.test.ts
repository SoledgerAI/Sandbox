// Security tests: audit logging + API key storage

import { logAuditEvent, getAuditEntries, listAuditKeys } from '../utils/audit';

describe('Audit Logging', () => {
  it('captures expected events', async () => {
    await logAuditEvent('DATA_EXPORT', { format: 'json' });
    await logAuditEvent('COACH_MESSAGE_SENT', { categories: ['nutrition'] });

    const entries = await getAuditEntries(new Date());
    expect(entries.length).toBe(2);
    expect(entries[0].event).toBe('DATA_EXPORT');
    expect(entries[1].event).toBe('COACH_MESSAGE_SENT');
  });

  it('timestamps are ISO 8601 format', async () => {
    await logAuditEvent('API_KEY_CREATED', {});

    const entries = await getAuditEntries(new Date());
    expect(entries.length).toBeGreaterThan(0);

    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    expect(entries[0].timestamp).toMatch(isoRegex);
  });

  it('listAuditKeys returns audit key list', async () => {
    await logAuditEvent('DATA_DELETION_INITIATED', {});

    const keys = await listAuditKeys();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k: string) => k.startsWith('dub.audit.'))).toBe(true);
  });
});

describe('API Key Security', () => {
  it('anthropic.ts imports expo-secure-store (not AsyncStorage for key)', async () => {
    // Read the source file content to verify imports
    // We check that the service uses SecureStore for API key management
    const { getApiKey, setApiKey, deleteApiKey } = require('../services/anthropic');

    // These functions should use SecureStore (mocked)
    const SecureStore = require('expo-secure-store');

    await setApiKey('sk-ant-api03-test-key-12345');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('dub_ai_anthropic_api_key', 'sk-ant-api03-test-key-12345');

    await getApiKey();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('dub_ai_anthropic_api_key');

    await deleteApiKey();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('dub_ai_anthropic_api_key');
  });

  it('no API key stored in plain AsyncStorage', async () => {
    // After setting a key via the anthropic service, verify it's NOT in AsyncStorage
    const { setApiKey } = require('../services/anthropic');
    await setApiKey('sk-ant-api03-secret-api-key');

    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const allKeys = await AsyncStorage.getAllKeys();

    // No key in AsyncStorage should contain 'api_key' or 'anthropic'
    const apiKeyInPlainStorage = allKeys.some(
      (k: string) => k.includes('api_key') || k.includes('anthropic')
    );
    expect(apiKeyInPlainStorage).toBe(false);
  });
});
