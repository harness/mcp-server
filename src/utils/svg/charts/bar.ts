/**
 * Horizontal bar chart — rich version with grid, value axis, gradient bars, labels.
 */

import type { BarChartData } from "./types.js";
import {
  FONT_FAMILY, SURFACE_COLOR, BORDER_COLOR,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, GRID_COLOR, CHART_PALETTE,
  svgDefs,
} from "../colors.js";
import { escapeXml, truncateLabel } from "../escape.js";

export interface BarChartOptions {
  width?: number;
  barHeight?: number;
  maxItems?: number;
}

function fmtVal(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function renderBarChartSvg(data: BarChartData, options?: BarChartOptions): string {
  const W = options?.width ?? 720;
  const barH = options?.barHeight ?? 30;
  const maxItems = options?.maxItems ?? 25;
  const PAD = 24;
  const LABEL_W = 140;
  const VALUE_W = 50;
  const HDR_H = data.subtitle ? 68 : 52;
  const FTR_H = 32;
  const BAR_X = PAD + LABEL_W;
  const BAR_W = W - BAR_X - PAD - VALUE_W;
  const GAP = 6;

  let items = data.items;
  let truncated = 0;
  if (items.length > maxItems) {
    truncated = items.length - maxItems;
    items = items.slice(0, maxItems);
  }

  const maxVal = Math.max(1, ...items.map((i) => i.value));
  const chartH = items.length * (barH + GAP) + (truncated > 0 ? 24 : 0);
  const H = HDR_H + chartH + FTR_H + PAD * 2;
  const total = items.reduce((s, i) => s + i.value, 0);

  // Grid lines (5 vertical)
  const grid: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const x = BAR_X + (i / 4) * BAR_W;
    const val = (maxVal * i) / 4;
    grid.push(`<line x1="${x}" y1="${HDR_H + PAD}" x2="${x}" y2="${HDR_H + PAD + chartH}" stroke="${GRID_COLOR}" stroke-width="1" stroke-dasharray="3,3"/>`);
    grid.push(`<text x="${x}" y="${HDR_H + PAD + chartH + 14}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="middle">${fmtVal(val)}</text>`);
  }

  // X-axis label
  if (data.xLabel) {
    grid.push(`<text x="${BAR_X + BAR_W / 2}" y="${HDR_H + PAD + chartH + 28}" fill="${TEXT_SECONDARY}" font-size="10" font-family="${FONT_FAMILY}" text-anchor="middle">${escapeXml(data.xLabel)}</text>`);
  }

  // Bars
  const bars: string[] = [];
  items.forEach((item, i) => {
    const y = HDR_H + PAD + i * (barH + GAP);
    const w = Math.max(6, (item.value / maxVal) * BAR_W);
    const color = item.color ?? CHART_PALETTE[i % CHART_PALETTE.length]!;
    const label = escapeXml(truncateLabel(item.label, 20));
    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
    const gradId = `bg${i}`;

    // Gradient
    bars.push(`<linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${color}" stop-opacity="0.9"/><stop offset="100%" stop-color="${color}" stop-opacity="0.6"/></linearGradient>`);

    // Row stripe
    if (i % 2 === 0) {
      bars.push(`<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${barH}" rx="4" fill="${SURFACE_COLOR}" opacity="0.25"/>`);
    }

    // Label
    bars.push(`<text x="${PAD + 4}" y="${y + barH / 2 + 4}" fill="${TEXT_PRIMARY}" font-size="11" font-weight="500" font-family="${FONT_FAMILY}">${label}</text>`);

    // Bar
    bars.push(`<rect x="${BAR_X}" y="${y + 5}" width="${w}" height="${barH - 10}" rx="5" fill="url(#${gradId})" filter="url(#shadow)"/>`);

    // Value + percentage
    bars.push(`<text x="${BAR_X + w + 8}" y="${y + barH / 2 + 4}" fill="${TEXT_SECONDARY}" font-size="10" font-weight="600" font-family="${FONT_FAMILY}">${item.value} <tspan fill="${TEXT_MUTED}" font-weight="400">(${pct}%)</tspan></text>`);
  });

  if (truncated > 0) {
    const y = HDR_H + PAD + items.length * (barH + GAP);
    bars.push(`<text x="${PAD + 4}" y="${y + 12}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}" font-style="italic">\u2026 and ${truncated} more</text>`);
  }

  // Header
  const title = escapeXml(truncateLabel(data.title, 45));
  const subtitle = data.subtitle
    ? `<text x="${PAD + 16}" y="${PAD + 38}" fill="${TEXT_MUTED}" font-size="11" font-family="${FONT_FAMILY}">${escapeXml(data.subtitle)}</text>`
    : "";

  // Footer
  const footerY = HDR_H + PAD + chartH + 24;
  const footer = `<text x="${W - PAD}" y="${footerY}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="end">Total: ${fmtVal(total)} \u00b7 ${items.length} items</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${svgDefs(W, H)}
  <rect width="${W}" height="${H}" rx="12" fill="url(#bgGrad)"/>
  <rect x="${PAD}" y="${PAD}" width="${W - PAD * 2}" height="${HDR_H - PAD}" rx="8" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1" filter="url(#shadow)"/>
  <text x="${PAD + 16}" y="${PAD + 22}" fill="${TEXT_PRIMARY}" font-size="15" font-weight="700" font-family="${FONT_FAMILY}">${title}</text>
  ${subtitle}
  ${grid.join("\n")}
  ${bars.filter((b) => !b.startsWith("<linearGradient")).join("\n")}
  ${footer}
  <defs>${bars.filter((b) => b.startsWith("<linearGradient")).join("")}</defs>
</svg>`;
}
