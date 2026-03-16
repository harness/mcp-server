/**
 * Project Health Dashboard — rich version with gradient cards, status bar, indicators.
 */

import type { ProjectHealthData } from "./types.js";
import {
  getStatusColor,
  FONT_FAMILY, SURFACE_COLOR, BORDER_COLOR,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CHART_PALETTE,
  svgDefs,
} from "./colors.js";
import { escapeXml, truncateLabel } from "./escape.js";

export interface StatusSummaryOptions {
  width?: number;
  maxRecent?: number;
}

const HEALTH_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  healthy: { color: "#10b981", bg: "#10b98120", label: "Healthy" },
  degraded: { color: "#f59e0b", bg: "#f59e0b20", label: "Degraded" },
  failing: { color: "#f43f5e", bg: "#f43f5e20", label: "Critical" },
};

export function renderStatusSummarySvg(data: ProjectHealthData, options?: StatusSummaryOptions): string {
  const W = options?.width ?? 620;
  const maxRecent = options?.maxRecent ?? 20;
  const PAD = 24;
  const HDR_H = 60;
  const CARD_H = 72;
  const CARD_GAP = 12;
  const CARD_W = Math.floor((W - PAD * 2 - CARD_GAP * 2) / 3);
  const RECENT_H = 42;

  const recent = data.recentExecutions.slice(0, maxRecent);
  const hasRecent = recent.length > 0;
  const cardsY = HDR_H + CARD_GAP;
  const recentY = cardsY + CARD_H + CARD_GAP;
  const H = recentY + (hasRecent ? RECENT_H + CARD_GAP : 0) + PAD;

  const health = HEALTH_COLORS[data.health] ?? HEALTH_COLORS.healthy!;

  // Header with health badge
  const header = `
    <rect x="${PAD}" y="${PAD}" width="${W - PAD * 2}" height="${HDR_H - PAD}" rx="8" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1" filter="url(#shadow)"/>
    <rect x="${PAD + 14}" y="${PAD + 8}" width="24" height="24" rx="6" fill="${health.bg}"/>
    <circle cx="${PAD + 26}" cy="${PAD + 20}" r="5" fill="${health.color}"/>
    <text x="${PAD + 46}" y="${PAD + 18}" fill="${TEXT_PRIMARY}" font-size="15" font-weight="700" font-family="${FONT_FAMILY}">${escapeXml(data.orgId)} / ${escapeXml(truncateLabel(data.projectId, 25))}</text>
    <rect x="${W - PAD - 90}" y="${PAD + 9}" width="76" height="22" rx="11" fill="${health.bg}" stroke="${health.color}" stroke-width="1"/>
    <text x="${W - PAD - 52}" y="${PAD + 24}" fill="${health.color}" font-size="10" font-weight="700" font-family="${FONT_FAMILY}" text-anchor="middle">${health.label}</text>
  `;

  // Metric cards
  const metrics = [
    { label: "Failed", value: data.counts.failed, color: getStatusColor("Failed"), icon: "\u2716" },
    { label: "Running", value: data.counts.running, color: getStatusColor("Running"), icon: "\u25B6" },
    { label: "Recent", value: data.counts.recent, color: TEXT_SECONDARY, icon: "\u25CF" },
  ];

  const cards = metrics.map((m, i) => {
    const cx = PAD + i * (CARD_W + CARD_GAP);
    return `
      <rect x="${cx}" y="${cardsY}" width="${CARD_W}" height="${CARD_H}" rx="8" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1"/>
      <text x="${cx + 14}" y="${cardsY + 20}" fill="${m.color}" font-size="11" font-family="${FONT_FAMILY}">${m.icon} ${m.label}</text>
      <text x="${cx + CARD_W / 2}" y="${cardsY + 52}" fill="${m.color}" font-size="28" font-weight="800" font-family="${FONT_FAMILY}" text-anchor="middle">${m.value}</text>
    `;
  }).join("");

  // Recent executions bar
  let recentBar = "";
  if (hasRecent) {
    const barW = W - PAD * 2;
    const segW = barW / recent.length;

    const segments = recent.map((e, i) => {
      const sx = PAD + i * segW;
      const color = getStatusColor(e.status);
      return `<rect x="${sx}" y="${recentY + 18}" width="${Math.max(segW - 2, 3)}" height="18" rx="3" fill="${color}" opacity="0.85"><title>${escapeXml(e.pipeline)} \u2014 ${escapeXml(e.status)}</title></rect>`;
    }).join("");

    recentBar = `
      <text x="${PAD}" y="${recentY + 10}" fill="${TEXT_MUTED}" font-size="10" font-weight="600" font-family="${FONT_FAMILY}">RECENT EXECUTIONS</text>
      <text x="${W - PAD}" y="${recentY + 10}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="end">${recent.length} runs</text>
      ${segments}
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${svgDefs(W, H)}
  <rect width="${W}" height="${H}" rx="12" fill="url(#bgGrad)"/>
  ${header}
  ${cards}
  ${recentBar}
</svg>`;
}
