/**
 * Pipeline Execution Timeline — horizontal Gantt chart.
 * Y-axis = stage names, X-axis = time. Color-coded bars by status.
 */

import type { ExecutionSummaryData } from "./types.js";
import { getStatusColor, FONT_FAMILY, BG_COLOR, SURFACE_COLOR, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from "./colors.js";
import { escapeXml, truncateLabel } from "./escape.js";

export interface TimelineOptions {
  width?: number;
  showSteps?: boolean;
  maxStages?: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export function renderTimelineSvg(data: ExecutionSummaryData, options?: TimelineOptions): string {
  const width = options?.width ?? 800;
  const showSteps = options?.showSteps ?? false;
  const maxStages = options?.maxStages ?? 25;

  const LABEL_WIDTH = 160;
  const ROW_HEIGHT = 36;
  const STEP_HEIGHT = 24;
  const HEADER_HEIGHT = 60;
  const PADDING = 16;
  const BAR_AREA_WIDTH = width - LABEL_WIDTH - PADDING * 3;

  let stages = data.stages;
  let truncatedCount = 0;
  if (stages.length > maxStages) {
    truncatedCount = stages.length - maxStages;
    stages = stages.slice(0, maxStages);
  }

  // Compute row count
  let totalRows = stages.length;
  if (showSteps) {
    for (const stage of stages) {
      totalRows += stage.steps.length;
    }
  }
  if (truncatedCount > 0) totalRows++;

  const chartHeight = totalRows * ROW_HEIGHT;
  const totalHeight = HEADER_HEIGHT + chartHeight + PADDING * 2;

  // Timeline scale: find min start and max end
  const minStart = stages.length > 0
    ? Math.min(...stages.map((s) => s.startMs))
    : 0;
  const totalMs = data.totalDurationMs > 0 ? data.totalDurationMs : 1;

  function xPos(ms: number): number {
    const offset = ms - minStart;
    return LABEL_WIDTH + PADDING * 2 + (offset / totalMs) * BAR_AREA_WIDTH;
  }

  function barWidth(durationMs: number): number {
    return Math.max(4, (durationMs / totalMs) * BAR_AREA_WIDTH);
  }

  // Build SVG rows
  const rows: string[] = [];
  let y = HEADER_HEIGHT + PADDING;

  for (const stage of stages) {
    const color = getStatusColor(stage.status);
    const label = escapeXml(truncateLabel(stage.name, 22));
    const x = xPos(stage.startMs);
    const w = barWidth(stage.durationMs > 0 ? stage.durationMs : totalMs * 0.01);
    const dur = stage.durationMs > 0 ? formatDuration(stage.durationMs) : stage.status;

    rows.push(`
      <text x="${PADDING}" y="${y + ROW_HEIGHT / 2 + 4}" fill="${TEXT_PRIMARY}" font-size="12" font-family="${FONT_FAMILY}">${label}</text>
      <rect x="${x}" y="${y + 6}" width="${w}" height="${ROW_HEIGHT - 12}" rx="4" fill="${color}" opacity="0.85"/>
      <text x="${x + w + 6}" y="${y + ROW_HEIGHT / 2 + 4}" fill="${TEXT_SECONDARY}" font-size="10" font-family="${FONT_FAMILY}">${escapeXml(dur)}</text>
    `);

    // Failure indicator
    if (stage.status === "Failed" || stage.status === "Errored") {
      rows.push(`<text x="${x + w + 6 + dur.length * 6 + 8}" y="${y + ROW_HEIGHT / 2 + 4}" fill="${getStatusColor("Failed")}" font-size="10" font-family="${FONT_FAMILY}">\u2716</text>`);
    }

    y += ROW_HEIGHT;

    if (showSteps) {
      for (const step of stage.steps) {
        const stepColor = getStatusColor(step.status);
        const stepLabel = escapeXml(truncateLabel(step.name, 20));
        const stepDur = step.durationMs > 0 ? formatDuration(step.durationMs) : step.status;
        const stepW = barWidth(step.durationMs > 0 ? step.durationMs : totalMs * 0.005);

        rows.push(`
          <text x="${PADDING + 16}" y="${y + STEP_HEIGHT / 2 + 3}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}">${stepLabel}</text>
          <rect x="${x}" y="${y + 4}" width="${stepW}" height="${STEP_HEIGHT - 8}" rx="3" fill="${stepColor}" opacity="0.65"/>
          <text x="${x + stepW + 4}" y="${y + STEP_HEIGHT / 2 + 3}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}">${escapeXml(stepDur)}</text>
        `);
        y += ROW_HEIGHT;
      }
    }
  }

  if (truncatedCount > 0) {
    rows.push(`<text x="${PADDING}" y="${y + ROW_HEIGHT / 2 + 4}" fill="${TEXT_MUTED}" font-size="11" font-family="${FONT_FAMILY}" font-style="italic">\u2026 and ${truncatedCount} more stages</text>`);
  }

  // Header
  const statusColor = getStatusColor(data.status);
  const title = escapeXml(truncateLabel(data.pipelineName, 40));
  const headerDuration = formatDuration(data.totalDurationMs);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <rect width="${width}" height="${totalHeight}" rx="8" fill="${BG_COLOR}"/>
  <rect x="${PADDING}" y="${PADDING}" width="${width - PADDING * 2}" height="${HEADER_HEIGHT - PADDING}" rx="6" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <circle cx="${PADDING + 16}" cy="${PADDING + 16}" r="6" fill="${statusColor}"/>
  <text x="${PADDING + 30}" y="${PADDING + 20}" fill="${TEXT_PRIMARY}" font-size="14" font-weight="600" font-family="${FONT_FAMILY}">${title}</text>
  <text x="${PADDING + 30}" y="${PADDING + 36}" fill="${TEXT_SECONDARY}" font-size="11" font-family="${FONT_FAMILY}">${escapeXml(data.executionId)} \u00b7 ${escapeXml(data.status)} \u00b7 ${escapeXml(headerDuration)}</text>
  ${rows.join("\n")}
</svg>`;
}
