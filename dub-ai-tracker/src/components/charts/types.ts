// Shared types for chart components
// Phase 16: Trends and Charts

export interface ChartDataPoint {
  label: string; // date label (e.g., "3/15", "Week 12", "Mar")
  value: number;
  date: string; // ISO date for lookups
}

export interface ChartSeries {
  data: ChartDataPoint[];
  color: string;
  label: string;
  dashed?: boolean; // for YoY overlay
}

export type TimeRange = '7d' | '30d' | '90d' | '6mo' | '1yr' | 'all';

export interface TooltipData {
  x: number;
  y: number;
  label: string;
  value: string;
  seriesLabel?: string;
}

export interface ChartDimensions {
  width: number;
  height: number;
  padding: { top: number; bottom: number; left: number; right: number };
}

export function getChartArea(dim: ChartDimensions) {
  return {
    chartW: dim.width - dim.padding.left - dim.padding.right,
    chartH: dim.height - dim.padding.top - dim.padding.bottom,
  };
}

export function scaleX(index: number, count: number, chartW: number, left: number): number {
  return left + (index / Math.max(count - 1, 1)) * chartW;
}

export function scaleY(value: number, min: number, range: number, chartH: number, top: number): number {
  return top + chartH - ((value - min) / (range || 1)) * chartH;
}

export function computeYTicks(min: number, max: number, count: number = 5): number[] {
  const range = max - min || 1;
  return Array.from({ length: count }, (_, i) => min + (range * i) / (count - 1));
}

export function formatTickValue(val: number): string {
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(1);
}
