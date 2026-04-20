// P1-22: Slim offline banner — auto-appears/disappears on connectivity change

import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

// Bug #2: Network-heavy operations (food scan, image upload) cause momentary
// NetInfo blips that falsely trigger the offline banner. Debounce 2s and
// re-verify with NetInfo.fetch() before declaring the user offline.
const OFFLINE_DEBOUNCE_MS = 2000;

/**
 * Renders a slim banner at the top of the screen when the device is offline.
 * Slides in/out with a 300ms animation.
 */
export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const rawOffline = !isConnected || isInternetReachable === false;

  const [confirmedOffline, setConfirmedOffline] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!rawOffline) {
      setConfirmedOffline(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      NetInfo.fetch().then((state) => {
        const stillOffline =
          !(state.isConnected ?? true) || state.isInternetReachable === false;
        setConfirmedOffline(stillOffline);
      });
    }, OFFLINE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [rawOffline]);

  const offline = confirmedOffline;

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: offline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [offline, slideAnim]);

  // Keep in the tree but translate off-screen when connected
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 0],
  });

  return (
    <Animated.View
      style={[
        styles.banner,
        { transform: [{ translateY }], opacity: slideAnim },
      ]}
      pointerEvents={offline ? 'auto' : 'none'}
    >
      <Ionicons name="cloud-offline-outline" size={14} color={Colors.text} />
      <Text style={styles.text}>You're offline — data saved locally. AI Coach unavailable until reconnected.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: Colors.danger,
  },
  text: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
