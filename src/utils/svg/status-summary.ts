/**
 * Project Health Dashboard — health badge, metric cards, recent execution bar.
 */

import type { ProjectHealthData } from "./types.js";
import { getStatusColor, FONT_FAMILY, BG_COLOR, SURFACE_COLOR, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from "./colors.js";
import { escapeXml, truncateLabel } from "./escape.js";

export interface StatusSummaryOptions {
  width?: number;
  maxRecent?: number;
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: "#22c55e",
  degraded: "#eab308",
  failing: "#ef4444",
};

export function renderStatusSummarySvg(data: ProjectHealthData, options?: StatusSummaryOptions): string {
  const width = options?.width ?? 600;
  const maxRecent = options?.maxRecent ?? 20;
  const PADDING = 16;
  const CARD_HEIGHT = 60;
  const CARD_GAP = 12;
  const CARD_WIDTH = Math.floor((width - PADDING * 2 - CARD_GAP * 2) / 3);
  const HEADER_HEIGHT = 56;
  const RECENT_BAR_HEIGHT = 32;

  const recentExecs = data.recentExecutions.slice(0, maxRecent);
  const hasRecent = recentExecs.length > 0;
  const totalHeight = HEADER_HEIGHT + CARD_HEIGHT + (hasRecent ? RECENT_BAR_HEIGHT + CARD_GAP : 0) + PADDING * 3 + CARD_GAP;

  const healthColor = HEALTH_COLORS[data.health] ?? "#9ca3af";
  const healthLabel = data.health.charAt(0).toUpperCase() + data.health.slice(1);

  // Header
  const header = `
    <rect x="${PADDING}" y="${PADDING}" width="${width - PADDING * 2}" height="${HEADER_HEIGHT - PADDING}" rx="6" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1"/>
    <circle cx="${PADDING + 16}" cy="${PADDING + 16}" r="6" fill="${healthColor}"/>
    <text x="${PADDING + 30}" y="${PADDING + 20}" fill="${TEXT_PRIMARY}" font-size="14" font-weight="600" font-family="${FONT_FAMILY}">${escapeXml(data.orgId)} / ${escapeXml(truncateLabel(data.projectId, 30))}</text>
    <text x="${PADDING + 30}" y="${PADDING + 36}" fill="${TEXT_SECONDARY}" font-size="11" font-family="${FONT_FAMILY}">Health: ${escapeXml(healthLabel)}</text>
  `;

  // Metric cards
  const cardsY = HEADER_HEIGHT + CARD_GAP;
  const metrics = [
    { label: "Failed", count: data.counts.failed, color: getStatusColor("Failed") },
    { label: "Running", count: data.counts.running, color: getStatusColor("Running") },
    { label: "Recent", count: data.counts.recent, color: TEXT_SECONDARY },
  ];

  const cards = metrics.map((m, i) => {
    const cx = PADDING + i * (CARD_WIDTH + CARD_GAP);
    return `
      <rect x="${cx}" y="${cardsY}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="6" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1"/>
      <text x="${cx + CARD_WIDTH / 2}" y="${cardsY + 28}" fill="${m.color}" font-size="22" font-weight="700" font-family="${FONT_FAMILY}" text-anchor="middle">${m.count}</text>
      <text x="${cx + CARD_WIDTH / 2}" y="${cardsY + 46}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}" text-anchor="middle">${m.label}</text>
    `;
  }).join("");

  // Recent executions bar
  let recentBar = "";
  if (hasRecent) {
    const barY = cardsY + CARD_HEIGHT + CARD_GAP;
    const barWidth = width - PADDING * 2;
    const segWidth = barWidth / recentExecs.length;

    const segments = recentExecs.map((e, i) => {
      const sx = PADDING + i * segWidth;
      const color = getStatusColor(e.status);
      return `<rect x="${sx}" y="${barY + 8}" width="${Math.max(segWidth - 1, 2)}" height="16" rx="2" fill="${color}" opacity="0.8"><title>${escapeXml(e.pipeline)} - ${escapeXml(e.status)}</title></rect>`;
    }).join("");

    recentBar = `
      <text x="${PADDING}" y="${barY + 4}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}">Recent Executions</text>
      ${segments}
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <rect width="${width}" height="${totalHeight}" rx="8" fill="${BG_COLOR}"/>
  ${header}
  ${cards}
  ${recentBar}
</svg>`;
}
