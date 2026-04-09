// Premium button component with gold gradient styling
// Sprint 15: Global UI Polish — Premium Finish

import { useCallback, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { hapticLight, hapticMedium, hapticSelection } from '../../utils/haptics';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
type ButtonSize = 'large' | 'medium' | 'small';

interface PremiumButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}

const SIZE_CONFIG = {
  large: { height: 52, fontSize: 16, paddingH: 24, borderRadius: 12 },
  medium: { height: 48, fontSize: 15, paddingH: 20, borderRadius: 12 },
  small: { height: 40, fontSize: 14, paddingH: 16, borderRadius: 8 },
} as const;

export function PremiumButton({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  loading = false,
}: PremiumButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sizeConfig = SIZE_CONFIG[size];

  const handlePressIn = useCallback(() => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [disabled, loading, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (variant === 'primary') hapticMedium();
    else if (variant === 'secondary') hapticLight();
    else hapticSelection();
    onPress();
  }, [disabled, loading, variant, onPress]);

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.primaryBackground : Colors.accent}
          size="small"
        />
      );
    }
    return (
      <View style={styles.contentRow}>
        {icon && <View style={styles.iconWrap}>{icon}</View>}
        <Text
          style={[
            styles.label,
            { fontSize: sizeConfig.fontSize },
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'outline' && styles.outlineLabel,
            variant === 'danger' && styles.dangerLabel,
          ]}
        >
          {label}
        </Text>
      </View>
    );
  };

  const containerStyle = [
    styles.base,
    {
      height: sizeConfig.height,
      paddingHorizontal: sizeConfig.paddingH,
      borderRadius: sizeConfig.borderRadius,
    },
    variant === 'secondary' && styles.secondary,
    variant === 'outline' && [styles.outline, { borderRadius: sizeConfig.borderRadius }],
    variant === 'danger' && styles.danger,
    disabled && styles.disabled,
  ];

  if (variant === 'primary') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          activeOpacity={1}
        >
          <LinearGradient
            colors={disabled ? ['#8A7A4A', '#7A6A3A'] : ['#D4A843', '#B8922F']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              styles.base,
              styles.primaryGradient,
              {
                height: sizeConfig.height,
                paddingHorizontal: sizeConfig.paddingH,
                borderRadius: sizeConfig.borderRadius,
              },
              disabled && styles.disabled,
            ]}
          >
            {renderContent()}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={containerStyle}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.7}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Pill/tag button for multi-select options */
export function PremiumPill({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const handlePress = useCallback(() => {
    if (disabled) return;
    hapticSelection();
    onPress();
  }, [disabled, onPress]);

  if (selected) {
    return (
      <TouchableOpacity onPress={handlePress} disabled={disabled} activeOpacity={0.7}>
        <LinearGradient
          colors={['#D4A843', '#B8922F']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.pill, styles.pillSelected, disabled && styles.disabled]}
        >
          <Text style={styles.pillSelectedText}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.pill, styles.pillUnselected, disabled && styles.disabled]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={styles.pillUnselectedText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    marginRight: 2,
  },
  label: {
    fontWeight: '700',
  },
  // Primary
  primaryGradient: {
    borderWidth: 1,
    borderColor: '#E8C25C',
    shadowColor: '#D4A843',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryLabel: {
    color: Colors.primaryBackground,
  },
  // Secondary
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  secondaryLabel: {
    color: Colors.accent,
    fontWeight: '600',
  },
  // Outline
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.3)',
  },
  outlineLabel: {
    color: '#C0C8D8',
    fontWeight: '500',
  },
  // Danger
  danger: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#FF4444',
  },
  dangerLabel: {
    color: '#FF4444',
    fontWeight: '600',
  },
  // Disabled
  disabled: {
    opacity: 0.4,
  },
  // Pill / Tag styles
  pill: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    shadowColor: '#D4A843',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  pillSelectedText: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: '600',
  },
  pillUnselected: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.2)',
  },
  pillUnselectedText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});
