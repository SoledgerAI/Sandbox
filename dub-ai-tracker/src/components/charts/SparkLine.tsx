// Mini 7-day sparkline chart
// Phase 5: Dashboard Layout

import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle as SvgCircle } from 'react-native-svg';
import { Colors } from '../../constants/colors';

interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function SparkLine({
  data,
  width = 80,
  height = 30,
  color = Colors.accent,
}: SparkLineProps) {
  if (data.length === 0) {
    return <View style={{ width, height }} />;
  }

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const lastPoint = data[data.length - 1];
  const lastX = padding + ((data.length - 1) / Math.max(data.length - 1, 1)) * chartWidth;
  const lastY = padding + chartHeight - ((lastPoint - min) / range) * chartHeight;

  return (
    <View
      accessibilityLabel={`Sparkline chart. ${data.length} data points. Latest value: ${lastPoint}`}
    >
      <Svg width={width} height={height}>
        <Polyline
          points={points.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <SvgCircle cx={lastX} cy={lastY} r={2.5} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({});
