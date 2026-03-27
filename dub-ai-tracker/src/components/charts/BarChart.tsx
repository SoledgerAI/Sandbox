// Interactive bar chart with optional goal line
// Phase 16: Trends and Charts

import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  G,
  Rect as SvgRect,
} from 'react-native-svg';
import { Colors } from '../../constants/colors';
import {
  ChartDataPoint,
  TooltipData,
  computeYTicks,
  formatTickValue,
  getChartArea,
  scaleY,
} from './types';

interface BarChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  title: string;
  unit?: string;
  color?: string;
  goalValue?: number;
  goalLabel?: string;
  thumbnail?: boolean;
}

export function BarChart({
  data,
  width = 340,
  height = 200,
  title,
  unit = '',
  color = Colors.accent,
  goalValue,
  goalLabel,
  thumbnail = false,
}: BarChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: Colors.secondaryText, fontSize: 12 }}>No data</Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, goalValue ?? 0);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  if (thumbnail) {
    return <ThumbnailBar data={data} width={width} height={height} title={title} color={color} maxVal={maxVal} />;
  }

  const padding = { top: 16, bottom: 28, left: 44, right: 12 };
  const { chartW, chartH } = getChartArea({ width, height, padding });
  const yTicks = computeYTicks(minVal, maxVal);

  const barGap = 2;
  const barWidth = Math.max(2, (chartW - barGap * data.length) / data.length);
  const toY = (val: number) => scaleY(val, minVal, range, chartH, padding.top);
  const baseY = toY(0);

  const handlePress = (point: ChartDataPoint, x: number) => {
    setTooltip({
      x,
      y: toY(point.value) - 8,
      label: point.label,
      value: `${point.value.toFixed(1)}${unit ? ' ' + unit : ''}`,
    });
  };

  const accessLabel = `${title} bar chart. ${data.length} bars. Latest value: ${values[values.length - 1]?.toFixed(1) ?? 'no data'}${unit ? ' ' + unit : ''}`;

  if (showTable) {
    return (
      <View accessible accessibilityLabel={`${title} data table`}>
        <Pressable onPress={() => setShowTable(false)} style={styles.tableToggle} hitSlop={8}>
          <Text style={styles.tableToggleText}>View as chart</Text>
        </Pressable>
        {data.map((point, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.tableCell}>{point.label}</Text>
            <Text style={styles.tableCell}>{point.value.toFixed(1)}{unit ? ' ' + unit : ''}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Pressable onPress={() => setShowTable(true)} style={styles.tableToggle} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="View as table">
          <Text style={styles.tableToggleText}>View as table</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => setTooltip(null)} accessibilityLabel={accessLabel}>
        <Svg width={width} height={height}>
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <Line
              key={`g-${i}`}
              x1={padding.left}
              y1={toY(tick)}
              x2={width - padding.right}
              y2={toY(tick)}
              stroke={Colors.divider}
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick, i) => (
            <SvgText
              key={`y-${i}`}
              x={padding.left - 6}
              y={toY(tick) + 4}
              fill={Colors.secondaryText}
              fontSize={10}
              textAnchor="end"
            >
              {formatTickValue(tick)}
            </SvgText>
          ))}

          {/* Bars */}
          {data.map((point, i) => {
            const x = padding.left + i * (barWidth + barGap) + barGap / 2;
            const barH = Math.max(1, baseY - toY(point.value));
            return (
              <Rect
                key={i}
                x={x}
                y={toY(point.value)}
                width={barWidth}
                height={barH}
                rx={2}
                fill={color}
                opacity={0.85}
                onPress={() => handlePress(point, x + barWidth / 2)}
              />
            );
          })}

          {/* X-axis labels */}
          {data.map((point, i) => {
            const x = padding.left + i * (barWidth + barGap) + barWidth / 2;
            const showLabel = data.length <= 7 || i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2);
            if (!showLabel) return null;
            return (
              <SvgText
                key={`x-${i}`}
                x={x}
                y={height - 6}
                fill={Colors.secondaryText}
                fontSize={9}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            );
          })}

          {/* Goal line */}
          {goalValue != null && (
            <G>
              <Line
                x1={padding.left}
                y1={toY(goalValue)}
                x2={width - padding.right}
                y2={toY(goalValue)}
                stroke={Colors.success}
                strokeWidth={1.5}
                strokeDasharray="6,3"
              />
              {goalLabel && (
                <SvgText
                  x={width - padding.right}
                  y={toY(goalValue) - 4}
                  fill={Colors.success}
                  fontSize={9}
                  textAnchor="end"
                >
                  {goalLabel}
                </SvgText>
              )}
            </G>
          )}

          {/* Tooltip */}
          {tooltip && (
            <G>
              <SvgRect
                x={Math.min(tooltip.x - 40, width - 90)}
                y={tooltip.y - 36}
                width={80}
                height={28}
                rx={4}
                fill={Colors.cardBackground}
                stroke={Colors.accent}
                strokeWidth={0.5}
              />
              <SvgText
                x={Math.min(tooltip.x, width - 50)}
                y={tooltip.y - 23}
                fill={Colors.text}
                fontSize={10}
                textAnchor="middle"
              >
                {tooltip.label}
              </SvgText>
              <SvgText
                x={Math.min(tooltip.x, width - 50)}
                y={tooltip.y - 12}
                fill={Colors.accent}
                fontSize={11}
                fontWeight="bold"
                textAnchor="middle"
              >
                {tooltip.value}
              </SvgText>
            </G>
          )}
        </Svg>
      </Pressable>
    </View>
  );
}

function ThumbnailBar({
  data,
  width,
  height,
  title,
  color,
  maxVal,
}: {
  data: ChartDataPoint[];
  width: number;
  height: number;
  title: string;
  color: string;
  maxVal: number;
}) {
  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const barGap = 1;
  const barWidth = Math.max(1, (chartW - barGap * data.length) / data.length);
  const last = data[data.length - 1];

  return (
    <View accessibilityLabel={`${title} sparkline. Latest: ${last?.value.toFixed(1) ?? 'no data'}`}>
      <Svg width={width} height={height}>
        {data.map((point, i) => {
          const x = padding + i * (barWidth + barGap);
          const barH = Math.max(1, (point.value / (maxVal || 1)) * chartH);
          return (
            <Rect
              key={i}
              x={x}
              y={padding + chartH - barH}
              width={barWidth}
              height={barH}
              fill={color}
              opacity={0.8}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  tableToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  tableToggleText: {
    color: Colors.accent,
    fontSize: 11,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  tableCell: {
    flex: 1,
    color: Colors.secondaryText,
    fontSize: 11,
  },
});
