/**
 * Status color palette and shared SVG constants.
 */

import type { ExecutionStatus } from "./types.js";

const STATUS_COLORS: Record<ExecutionStatus, string> = {
  Success: "#22c55e",
  Failed: "#ef4444",
  Running: "#3b82f6",
  Aborted: "#a855f7",
  Expired: "#f97316",
  ApprovalWaiting: "#eab308",
  InterventionWaiting: "#eab308",
  Paused: "#6b7280",
  Queued: "#94a3b8",
  Skipped: "#d1d5db",
  Errored: "#ef4444",
  Unknown: "#9ca3af",
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as ExecutionStatus] ?? "#9ca3af";
}

export const FONT_FAMILY = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";
export const BG_COLOR = "#1e1e2e";
export const SURFACE_COLOR = "#2a2a3e";
export const BORDER_COLOR = "#3a3a4e";
export const TEXT_PRIMARY = "#e2e8f0";
export const TEXT_SECONDARY = "#94a3b8";
export const TEXT_MUTED = "#64748b";
