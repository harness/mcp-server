/**
 * Pie / donut chart renderer.
 */

import type { PieChartData } from "./types.js";
import { FONT_FAMILY, BG_COLOR, SURFACE_COLOR, BORDER_COLOR, TEXT_PRIMARY, TEXT_MUTED } from "../colors.js";
import { escapeXml, truncateLabel } from "../escape.js";

export interface PieChartOptions {
  width?: number;
  donut?: boolean;
}

const DEFAULT_COLORS = ["#22c55e", "#ef4444", "#f97316", "#3b82f6", "#a855f7", "#eab308", "#06b6d4", "#ec4899", "#6b7280", "#84cc16"];

/**
 * Convert polar to cartesian. 0° = top (12 o'clock), clockwise.
 */
function toXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/**
 * Build an SVG path for a pie slice (wedge from center) or donut arc.
 */
function slicePath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  const largeArc = sweep > 180 ? 1 : 0;

  const [ox1, oy1] = toXY(cx, cy, outerR, startDeg);
  const [ox2, oy2] = toXY(cx, cy, outerR, endDeg);

  if (innerR <= 0) {
    // Pie wedge: center → outer start → outer arc → close
    return [
      `M ${cx} ${cy}`,
      `L ${ox1} ${oy1}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
      `Z`,
    ].join(" ");
  }

  // Donut arc: outer start → outer arc → line to inner → inner arc back → close
  const [ix1, iy1] = toXY(cx, cy, innerR, startDeg);
  const [ix2, iy2] = toXY(cx, cy, innerR, endDeg);

  return [
    `M ${ox1} ${oy1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
    `Z`,
  ].join(" ");
}

export function renderPieChartSvg(data: PieChartData, options?: PieChartOptions): string {
  const width = options?.width ?? 500;
  const donut = options?.donut ?? true;
  const PADDING = 20;
  const HEADER_HEIGHT = data.subtitle ? 62 : 48;
  const LEGEND_AREA_WIDTH = 180;
  const PIE_AREA = width - LEGEND_AREA_WIDTH - PADDING * 2;
  const radius = Math.min(PIE_AREA, 220) / 2 - 10;
  const cx = PADDING + PIE_AREA / 2;
  const PIE_TOP = HEADER_HEIGHT + PADDING;
  const pieHeight = radius * 2 + 40;
  const cy = PIE_TOP + pieHeight / 2;
  const innerR = donut ? radius * 0.55 : 0;

  const total = data.slices.reduce((s, sl) => s + sl.value, 0);
  const legendLineHeight = 28;
  const legendHeight = data.slices.length * legendLineHeight + 20;
  const totalHeight = Math.max(HEADER_HEIGHT + pieHeight + PADDING * 2, HEADER_HEIGHT + legendHeight + PADDING * 2);

  const paths: string[] = [];
  let currentAngle = 0;

  if (total === 0) {
    paths.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${BORDER_COLOR}" opacity="0.3"/>`);
  } else {
    data.slices.forEach((slice, i) => {
      if (slice.value <= 0) return;
      const sliceAngle = (slice.value / total) * 360;
      const color = slice.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]!;
      const pct = Math.round((slice.value / total) * 100);

      if (sliceAngle >= 359.99) {
        // Full circle — draw concentric circles
        paths.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" opacity="0.85"/>`);
        if (donut) {
          paths.push(`<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${BG_COLOR}"/>`);
        }
      } else {
        const d = slicePath(cx, cy, radius, innerR, currentAngle, currentAngle + sliceAngle);
        paths.push(
          `<path d="${d}" fill="${color}" opacity="0.85">` +
          `<title>${escapeXml(slice.label)}: ${slice.value} (${pct}%)</title></path>`,
        );
      }

      currentAngle += sliceAngle;
    });

    // Donut center label
    if (donut) {
      paths.push(`<text x="${cx}" y="${cy + 6}" fill="${TEXT_PRIMARY}" font-size="20" font-weight="700" font-family="${FONT_FAMILY}" text-anchor="middle">${total}</text>`);
    }
  }

  // Legend
  const legendX = PADDING + PIE_AREA + 10;
  const legendStartY = PIE_TOP + 10;
  const legend = data.slices.map((slice, i) => {
    const y = legendStartY + i * legendLineHeight;
    const color = slice.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]!;
    const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
    const label = escapeXml(truncateLabel(slice.label, 16));
    return `
      <rect x="${legendX}" y="${y}" width="12" height="12" rx="2" fill="${color}" opacity="0.85"/>
      <text x="${legendX + 18}" y="${y + 10}" fill="${TEXT_PRIMARY}" font-size="12" font-family="${FONT_FAMILY}">${label}</text>
      <text x="${legendX + 18}" y="${y + 22}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}">${slice.value} (${pct}%)</text>
    `;
  }).join("");

  const title = escapeXml(truncateLabel(data.title, 40));
  const subtitle = data.subtitle ? `<text x="${PADDING + 12}" y="${PADDING + 36}" fill="${TEXT_MUTED}" font-size="11" font-family="${FONT_FAMILY}">${escapeXml(data.subtitle)}</text>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <rect width="${width}" height="${totalHeight}" rx="8" fill="${BG_COLOR}"/>
  <rect x="${PADDING}" y="${PADDING}" width="${width - PADDING * 2}" height="${HEADER_HEIGHT - PADDING}" rx="6" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <text x="${PADDING + 12}" y="${PADDING + 20}" fill="${TEXT_PRIMARY}" font-size="14" font-weight="600" font-family="${FONT_FAMILY}">${title}</text>
  ${subtitle}
  ${paths.join("\n")}
  ${legend}
</svg>`;
}
