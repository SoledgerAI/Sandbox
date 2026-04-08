// Skeleton loading placeholder with animated opacity pulse
// Sprint 4 Fix 9: Replace "Loading..." text in tag cards

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/colors';

interface SkeletonLoaderProps {
  width: number | string;
  height: number;
  borderRadius?: number;
}

export function SkeletonLoader({ width, height, borderRadius = 8 }: SkeletonLoaderProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius, opacity },
      ]}
      testID="skeleton-loader"
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.divider,
  },
});
