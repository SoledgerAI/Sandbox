// ATT (App Tracking Transparency) utility for marketplace affiliate tracking
// MASTER-42: Must request tracking permission before logging affiliate clicks
// If denied, products still show but click-through events are not recorded

import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';

let cachedStatus: 'granted' | 'denied' | 'undetermined' = 'undetermined';

export async function requestTrackingPermission(): Promise<boolean> {
  try {
    const { status } = await requestTrackingPermissionsAsync();
    cachedStatus = status === 'granted' ? 'granted' : 'denied';
    return cachedStatus === 'granted';
  } catch {
    // On Android or unsupported platforms, allow tracking by default
    cachedStatus = 'granted';
    return true;
  }
}

export async function isTrackingAllowed(): Promise<boolean> {
  if (cachedStatus !== 'undetermined') {
    return cachedStatus === 'granted';
  }
  try {
    const { status } = await getTrackingPermissionsAsync();
    if (status === 'undetermined') return false; // Not yet asked — don't track
    cachedStatus = status === 'granted' ? 'granted' : 'denied';
    return cachedStatus === 'granted';
  } catch {
    return true; // Non-iOS platforms
  }
}
