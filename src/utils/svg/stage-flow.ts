/**
 * Pipeline Stage Flow — left-to-right DAG flowchart.
 * Rich version: gradient nodes, status badges, step counts, connecting arrows.
 */

import type { ExecutionSummaryData } from "./types.js";
import {
  getStatusColor, getStatusLightColor,
  FONT_FAMILY, TEXT_PRIMARY, TEXT_MUTED, BORDER_COLOR, SURFACE_COLOR,
  svgDefs,
} from "./colors.js";
import { escapeXml, truncateLabel } from "./escape.js";

export interface StageFlowOptions {
  width?: number;
  maxStages?: number;
}

function fmtDur(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
}

export function renderStageFlowSvg(data: ExecutionSummaryData, options?: StageFlowOptions): string {
  const maxStages = options?.maxStages ?? 20;
  const PAD = 24;
  const NODE_W = 130;
  const NODE_H = 64;
  const ARROW_GAP = 44;
  const NODE_SPACING = NODE_W + ARROW_GAP;
  const HDR_H = 48;

  let stages = data.stages;
  let truncated = 0;
  if (stages.length > maxStages) {
    truncated = stages.length - maxStages;
    stages = stages.slice(0, maxStages);
  }

  const nodeCount = stages.length + (truncated > 0 ? 1 : 0);
  const W = options?.width ?? Math.max(400, PAD * 2 + nodeCount * NODE_SPACING - ARROW_GAP);
  const nodesY = HDR_H + 24;
  const H = nodesY + NODE_H + PAD + 8;

  const statusIcon = (s: string) => s === "Success" ? "\u2714" : s === "Failed" || s === "Errored" ? "\u2716" : s === "Running" ? "\u25B6" : "\u25CF";

  const nodes: string[] = [];
  const arrows: string[] = [];
  const gradients: string[] = [];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]!;
    const x = PAD + i * NODE_SPACING;
    const y = nodesY;
    const color = getStatusColor(stage.status);
    const light = getStatusLightColor(stage.status);
    const label = escapeXml(truncateLabel(stage.name, 14));
    const stepCount = stage.steps.length;
    const dur = stage.durationMs > 0 ? fmtDur(stage.durationMs) : "";
    const gId = `nf${i}`;

    gradients.push(`<linearGradient id="${gId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${light}" stop-opacity="0.15"/><stop offset="100%" stop-color="${color}" stop-opacity="0.08"/></linearGradient>`);

    // Node
    nodes.push(`
      <rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="url(#${gId})" stroke="${color}" stroke-width="2" filter="url(#shadow)"/>
      <text x="${x + NODE_W / 2}" y="${y + 20}" fill="${TEXT_PRIMARY}" font-size="11" font-weight="700" font-family="${FONT_FAMILY}" text-anchor="middle">${label}</text>
      <text x="${x + 10}" y="${y + 38}" fill="${color}" font-size="10" font-family="${FONT_FAMILY}">${statusIcon(stage.status)} ${escapeXml(stage.status)}</text>
      ${dur ? `<text x="${x + NODE_W - 10}" y="${y + 38}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="end">${dur}</text>` : ""}
      ${stepCount > 0 ? `<text x="${x + NODE_W / 2}" y="${y + 54}" fill="${TEXT_MUTED}" font-size="8" font-family="${FONT_FAMILY}" text-anchor="middle">${stepCount} step${stepCount > 1 ? "s" : ""}</text>` : ""}
    `);

    // Arrow
    if (i < stages.length - 1 || truncated > 0) {
      const ax1 = x + NODE_W + 4;
      const ax2 = x + NODE_SPACING - 4;
      const ay = y + NODE_H / 2;
      arrows.push(`<line x1="${ax1}" y1="${ay}" x2="${ax2 - 8}" y2="${ay}" stroke="${BORDER_COLOR}" stroke-width="2" marker-end="url(#arrow)"/>`);
    }
  }

  // Truncation node
  if (truncated > 0) {
    const x = PAD + stages.length * NODE_SPACING;
    const y = nodesY;
    nodes.push(`
      <rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="none" stroke="${BORDER_COLOR}" stroke-width="1.5" stroke-dasharray="6,4"/>
      <text x="${x + NODE_W / 2}" y="${y + 36}" fill="${TEXT_MUTED}" font-size="11" font-weight="600" font-family="${FONT_FAMILY}" text-anchor="middle">+${truncated} more</text>
    `);
  }

  const title = escapeXml(truncateLabel(data.pipelineName, 50));
  const statusColor = getStatusColor(data.status);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${svgDefs(W, H)}
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <polygon points="0 0, 10 4, 0 8" fill="${BORDER_COLOR}"/>
    </marker>
    ${gradients.join("")}
  </defs>
  <rect width="${W}" height="${H}" rx="12" fill="url(#bgGrad)"/>
  <rect x="${PAD}" y="${PAD - 4}" width="${W - PAD * 2}" height="32" rx="8" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <rect x="${PAD + 10}" y="${PAD + 2}" width="20" height="20" rx="5" fill="${statusColor}" opacity="0.15"/>
  <text x="${PAD + 20}" y="${PAD + 17}" fill="${statusColor}" font-size="11" font-family="${FONT_FAMILY}" text-anchor="middle">${statusIcon(data.status)}</text>
  <text x="${PAD + 38}" y="${PAD + 17}" fill="${TEXT_PRIMARY}" font-size="13" font-weight="700" font-family="${FONT_FAMILY}">${title}</text>
  ${arrows.join("\n")}
  ${nodes.join("\n")}
</svg>`;
}
