import { useEffect, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  /** When true, toast animates out. Unmount is handled by the parent. */
  dismissing: boolean;
  /** Called on tap or swipe-up to request dismissal from parent. */
  onDismiss?: () => void;
}

const ICON_MAP: Record<ToastType, React.ComponentProps<typeof Ionicons>['name']> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const BG_MAP: Record<ToastType, string> = {
  success: '#4CAF50',
  error: Colors.dangerText,
  info: Colors.cardBackground,
};

const SLIDE_DURATION = 280;
const OFFSCREEN_Y = -140;
const SWIPE_DISMISS_THRESHOLD = -30;

export function Toast({
  message,
  type = 'info',
  dismissing,
  onDismiss,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(OFFSCREEN_Y)).current;

  // Slide in on mount.
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: SLIDE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  // TF-03: slide out when parent sets dismissing=true. The parent owns the
  // unmount timer, so we don't rely on the animation callback firing — we
  // just trigger the visual transition.
  useEffect(() => {
    if (dismissing) {
      Animated.timing(translateY, {
        toValue: OFFSCREEN_Y,
        duration: SLIDE_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [dismissing, translateY]);

  // TF-03 bonus: swipe-up to dismiss.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) {
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < SWIPE_DISMISS_THRESHOLD) {
          onDismiss?.();
        } else {
          Animated.timing(translateY, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.timing(translateY, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: BG_MAP[type], transform: [{ translateY }] },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable
        style={styles.content}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        accessibilityHint="Tap or swipe up to dismiss"
      >
        <Ionicons name={ICON_MAP[type]} size={20} color="#FFFFFF" />
        <Text style={styles.message}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
