// Scatter plot for correlation analysis
// Phase 16: Trends and Charts

import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Line,
  Text as SvgText,
  G,
  Rect,
} from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { computeYTicks, formatTickValue, getChartArea, scaleY } from './types';

export interface ScatterPoint {
  x: number;
  y: number;
  label: string;
}

interface ScatterPlotProps {
  data: ScatterPoint[];
  width?: number;
  height?: number;
  title: string;
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  color?: string;
  thumbnail?: boolean;
}

export function ScatterPlot({
  data,
  width = 340,
  height = 200,
  title,
  xLabel,
  yLabel,
  xUnit = '',
  yUnit = '',
  color = Colors.accent,
  thumbnail = false,
}: ScatterPlotProps) {
  const [tooltip, setTooltip] = useState<{ px: number; py: number; text: string } | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: Colors.secondaryText, fontSize: 14 }}>Log a few entries to reveal patterns</Text>
      </View>
    );
  }

  const xValues = data.map((d) => d.x);
  const yValues = data.map((d) => d.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  if (thumbnail) {
    const padding = 4;
    const cW = width - padding * 2;
    const cH = height - padding * 2;
    return (
      <View accessibilityLabel={`${title} scatter sparkline. ${data.length} points`}>
        <Svg width={width} height={height}>
          {data.map((pt, i) => (
            <SvgCircle
              key={i}
              cx={padding + ((pt.x - xMin) / xRange) * cW}
              cy={padding + cH - ((pt.y - yMin) / yRange) * cH}
              r={2}
              fill={color}
              opacity={0.7}
            />
          ))}
        </Svg>
      </View>
    );
  }

  const padding = { top: 16, bottom: 32, left: 44, right: 12 };
  const { chartW, chartH } = getChartArea({ width, height, padding });
  const yTicks = computeYTicks(yMin, yMax);
  const xTicks = computeYTicks(xMin, xMax);

  const toPx = (xVal: number) => padding.left + ((xVal - xMin) / xRange) * chartW;
  const toPy = (yVal: number) => scaleY(yVal, yMin, yRange, chartH, padding.top);

  const accessLabel = `${title} scatter plot. ${data.length} data points. X-axis: ${xLabel}. Y-axis: ${yLabel}`;

  if (showTable) {
    return (
      <View accessible accessibilityLabel={`${title} data table`}>
        <Pressable onPress={() => setShowTable(false)} style={styles.tableToggle} hitSlop={8}>
          <Text style={styles.tableToggleText}>View as chart</Text>
        </Pressable>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>{xLabel}</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>{yLabel}</Text>
        </View>
        {data.map((pt, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.tableCell}>{pt.x.toFixed(1)}{xUnit ? ' ' + xUnit : ''}</Text>
            <Text style={styles.tableCell}>{pt.y.toFixed(1)}{yUnit ? ' ' + yUnit : ''}</Text>
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
          {/* Grid */}
          {yTicks.map((tick, i) => (
            <G key={`yg-${i}`}>
              <Line x1={padding.left} y1={toPy(tick)} x2={width - padding.right} y2={toPy(tick)}
                stroke={Colors.divider} strokeWidth={0.5} strokeDasharray="4,4" />
              <SvgText x={padding.left - 6} y={toPy(tick) + 4}
                fill={Colors.secondaryText} fontSize={10} textAnchor="end">
                {formatTickValue(tick)}
              </SvgText>
            </G>
          ))}
          {xTicks.map((tick, i) => (
            <SvgText key={`xt-${i}`} x={toPx(tick)} y={height - 6}
              fill={Colors.secondaryText} fontSize={9} textAnchor="middle">
              {formatTickValue(tick)}
            </SvgText>
          ))}

          {/* Axis labels */}
          <SvgText x={width / 2} y={height - 16}
            fill={Colors.secondaryText} fontSize={9} textAnchor="middle">
            {xLabel}
          </SvgText>

          {/* Points */}
          {data.map((pt, i) => (
            <SvgCircle
              key={i}
              cx={toPx(pt.x)}
              cy={toPy(pt.y)}
              r={data.length > 100 ? 2 : 4}
              fill={color}
              opacity={0.75}
              onPress={() => setTooltip({
                px: toPx(pt.x),
                py: toPy(pt.y),
                text: `${pt.label}: ${pt.x.toFixed(1)}${xUnit ? xUnit : ''} / ${pt.y.toFixed(1)}${yUnit ? yUnit : ''}`,
              })}
            />
          ))}

          {/* Tooltip */}
          {tooltip && (
            <G>
              <Rect
                x={Math.max(4, Math.min(tooltip.px - 70, width - 144))}
                y={tooltip.py - 24}
                width={140}
                height={18}
                rx={4}
                fill={Colors.cardBackground}
                stroke={Colors.accent}
                strokeWidth={0.5}
              />
              <SvgText
                x={Math.max(74, Math.min(tooltip.px, width - 74))}
                y={tooltip.py - 11}
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
