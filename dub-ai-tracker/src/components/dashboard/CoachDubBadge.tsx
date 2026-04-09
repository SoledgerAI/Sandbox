// Coach DUB Active badge — Dashboard quick-access entry point
// Sprint 15: Coach DUB Badge

import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { hapticLight } from '../../utils/haptics';
import { isApiKeySet } from '../../services/apiKeyService';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

export function CoachDubBadge() {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    isApiKeySet().then(setHasKey);
  }, []);

  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const handlePress = () => {
    hapticLight();
    if (hasKey) {
      router.push('/(tabs)/coach');
    } else {
      router.push('/settings/apikey');
    }
  };

  return (
    <TouchableOpacity
      style={styles.badge}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.pulseDot, pulseStyle]} />
      <Text style={styles.badgeText}>
        {hasKey ? 'Coach DUB' : 'Set Up Coach'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.15)',
    borderRadius: 20,
    height: 32,
    paddingHorizontal: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  badgeText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
});
