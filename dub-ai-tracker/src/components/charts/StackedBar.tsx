// Stacked bar chart for multi-category data (e.g., macros)
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
import { computeYTicks, formatTickValue, getChartArea, scaleY } from './types';

export interface StackedBarSegment {
  label: string;
  color: string;
}

export interface StackedBarDataPoint {
  label: string;
  date: string;
  values: number[]; // parallel to segments array
}

interface StackedBarProps {
  data: StackedBarDataPoint[];
  segments: StackedBarSegment[];
  width?: number;
  height?: number;
  title: string;
  unit?: string;
  thumbnail?: boolean;
}

export function StackedBar({
  data,
  segments,
  width = 340,
  height = 200,
  title,
  unit = '',
  thumbnail = false,
}: StackedBarProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: Colors.secondaryText, fontSize: 12 }}>No data</Text>
      </View>
    );
  }

  const totals = data.map((d) => d.values.reduce((s, v) => s + v, 0));
  const maxTotal = Math.max(...totals);

  if (thumbnail) {
    return <ThumbnailStackedBar data={data} segments={segments} width={width} height={height} title={title} maxTotal={maxTotal} />;
  }

  const padding = { top: 16, bottom: 28, left: 44, right: 12 };
  const { chartW, chartH } = getChartArea({ width, height, padding });
  const yTicks = computeYTicks(0, maxTotal);

  const barGap = 2;
  const barWidth = Math.max(2, (chartW - barGap * data.length) / data.length);
  const toY = (val: number) => scaleY(val, 0, maxTotal || 1, chartH, padding.top);
  const baseY = toY(0);

  const handlePress = (point: StackedBarDataPoint, x: number) => {
    const lines = segments.map((seg, j) => `${seg.label}: ${point.values[j].toFixed(1)}`).join(', ');
    setTooltip({ x, y: padding.top, text: `${point.label} - ${lines}` });
  };

  const accessLabel = `${title} stacked bar chart. ${data.length} bars. Categories: ${segments.map((s) => s.label).join(', ')}`;

  if (showTable) {
    return (
      <View accessible accessibilityLabel={`${title} data table`}>
        <Pressable onPress={() => setShowTable(false)} style={styles.tableToggle} hitSlop={8}>
          <Text style={styles.tableToggleText}>View as chart</Text>
        </Pressable>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Date</Text>
          {segments.map((seg) => (
            <Text key={seg.label} style={[styles.tableCell, styles.tableHeaderText]}>{seg.label}</Text>
          ))}
        </View>
        {data.map((point, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.tableCell}>{point.label}</Text>
            {point.values.map((v, j) => (
              <Text key={j} style={styles.tableCell}>{v.toFixed(1)}</Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      {/* Legend */}
      <View style={styles.legendRow}>
        {segments.map((seg) => (
          <View key={seg.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={styles.legendText}>{seg.label}</Text>
          </View>
        ))}
        <Pressable onPress={() => setShowTable(true)} style={styles.tableToggle} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="View as table">
          <Text style={styles.tableToggleText}>Table</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => setTooltip(null)} accessibilityLabel={accessLabel}>
        <Svg width={width} height={height}>
          {/* Grid */}
          {yTicks.map((tick, i) => (
            <G key={i}>
              <Line
                x1={padding.left} y1={toY(tick)}
                x2={width - padding.right} y2={toY(tick)}
                stroke={Colors.divider} strokeWidth={0.5} strokeDasharray="4,4"
              />
              <SvgText x={padding.left - 6} y={toY(tick) + 4}
                fill={Colors.secondaryText} fontSize={10} textAnchor="end">
                {formatTickValue(tick)}
              </SvgText>
            </G>
          ))}

          {/* Stacked bars */}
          {data.map((point, i) => {
            const x = padding.left + i * (barWidth + barGap) + barGap / 2;
            let cumY = baseY;
            return (
              <G key={i} onPress={() => handlePress(point, x + barWidth / 2)}>
                {segments.map((seg, j) => {
                  const segH = (point.values[j] / (maxTotal || 1)) * chartH;
                  cumY -= segH;
                  return (
                    <Rect
                      key={j}
                      x={x}
                      y={cumY}
                      width={barWidth}
                      height={Math.max(0, segH)}
                      fill={seg.color}
                      opacity={0.85}
                    />
                  );
                })}
              </G>
            );
          })}

          {/* X-axis labels */}
          {data.map((point, i) => {
            const x = padding.left + i * (barWidth + barGap) + barWidth / 2;
            const show = data.length <= 7 || i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2);
            if (!show) return null;
            return (
              <SvgText key={`x-${i}`} x={x} y={height - 6}
                fill={Colors.secondaryText} fontSize={9} textAnchor="middle">
                {point.label}
              </SvgText>
            );
          })}

          {/* Tooltip */}
          {tooltip && (
            <G>
              <SvgRect
                x={Math.max(4, Math.min(tooltip.x - 80, width - 164))}
                y={tooltip.y - 4}
                width={160}
                height={20}
                rx={4}
                fill={Colors.cardBackground}
                stroke={Colors.accent}
                strokeWidth={0.5}
              />
              <SvgText
                x={Math.max(84, Math.min(tooltip.x, width - 84))}
                y={tooltip.y + 10}
                fill={Colors.text}
                fontSize={9}
                textAnchor="middle"
              >
                {tooltip.text}
              </SvgText>
            </G>
          )}
        </Svg>
      </Pressable>
    </View>
  );
}

function ThumbnailStackedBar({
  data, segments, width, height, title, maxTotal,
}: {
  data: StackedBarDataPoint[]; segments: StackedBarSegment[];
  width: number; height: number; title: string; maxTotal: number;
}) {
  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const barGap = 1;
  const barWidth = Math.max(1, (chartW - barGap * data.length) / data.length);

  return (
    <View accessibilityLabel={`${title} stacked bar sparkline`}>
      <Svg width={width} height={height}>
        {data.map((point, i) => {
          const x = padding + i * (barWidth + barGap);
          let cumY = padding + chartH;
          return (
            <G key={i}>
              {segments.map((seg, j) => {
                const segH = (point.values[j] / (maxTotal || 1)) * chartH;
                cumY -= segH;
                return (
                  <Rect key={j} x={x} y={cumY} width={barWidth} height={Math.max(0, segH)} fill={seg.color} opacity={0.8} />
                );
              })}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: Colors.secondaryText,
    fontSize: 10,
  },
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
    color: Colors.accentText,
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
