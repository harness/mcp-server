/**
 * Pipeline Stage Flow — left-to-right DAG flowchart.
 * Rounded rectangles per stage with arrows between them.
 */

import type { ExecutionSummaryData } from "./types.js";
import { getStatusColor, FONT_FAMILY, BG_COLOR, TEXT_PRIMARY, TEXT_MUTED, BORDER_COLOR } from "./colors.js";
import { escapeXml, truncateLabel } from "./escape.js";

export interface StageFlowOptions {
  width?: number;
  maxStages?: number;
}

export function renderStageFlowSvg(data: ExecutionSummaryData, options?: StageFlowOptions): string {
  const maxStages = options?.maxStages ?? 20;
  const PADDING = 20;
  const NODE_WIDTH = 120;
  const NODE_HEIGHT = 56;
  const ARROW_GAP = 40;
  const NODE_SPACING = NODE_WIDTH + ARROW_GAP;

  let stages = data.stages;
  let truncatedCount = 0;
  if (stages.length > maxStages) {
    truncatedCount = stages.length - maxStages;
    stages = stages.slice(0, maxStages);
  }

  const nodeCount = stages.length + (truncatedCount > 0 ? 1 : 0);
  const width = options?.width ?? Math.max(400, PADDING * 2 + nodeCount * NODE_SPACING - ARROW_GAP);
  const height = NODE_HEIGHT + PADDING * 2 + 40; // extra for title

  const titleY = PADDING + 14;
  const nodesY = titleY + 20;

  const nodes: string[] = [];
  const arrows: string[] = [];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]!;
    const x = PADDING + i * NODE_SPACING;
    const y = nodesY;
    const color = getStatusColor(stage.status);
    const label = escapeXml(truncateLabel(stage.name, 14));
    const stepCount = stage.steps.length;

    // Node rectangle
    nodes.push(`
      <rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="8" fill="${color}20" stroke="${color}" stroke-width="2"/>
      <text x="${x + NODE_WIDTH / 2}" y="${y + 22}" fill="${TEXT_PRIMARY}" font-size="11" font-weight="600" font-family="${FONT_FAMILY}" text-anchor="middle">${label}</text>
      <text x="${x + NODE_WIDTH / 2}" y="${y + 38}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="middle">${escapeXml(stage.status)}${stepCount > 0 ? ` \u00b7 ${stepCount} steps` : ""}</text>
    `);

    // Arrow to next node
    if (i < stages.length - 1 || truncatedCount > 0) {
      const ax1 = x + NODE_WIDTH;
      const ax2 = x + NODE_SPACING;
      const ay = y + NODE_HEIGHT / 2;
      arrows.push(`
        <line x1="${ax1}" y1="${ay}" x2="${ax2 - 6}" y2="${ay}" stroke="${BORDER_COLOR}" stroke-width="2" marker-end="url(#arrowhead)"/>
      `);
    }
  }

  // Truncation node
  if (truncatedCount > 0) {
    const x = PADDING + stages.length * NODE_SPACING;
    const y = nodesY;
    nodes.push(`
      <rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="8" fill="none" stroke="${BORDER_COLOR}" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${x + NODE_WIDTH / 2}" y="${y + 32}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}" text-anchor="middle">+${truncatedCount} more</text>
    `);
  }

  const title = escapeXml(truncateLabel(data.pipelineName, 50));
  const statusColor = getStatusColor(data.status);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="${BORDER_COLOR}"/>
    </marker>
  </defs>
  <rect width="${width}" height="${height}" rx="8" fill="${BG_COLOR}"/>
  <circle cx="${PADDING}" cy="${titleY - 4}" r="5" fill="${statusColor}"/>
  <text x="${PADDING + 14}" y="${titleY}" fill="${TEXT_PRIMARY}" font-size="13" font-weight="600" font-family="${FONT_FAMILY}">${title}</text>
  ${arrows.join("\n")}
  ${nodes.join("\n")}
</svg>`;
}
