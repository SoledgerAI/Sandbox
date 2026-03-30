// Interactive line chart with optional YoY overlay
// Phase 16: Trends and Charts

import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, {
  Polyline,
  Circle as SvgCircle,
  Line,
  Text as SvgText,
  G,
  Rect,
} from 'react-native-svg';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import {
  ChartSeries,
  TooltipData,
  computeYTicks,
  formatTickValue,
  getChartArea,
  scaleX,
  scaleY,
} from './types';

interface LineChartProps {
  series: ChartSeries[];
  width?: number;
  height?: number;
  title: string;
  unit?: string;
  thresholdValue?: number;
  thresholdLabel?: string;
  showDots?: boolean;
  thumbnail?: boolean;
}

export function LineChart({
  series,
  width = 340,
  height = 200,
  title,
  unit = '',
  thresholdValue,
  thresholdLabel,
  showDots = true,
  thumbnail = false,
}: LineChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [showTable, setShowTable] = useState(false);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
  }, [series]);

  if (thumbnail) {
    return <ThumbnailLine series={series} width={width} height={height} title={title} />;
  }

  const allValues = series.flatMap((s) => s.data.map((d) => d.value));
  if (thresholdValue != null) allValues.push(thresholdValue);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const padding = { top: 16, bottom: 28, left: 44, right: 12 };
  const { chartW, chartH } = getChartArea({ width, height, padding });
  const yTicks = computeYTicks(minVal, maxVal);

  const toX = (i: number, count: number) => scaleX(i, count, chartW, padding.left);
  const toY = (val: number) => scaleY(val, minVal, range, chartH, padding.top);

  const handlePress = (point: { x: number; y: number; label: string; value: number }, seriesLabel: string) => {
    setTooltip({
      x: point.x,
      y: point.y,
      label: point.label,
      value: `${point.value.toFixed(1)}${unit ? ' ' + unit : ''}`,
      seriesLabel,
    });
  };

  const accessLabel = `${title} line chart. ${series.map((s) => {
    const last = s.data[s.data.length - 1];
    return `${s.label}: latest value ${last?.value.toFixed(1) ?? 'no data'}${unit ? ' ' + unit : ''}`;
  }).join('. ')}`;

  if (showTable) {
    return (
      <View accessible accessibilityLabel={`${title} data table`}>
        <Pressable onPress={() => setShowTable(false)} style={styles.tableToggle} hitSlop={8}>
          <Text style={styles.tableToggleText}>View as chart</Text>
        </Pressable>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Date</Text>
          {series.map((s) => (
            <Text key={s.label} style={[styles.tableCell, styles.tableHeaderText]}>{s.label}</Text>
          ))}
        </View>
        {series[0]?.data.map((point, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.tableCell}>{point.label}</Text>
            {series.map((s) => (
              <Text key={s.label} style={styles.tableCell}>
                {s.data[i]?.value.toFixed(1) ?? '-'}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => setShowTable(true)}
          style={styles.tableToggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="View as table"
        >
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

          {/* X-axis labels */}
          {series[0]?.data.map((point, i) => {
            const count = series[0].data.length;
            if (count <= 7 || i === 0 || i === count - 1 || i === Math.floor(count / 2)) {
              return (
                <SvgText
                  key={`x-${i}`}
                  x={toX(i, count)}
                  y={height - 6}
                  fill={Colors.secondaryText}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {point.label}
                </SvgText>
              );
            }
            return null;
          })}

          {/* Threshold line */}
          {thresholdValue != null && (
            <G>
              <Line
                x1={padding.left}
                y1={toY(thresholdValue)}
                x2={width - padding.right}
                y2={toY(thresholdValue)}
                stroke={Colors.danger}
                strokeWidth={1}
                strokeDasharray="6,3"
                opacity={0.7}
              />
              {thresholdLabel && (
                <SvgText
                  x={width - padding.right}
                  y={toY(thresholdValue) - 4}
                  fill={Colors.danger}
                  fontSize={9}
                  textAnchor="end"
                  opacity={0.7}
                >
                  {thresholdLabel}
                </SvgText>
              )}
            </G>
          )}

          {/* Series lines */}
          {series.map((s) => {
            const points = s.data
              .map((d, i) => `${toX(i, s.data.length)},${toY(d.value)}`)
              .join(' ');
            return (
              <G key={s.label}>
                <Polyline
                  points={points}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.dashed ? 1.5 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? '6,4' : undefined}
                />
                {showDots &&
                  s.data.map((d, i) => (
                    <SvgCircle
                      key={`${s.label}-${i}`}
                      cx={toX(i, s.data.length)}
                      cy={toY(d.value)}
                      r={s.data.length > 30 ? 1.5 : 3}
                      fill={s.color}
                      onPress={() =>
                        handlePress(
                          { x: toX(i, s.data.length), y: toY(d.value), label: d.label, value: d.value },
                          s.label,
                        )
                      }
                    />
                  ))}
              </G>
            );
          })}

          {/* Tooltip */}
          {tooltip && (
            <G>
              <Rect
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

function ThumbnailLine({
  series,
  width,
  height,
  title,
}: {
  series: ChartSeries[];
  width: number;
  height: number;
  title: string;
}) {
  const padding = 4;
  const allValues = series.flatMap((s) => s.data.map((d) => d.value));
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const last = series[0]?.data[series[0].data.length - 1];
  const accessLabel = `${title} sparkline. Latest: ${last?.value.toFixed(1) ?? 'no data'}`;

  return (
    <View accessibilityLabel={accessLabel}>
      <Svg width={width} height={height}>
        {series.map((s) => {
          const points = s.data
            .map((d, i) => {
              const x = padding + (i / Math.max(s.data.length - 1, 1)) * chartW;
              const y = padding + chartH - ((d.value - minVal) / range) * chartH;
              return `${x},${y}`;
            })
            .join(' ');
          return (
            <Polyline
              key={s.label}
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '4,3' : undefined}
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
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: Colors.text,
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
