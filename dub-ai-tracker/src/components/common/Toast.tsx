import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
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

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss?.());
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss, translateY]);

  const handlePress = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss?.());
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: BG_MAP[type], transform: [{ translateY }] },
      ]}
    >
      <Pressable style={styles.content} onPress={handlePress}>
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
