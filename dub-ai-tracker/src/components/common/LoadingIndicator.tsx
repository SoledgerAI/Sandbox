import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { FontSize } from '../../constants/typography';

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  label?: string;
  fullScreen?: boolean;
}

const SIZE_MAP = {
  small: 20,
  medium: 36,
  large: 48,
} as const;

export function LoadingIndicator({
  size = 'medium',
  label,
  fullScreen = false,
}: LoadingIndicatorProps) {
  const content = (
    <View style={styles.wrapper}>
      <ActivityIndicator color={Colors.accent} size={SIZE_MAP[size]} />
      {label != null && <Text style={styles.label}>{label}</Text>}
    </View>
  );

  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }

  return content;
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.secondaryText,
    fontSize: FontSize.sm,
    marginTop: 8,
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
