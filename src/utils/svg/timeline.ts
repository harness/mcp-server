/**
 * Pipeline Execution Timeline — horizontal Gantt chart.
 * Rich version: gradient bars, grid lines, header badge, duration labels, footer summary.
 */

import type { ExecutionSummaryData } from "./types.js";
import {
  getStatusColor, getStatusLightColor,
  FONT_FAMILY, SURFACE_COLOR, BORDER_COLOR,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, GRID_COLOR,
  svgDefs,
} from "./colors.js";
import { escapeXml, truncateLabel } from "./escape.js";

export interface TimelineOptions {
  width?: number;
  showSteps?: boolean;
  maxStages?: number;
}

function fmtDur(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export function renderTimelineSvg(data: ExecutionSummaryData, options?: TimelineOptions): string {
  const W = options?.width ?? 800;
  const showSteps = options?.showSteps ?? false;
  const maxStages = options?.maxStages ?? 25;

  const PAD = 20;
  const LABEL_W = 150;
  const ROW_H = 34;
  const STEP_H = 26;
  const HDR_H = 70;
  const FTR_H = 44;
  const BAR_X = LABEL_W + PAD * 2;
  const BAR_W = W - BAR_X - PAD - 50; // 50 for duration label

  let stages = data.stages;
  let truncated = 0;
  if (stages.length > maxStages) {
    truncated = stages.length - maxStages;
    stages = stages.slice(0, maxStages);
  }

  let rowCount = stages.length;
  if (showSteps) for (const s of stages) rowCount += s.steps.length;
  if (truncated > 0) rowCount++;

  const chartH = rowCount * ROW_H;
  const H = HDR_H + chartH + FTR_H + PAD * 2;

  const minStart = stages.length > 0 ? Math.min(...stages.map((s) => s.startMs)) : 0;
  const totalMs = data.totalDurationMs > 0 ? data.totalDurationMs : 1;
  const xPos = (ms: number) => BAR_X + ((ms - minStart) / totalMs) * BAR_W;
  const barW = (dur: number) => Math.max(6, (dur / totalMs) * BAR_W);

  // Time axis ticks (5 evenly spaced)
  const ticks: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const ms = (totalMs * i) / 4;
    const x = BAR_X + (i / 4) * BAR_W;
    ticks.push(`<line x1="${x}" y1="${HDR_H + PAD}" x2="${x}" y2="${HDR_H + PAD + chartH}" stroke="${GRID_COLOR}" stroke-width="1" stroke-dasharray="4,4"/>`);
    ticks.push(`<text x="${x}" y="${HDR_H + PAD + chartH + 14}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="middle">${fmtDur(ms)}</text>`);
  }

  // Rows
  const rows: string[] = [];
  let y = HDR_H + PAD;

  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si]!;
    const color = getStatusColor(stage.status);
    const light = getStatusLightColor(stage.status);
    const label = escapeXml(truncateLabel(stage.name, 20));
    const x = xPos(stage.startMs);
    const w = barW(stage.durationMs > 0 ? stage.durationMs : totalMs * 0.01);
    const dur = stage.durationMs > 0 ? fmtDur(stage.durationMs) : stage.status;
    const gradId = `sg${si}`;

    // Stage gradient def
    rows.push(`<linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${light}"/><stop offset="100%" stop-color="${color}"/></linearGradient>`);

    // Row stripe
    if (si % 2 === 0) {
      rows.push(`<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${ROW_H}" rx="4" fill="${SURFACE_COLOR}" opacity="0.3"/>`);
    }

    // Status dot + label
    rows.push(`<circle cx="${PAD + 8}" cy="${y + ROW_H / 2}" r="4" fill="${color}"/>`);
    rows.push(`<text x="${PAD + 18}" y="${y + ROW_H / 2 + 4}" fill="${TEXT_PRIMARY}" font-size="11" font-weight="500" font-family="${FONT_FAMILY}">${label}</text>`);

    // Bar with gradient + rounded corners
    rows.push(`<rect x="${x}" y="${y + 7}" width="${w}" height="${ROW_H - 14}" rx="5" fill="url(#${gradId})" filter="url(#shadow)"/>`);

    // Duration label
    rows.push(`<text x="${x + w + 8}" y="${y + ROW_H / 2 + 4}" fill="${TEXT_SECONDARY}" font-size="10" font-weight="500" font-family="${FONT_FAMILY}">${escapeXml(dur)}</text>`);

    // Failure marker
    if (stage.status === "Failed" || stage.status === "Errored") {
      rows.push(`<text x="${x + w / 2}" y="${y + ROW_H / 2 + 3}" fill="#fff" font-size="9" font-weight="700" font-family="${FONT_FAMILY}" text-anchor="middle">\u2716</text>`);
    }

    y += ROW_H;

    if (showSteps) {
      for (const step of stage.steps) {
        const sc = getStatusColor(step.status);
        const sLabel = escapeXml(truncateLabel(step.name, 18));
        const sDur = step.durationMs > 0 ? fmtDur(step.durationMs) : step.status;
        const sW = barW(step.durationMs > 0 ? step.durationMs : totalMs * 0.005);

        rows.push(`<text x="${PAD + 28}" y="${y + STEP_H / 2 + 3}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}">${sLabel}</text>`);
        rows.push(`<rect x="${x}" y="${y + 5}" width="${sW}" height="${STEP_H - 10}" rx="3" fill="${sc}" opacity="0.6"/>`);
        rows.push(`<text x="${x + sW + 6}" y="${y + STEP_H / 2 + 3}" fill="${TEXT_MUTED}" font-size="8" font-family="${FONT_FAMILY}">${escapeXml(sDur)}</text>`);
        y += ROW_H;
      }
    }
  }

  if (truncated > 0) {
    rows.push(`<text x="${PAD + 18}" y="${y + ROW_H / 2 + 4}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}" font-style="italic">\u2026 and ${truncated} more stages</text>`);
  }

  // Header
  const statusColor = getStatusColor(data.status);
  const title = escapeXml(truncateLabel(data.pipelineName, 40));
  const hDur = fmtDur(data.totalDurationMs);
  const statusIcon = data.status === "Success" ? "\u2714" : data.status === "Failed" || data.status === "Errored" ? "\u2716" : "\u25CF";

  // Footer summary
  const succeeded = data.stages.filter((s) => s.status === "Success").length;
  const failed = data.stages.filter((s) => s.status === "Failed" || s.status === "Errored").length;
  const running = data.stages.filter((s) => s.status === "Running").length;
  const footerY = HDR_H + PAD + chartH + 26;
  const footerParts = [
    `<circle cx="${PAD + 8}" cy="${footerY}" r="3" fill="#10b981"/><text x="${PAD + 16}" y="${footerY + 4}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}">${succeeded} passed</text>`,
    failed > 0 ? `<circle cx="${PAD + 90}" cy="${footerY}" r="3" fill="#f43f5e"/><text x="${PAD + 98}" y="${footerY + 4}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}">${failed} failed</text>` : "",
    running > 0 ? `<circle cx="${PAD + 170}" cy="${footerY}" r="3" fill="#6366f1"/><text x="${PAD + 178}" y="${footerY + 4}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}">${running} running</text>` : "",
  ].filter(Boolean);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${svgDefs(W, H)}
  <rect width="${W}" height="${H}" rx="12" fill="url(#bgGrad)"/>
  <rect x="${PAD}" y="${PAD}" width="${W - PAD * 2}" height="${HDR_H - PAD}" rx="8" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1" filter="url(#shadow)"/>
  <rect x="${PAD + 12}" y="${PAD + 10}" width="28" height="28" rx="6" fill="${statusColor}" opacity="0.15"/>
  <text x="${PAD + 26}" y="${PAD + 30}" fill="${statusColor}" font-size="14" font-family="${FONT_FAMILY}" text-anchor="middle">${statusIcon}</text>
  <text x="${PAD + 50}" y="${PAD + 22}" fill="${TEXT_PRIMARY}" font-size="15" font-weight="700" font-family="${FONT_FAMILY}">${title}</text>
  <text x="${PAD + 50}" y="${PAD + 40}" fill="${TEXT_SECONDARY}" font-size="10" font-family="${FONT_FAMILY}">${escapeXml(data.executionId)}  \u00b7  ${escapeXml(data.status)}  \u00b7  ${escapeXml(hDur)}  \u00b7  ${data.stages.length} stages</text>
  ${rows.map((r) => r.startsWith("<linearGradient") ? "" : r).join("\n")}
  ${ticks.join("\n")}
  ${footerParts.join("\n  ")}
  <defs>${rows.filter((r) => r.startsWith("<linearGradient")).join("")}</defs>
</svg>`;
}
