// Heatmap chart for time-based pattern visualization
// Phase 16: Trends and Charts

import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, {
  Rect,
  Text as SvgText,
  G,
  Rect as SvgRect,
} from 'react-native-svg';
import { Colors } from '../../constants/colors';

export interface HeatmapCell {
  row: number; // row index
  col: number; // column index
  value: number;
  label: string; // for tooltip
}

interface HeatmapProps {
  data: HeatmapCell[];
  rowLabels: string[];
  colLabels: string[];
  width?: number;
  height?: number;
  title: string;
  unit?: string;
  colorScale?: { low: string; mid: string; high: string };
  thumbnail?: boolean;
}

function interpolateColor(value: number, min: number, max: number, scale: { low: string; mid: string; high: string }): string {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  // Simple gold-intensity interpolation
  if (t < 0.33) return scale.low;
  if (t < 0.66) return scale.mid;
  return scale.high;
}

export function Heatmap({
  data,
  rowLabels,
  colLabels,
  width = 340,
  height = 200,
  title,
  unit = '',
  colorScale = { low: '#2A3370', mid: '#8B7A3B', high: '#D4A843' },
  thumbnail = false,
}: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: Colors.secondaryText, fontSize: 12 }}>No data</Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  if (thumbnail) {
    const padding = 2;
    const cellW = (width - padding * 2) / Math.max(colLabels.length, 1);
    const cellH = (height - padding * 2) / Math.max(rowLabels.length, 1);
    return (
      <View accessibilityLabel={`${title} heatmap sparkline`}>
        <Svg width={width} height={height}>
          {data.map((cell, i) => (
            <Rect key={i}
              x={padding + cell.col * cellW}
              y={padding + cell.row * cellH}
              width={Math.max(1, cellW - 1)}
              height={Math.max(1, cellH - 1)}
              fill={interpolateColor(cell.value, minVal, maxVal, colorScale)}
              rx={1}
            />
          ))}
        </Svg>
      </View>
    );
  }

  const padding = { top: 8, bottom: 8, left: 56, right: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const cellW = chartW / Math.max(colLabels.length, 1);
  const cellH = chartH / Math.max(rowLabels.length, 1);

  const accessLabel = `${title} heatmap. ${rowLabels.length} rows by ${colLabels.length} columns`;

  if (showTable) {
    return (
      <View accessible accessibilityLabel={`${title} data table`}>
        <Pressable onPress={() => setShowTable(false)} style={styles.tableToggle} hitSlop={8}>
          <Text style={styles.tableToggleText}>View as chart</Text>
        </Pressable>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText]}> </Text>
          {colLabels.map((col) => (
            <Text key={col} style={[styles.tableCell, styles.tableHeaderText]}>{col}</Text>
          ))}
        </View>
        {rowLabels.map((row, ri) => (
          <View key={ri} style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 'bold', color: Colors.text }]}>{row}</Text>
            {colLabels.map((_, ci) => {
              const cell = data.find((d) => d.row === ri && d.col === ci);
              return (
                <Text key={ci} style={styles.tableCell}>
                  {cell ? cell.value.toFixed(1) : '-'}
                </Text>
              );
            })}
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
          {/* Row labels */}
          {rowLabels.map((label, i) => (
            <SvgText key={`r-${i}`}
              x={padding.left - 4}
              y={padding.top + i * cellH + cellH / 2 + 4}
              fill={Colors.secondaryText}
              fontSize={9}
              textAnchor="end"
            >
              {label}
            </SvgText>
          ))}

          {/* Column labels */}
          {colLabels.map((label, i) => {
            const show = colLabels.length <= 12 || i % Math.ceil(colLabels.length / 12) === 0;
            if (!show) return null;
            return (
              <SvgText key={`c-${i}`}
                x={padding.left + i * cellW + cellW / 2}
                y={height - 2}
                fill={Colors.secondaryText}
                fontSize={8}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            );
          })}

          {/* Cells */}
          {data.map((cell, i) => (
            <Rect key={i}
              x={padding.left + cell.col * cellW + 1}
              y={padding.top + cell.row * cellH + 1}
              width={Math.max(1, cellW - 2)}
              height={Math.max(1, cellH - 2)}
              fill={interpolateColor(cell.value, minVal, maxVal, colorScale)}
              rx={2}
              onPress={() => setTooltip({
                x: padding.left + cell.col * cellW + cellW / 2,
                y: padding.top + cell.row * cellH,
                text: `${cell.label}: ${cell.value.toFixed(1)}${unit ? ' ' + unit : ''}`,
              })}
            />
          ))}

          {/* Tooltip */}
          {tooltip && (
            <G>
              <SvgRect
                x={Math.max(4, Math.min(tooltip.x - 60, width - 124))}
                y={Math.max(0, tooltip.y - 22)}
                width={120} height={18} rx={4}
                fill={Colors.cardBackground} stroke={Colors.accent} strokeWidth={0.5} />
              <SvgText
                x={Math.max(64, Math.min(tooltip.x, width - 64))}
                y={Math.max(13, tooltip.y - 9)}
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
