/**
 * Status color palette, shared SVG constants, and reusable defs.
 */

import type { ExecutionStatus } from "./types.js";

const STATUS_COLORS: Record<ExecutionStatus, string> = {
  Success: "#10b981",
  Failed: "#f43f5e",
  Running: "#6366f1",
  Aborted: "#a855f7",
  Expired: "#f59e0b",
  ApprovalWaiting: "#eab308",
  InterventionWaiting: "#eab308",
  Paused: "#6b7280",
  Queued: "#94a3b8",
  Skipped: "#d1d5db",
  Errored: "#f43f5e",
  Unknown: "#9ca3af",
};

/** Brighter accent variants for gradient stops */
const STATUS_LIGHT: Record<string, string> = {
  Success: "#34d399",
  Failed: "#fb7185",
  Running: "#818cf8",
  Aborted: "#c084fc",
  Expired: "#fbbf24",
  Errored: "#fb7185",
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as ExecutionStatus] ?? "#9ca3af";
}

export function getStatusLightColor(status: string): string {
  return STATUS_LIGHT[status] ?? getStatusColor(status);
}

export const FONT_FAMILY = "'Inter', 'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif";
export const BG_COLOR = "#0f172a";
export const BG_GRADIENT_START = "#0f172a";
export const BG_GRADIENT_END = "#1e293b";
export const SURFACE_COLOR = "#1e293b";
export const SURFACE_HOVER = "#334155";
export const BORDER_COLOR = "#334155";
export const TEXT_PRIMARY = "#f1f5f9";
export const TEXT_SECONDARY = "#94a3b8";
export const TEXT_MUTED = "#64748b";
export const ACCENT_BLUE = "#6366f1";
export const GRID_COLOR = "#1e293b";

/** Vibrant palette for charts (non-status data) */
export const CHART_PALETTE = [
  "#6366f1", "#10b981", "#f43f5e", "#f59e0b", "#a855f7",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
];

/**
 * Common SVG <defs> block with gradients and shadow filter.
 * Include at the top of every chart SVG.
 */
export function svgDefs(width: number, height: number): string {
  return `<defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG_GRADIENT_START}"/>
      <stop offset="100%" stop-color="${BG_GRADIENT_END}"/>
    </linearGradient>
    <filter id="shadow" x="-4%" y="-4%" width="108%" height="108%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
    </filter>
    <clipPath id="chartClip"><rect width="${width}" height="${height}" rx="12"/></clipPath>
  </defs>`;
}
