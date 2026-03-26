import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}

export function ProgressRing({
  progress,
  size = 180,
  strokeWidth = 12,
  label,
  sublabel,
  color = COLORS.accent,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));
  const percentage = Math.round(Math.min(progress, 1) * 100);

  // Color based on progress
  let ringColor = color;
  if (progress >= 0.8) ringColor = COLORS.success;
  else if (progress >= 0.5) ringColor = COLORS.warning;
  else if (progress > 0) ringColor = COLORS.accent;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#333"
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.3}
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={styles.percentage}>{percentage}%</Text>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  percentage: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: '700',
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  sublabel: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
});
