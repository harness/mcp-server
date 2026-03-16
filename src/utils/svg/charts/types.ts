/**
 * Generic chart data types for bar, pie, and scatter chart renderers.
 */

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartData {
  title: string;
  subtitle?: string;
  items: BarChartItem[];
  xLabel?: string;
  yLabel?: string;
}

export interface PieChartSlice {
  label: string;
  value: number;
  color?: string;
}

export interface PieChartData {
  title: string;
  subtitle?: string;
  slices: PieChartSlice[];
}

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
}

export interface ScatterChartData {
  title: string;
  subtitle?: string;
  points: ScatterPoint[];
  xLabel?: string;
  yLabel?: string;
}
