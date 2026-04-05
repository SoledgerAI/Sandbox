// Dual-axis line chart for overlaying two metrics with different scales
// Phase 16: Trends and Charts

import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, {
  Polyline,
  Circle as SvgCircle,
  Line,
  Text as SvgText,
  G,
  Rect,
} from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { ChartDataPoint, PointSelectEvent, computeYTicks, formatTickValue, getChartArea, scaleY } from './types';

interface DualAxisSeries {
  data: ChartDataPoint[];
  color: string;
  label: string;
  unit: string;
  dashed?: boolean;
}

interface DualAxisProps {
  left: DualAxisSeries;
  right: DualAxisSeries;
  width?: number;
  height?: number;
  title: string;
  thumbnail?: boolean;
  /** When provided, fires on dot press instead of showing internal tooltip */
  onPointSelect?: (event: PointSelectEvent) => void;
}

export function DualAxis({
  left,
  right,
  width = 340,
  height = 200,
  title,
  thumbnail = false,
  onPointSelect,
}: DualAxisProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (left.data.length === 0 && right.data.length === 0) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: Colors.secondaryText, fontSize: 12 }}>No data</Text>
      </View>
    );
  }

  const lValues = left.data.map((d) => d.value);
  const rValues = right.data.map((d) => d.value);
  const lMin = lValues.length ? Math.min(...lValues) : 0;
  const lMax = lValues.length ? Math.max(...lValues) : 1;
  const rMin = rValues.length ? Math.min(...rValues) : 0;
  const rMax = rValues.length ? Math.max(...rValues) : 1;
  const lRange = lMax - lMin || 1;
  const rRange = rMax - rMin || 1;

  if (thumbnail) {
    const padding = 4;
    const cW = width - padding * 2;
    const cH = height - padding * 2;
    const toPoints = (data: ChartDataPoint[], min: number, range: number) =>
      data.map((d, i) => {
        const x = padding + (i / Math.max(data.length - 1, 1)) * cW;
        const y = padding + cH - ((d.value - min) / range) * cH;
        return `${x},${y}`;
      }).join(' ');

    return (
      <View accessibilityLabel={`${title} dual axis sparkline`}>
        <Svg width={width} height={height}>
          <Polyline points={toPoints(left.data, lMin, lRange)} fill="none"
            stroke={left.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          <Polyline points={toPoints(right.data, rMin, rRange)} fill="none"
            stroke={right.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray="4,3" />
        </Svg>
      </View>
    );
  }

  const padding = { top: 16, bottom: 28, left: 44, right: 44 };
  const { chartW, chartH } = getChartArea({ width, height, padding });
  const lYTicks = computeYTicks(lMin, lMax);
  const rYTicks = computeYTicks(rMin, rMax);

  const toLY = (val: number) => scaleY(val, lMin, lRange, chartH, padding.top);
  const toRY = (val: number) => scaleY(val, rMin, rRange, chartH, padding.top);
  const toX = (i: number, count: number) =>
    padding.left + (i / Math.max(count - 1, 1)) * chartW;

  const lPoints = left.data.map((d, i) => `${toX(i, left.data.length)},${toLY(d.value)}`).join(' ');
  const rPoints = right.data.map((d, i) => `${toX(i, right.data.length)},${toRY(d.value)}`).join(' ');

  const refData = left.data.length >= right.data.length ? left.data : right.data;
  const accessLabel = `${title} dual axis chart. Left: ${left.label}. Right: ${right.label}`;

  if (showTable) {
    return (
      <View accessible accessibilityLabel={`${title} data table`}>
        <Pressable onPress={() => setShowTable(false)} style={styles.tableToggle} hitSlop={8}>
          <Text style={styles.tableToggleText}>View as chart</Text>
        </Pressable>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Date</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>{left.label}</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>{right.label}</Text>
        </View>
        {refData.map((point, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.tableCell}>{point.label}</Text>
            <Text style={styles.tableCell}>{left.data[i]?.value.toFixed(1) ?? '-'}</Text>
            <Text style={styles.tableCell}>{right.data[i]?.value.toFixed(1) ?? '-'}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View>
      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: left.color }]} />
          <Text style={styles.legendText}>{left.label} ({left.unit})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDash, { borderColor: right.color }]} />
          <Text style={styles.legendText}>{right.label} ({right.unit})</Text>
        </View>
        <Pressable onPress={() => setShowTable(true)} style={styles.tableToggle} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="View as table">
          <Text style={styles.tableToggleText}>Table</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => setTooltip(null)} accessibilityLabel={accessLabel}>
        <Svg width={width} height={height}>
          {/* Grid */}
          {lYTicks.map((tick, i) => (
            <Line key={`g-${i}`}
              x1={padding.left} y1={toLY(tick)}
              x2={width - padding.right} y2={toLY(tick)}
              stroke={Colors.divider} strokeWidth={0.5} strokeDasharray="4,4" />
          ))}

          {/* Left Y-axis */}
          {lYTicks.map((tick, i) => (
            <SvgText key={`ly-${i}`} x={padding.left - 6} y={toLY(tick) + 4}
              fill={left.color} fontSize={10} textAnchor="end">
              {formatTickValue(tick)}
            </SvgText>
          ))}

          {/* Right Y-axis */}
          {rYTicks.map((tick, i) => (
            <SvgText key={`ry-${i}`} x={width - padding.right + 6} y={toRY(tick) + 4}
              fill={right.color} fontSize={10} textAnchor="start">
              {formatTickValue(tick)}
            </SvgText>
          ))}

          {/* X-axis */}
          {refData.map((point, i) => {
            const count = refData.length;
            if (count <= 7 || i === 0 || i === count - 1 || i === Math.floor(count / 2)) {
              return (
                <SvgText key={`x-${i}`} x={toX(i, count)} y={height - 6}
                  fill={Colors.secondaryText} fontSize={9} textAnchor="middle">
                  {point.label}
                </SvgText>
              );
            }
            return null;
          })}

          {/* Left series */}
          <Polyline points={lPoints} fill="none" stroke={left.color}
            strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Right series (dashed) */}
          <Polyline points={rPoints} fill="none" stroke={right.color}
            strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray="6,4" />

          {/* Interactive dots */}
          {left.data.map((d, i) => (
            <SvgCircle key={`ld-${i}`}
              cx={toX(i, left.data.length)} cy={toLY(d.value)}
              r={left.data.length > 30 ? 1.5 : 3} fill={left.color}
              onPress={() => {
                if (onPointSelect) {
                  onPointSelect({ date: d.date, label: d.label, value: d.value, x: toX(i, left.data.length), y: toLY(d.value), seriesLabel: left.label, unit: left.unit });
                  return;
                }
                setTooltip({ x: toX(i, left.data.length), y: toLY(d.value), text: `${d.label}: ${left.label} ${d.value.toFixed(1)} ${left.unit}` });
              }} />
          ))}
          {right.data.map((d, i) => (
            <SvgCircle key={`rd-${i}`}
              cx={toX(i, right.data.length)} cy={toRY(d.value)}
              r={right.data.length > 30 ? 1.5 : 3} fill={right.color}
              onPress={() => {
                if (onPointSelect) {
                  onPointSelect({ date: d.date, label: d.label, value: d.value, x: toX(i, right.data.length), y: toRY(d.value), seriesLabel: right.label, unit: right.unit });
                  return;
                }
                setTooltip({ x: toX(i, right.data.length), y: toRY(d.value), text: `${d.label}: ${right.label} ${d.value.toFixed(1)} ${right.unit}` });
              }} />
          ))}

          {/* Tooltip */}
          {tooltip && (
            <G>
              <Rect
                x={Math.max(4, Math.min(tooltip.x - 70, width - 144))}
                y={tooltip.y - 24}
                width={140} height={18} rx={4}
                fill={Colors.cardBackground} stroke={Colors.accent} strokeWidth={0.5} />
              <SvgText
                x={Math.max(74, Math.min(tooltip.x, width - 74))}
                y={tooltip.y - 11}
                fill={Colors.text} fontSize={9} textAnchor="middle">
                {tooltip.text}
              </SvgText>
            </G>
          )}
        </Svg>
      </Pressable>
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
  legendDash: {
    width: 12,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendText: {
    color: Colors.secondaryText,
    fontSize: 10,
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
