// Audit logging for compliance
// Phase 17: Settings and Profile Management
// Per Section 17A: Breach Notification Protocol
//
// Logs data export events, Coach context categories sent, API key lifecycle,
// device connections, data deletion, Health Report generation.
// Append-only. No health data in audit logs, only event metadata.
// Stored in dub.audit.YYYY-MM-DD.
// Audit logs are retained even after "Delete My Data" (disclosed in privacy policy).

import AsyncStorage from '@react-native-async-storage/async-storage';

export type AuditEventType =
  | 'DATA_EXPORT'
  | 'COACH_MESSAGE_SENT'
  | 'API_KEY_CREATED'
  | 'API_KEY_UPDATED'
  | 'API_KEY_DELETED'
  | 'DEVICE_CONNECTED'
  | 'DEVICE_REVOKED'
  | 'DATA_DELETION_INITIATED'
  | 'DATA_DELETION_COMPLETED'
  | 'HEALTH_REPORT_GENERATED'
  | 'DATA_CLEAR_CATEGORY'
  // S34-A: Strava PKCE flow telemetry. STRAVA_REVOKED fires on a 401
  // during refresh (silent disconnect), distinct from DEVICE_REVOKED
  // which fires when the user explicitly disconnects.
  | 'STRAVA_AUTH_INITIATED'
  | 'STRAVA_PKCE_STATE_MISMATCH'
  | 'STRAVA_TOKEN_EXCHANGE_FAILED'
  | 'STRAVA_REFRESH_FAILED'
  | 'STRAVA_REVOKED'
  | 'STRAVA_DEEP_LINK_ERROR';

export interface AuditEntry {
  timestamp: string; // ISO datetime
  event: AuditEventType;
  metadata: Record<string, string | string[] | number | boolean>;
}

function getAuditKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `dub.audit.${yyyy}-${mm}-${dd}`;
}

/**
 * Append an audit entry to today's audit log.
 * Append-only: entries cannot be modified or deleted by the user.
 */
export async function logAuditEvent(
  event: AuditEventType,
  metadata: AuditEntry['metadata'] = {},
): Promise<void> {
  const now = new Date();
  const key = getAuditKey(now);

  const entry: AuditEntry = {
    timestamp: now.toISOString(),
    event,
    metadata,
  };

  try {
    const raw = await AsyncStorage.getItem(key);
    const existing: AuditEntry[] = raw ? JSON.parse(raw) : [];
    existing.push(entry);
    await AsyncStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // Audit logging should never crash the app.
    // In production, this would go to a crash-safe fallback.
  }
}

/**
 * Read audit entries for a specific date.
 */
export async function getAuditEntries(date: Date): Promise<AuditEntry[]> {
  const key = getAuditKey(date);
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * List all audit log keys. Used for compliance review.
 */
export async function listAuditKeys(): Promise<string[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys.filter((k) => k.startsWith('dub.audit.')).sort();
  } catch {
    return [];
  }
}
