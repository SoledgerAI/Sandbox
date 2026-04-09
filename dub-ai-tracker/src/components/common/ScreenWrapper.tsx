// ScreenWrapper: global safe area + status bar protection
// Sprint 8 Fix 2: Ensures status bar area has opaque navy background
// and scrolling content fades smoothly under it.

import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';

interface ScreenWrapperProps {
  children: React.ReactNode;
  /** If true, adds a gradient fade at the top for scroll content */
  scrollFade?: boolean;
}

export default function ScreenWrapper({
  children,
  scrollFade = true,
}: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      {children}
      {scrollFade && (
        <LinearGradient
          colors={[Colors.primaryBackground, 'transparent']}
          style={[styles.fadeOverlay, { height: insets.top + 20 }]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  fadeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
