/**
 * Horizontal bar chart renderer.
 */

import type { BarChartData } from "./types.js";
import { FONT_FAMILY, BG_COLOR, SURFACE_COLOR, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from "../colors.js";
import { escapeXml, truncateLabel } from "../escape.js";

export interface BarChartOptions {
  width?: number;
  barHeight?: number;
  maxItems?: number;
}

const DEFAULT_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#eab308", "#a855f7", "#f97316", "#06b6d4", "#ec4899"];

export function renderBarChartSvg(data: BarChartData, options?: BarChartOptions): string {
  const width = options?.width ?? 700;
  const barHeight = options?.barHeight ?? 32;
  const maxItems = options?.maxItems ?? 25;
  const PADDING = 20;
  const LABEL_WIDTH = 140;
  const HEADER_HEIGHT = data.subtitle ? 62 : 48;
  const BAR_AREA_WIDTH = width - LABEL_WIDTH - PADDING * 3 - 60; // 60 for value label

  let items = data.items;
  let truncatedCount = 0;
  if (items.length > maxItems) {
    truncatedCount = items.length - maxItems;
    items = items.slice(0, maxItems);
  }

  const maxVal = Math.max(1, ...items.map((i) => i.value));
  const GAP = 6;
  const chartHeight = items.length * (barHeight + GAP) + (truncatedCount > 0 ? 24 : 0);
  const totalHeight = HEADER_HEIGHT + chartHeight + PADDING * 2;

  const bars: string[] = [];
  items.forEach((item, i) => {
    const y = HEADER_HEIGHT + PADDING + i * (barHeight + GAP);
    const w = Math.max(4, (item.value / maxVal) * BAR_AREA_WIDTH);
    const color = item.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]!;
    const label = escapeXml(truncateLabel(item.label, 20));

    bars.push(`
      <text x="${PADDING}" y="${y + barHeight / 2 + 4}" fill="${TEXT_PRIMARY}" font-size="11" font-family="${FONT_FAMILY}">${label}</text>
      <rect x="${LABEL_WIDTH + PADDING}" y="${y + 4}" width="${w}" height="${barHeight - 8}" rx="4" fill="${color}" opacity="0.85"/>
      <text x="${LABEL_WIDTH + PADDING + w + 8}" y="${y + barHeight / 2 + 4}" fill="${TEXT_SECONDARY}" font-size="11" font-family="${FONT_FAMILY}">${item.value}</text>
    `);
  });

  if (truncatedCount > 0) {
    const y = HEADER_HEIGHT + PADDING + items.length * (barHeight + GAP);
    bars.push(`<text x="${PADDING}" y="${y + 12}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}" font-style="italic">\u2026 and ${truncatedCount} more</text>`);
  }

  const title = escapeXml(truncateLabel(data.title, 50));
  const subtitle = data.subtitle ? `<text x="${PADDING + 12}" y="${PADDING + 36}" fill="${TEXT_MUTED}" font-size="11" font-family="${FONT_FAMILY}">${escapeXml(data.subtitle)}</text>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <rect width="${width}" height="${totalHeight}" rx="8" fill="${BG_COLOR}"/>
  <rect x="${PADDING}" y="${PADDING}" width="${width - PADDING * 2}" height="${HEADER_HEIGHT - PADDING}" rx="6" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <text x="${PADDING + 12}" y="${PADDING + 20}" fill="${TEXT_PRIMARY}" font-size="14" font-weight="600" font-family="${FONT_FAMILY}">${title}</text>
  ${subtitle}
  ${bars.join("\n")}
</svg>`;
}
