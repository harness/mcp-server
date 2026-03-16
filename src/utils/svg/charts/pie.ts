/**
 * Pie / donut chart renderer — rich version with gradient slices, labels, legend.
 */

import type { PieChartData } from "./types.js";
import {
  FONT_FAMILY, SURFACE_COLOR, BORDER_COLOR,
  TEXT_PRIMARY, TEXT_MUTED, CHART_PALETTE, svgDefs,
} from "../colors.js";
import { escapeXml, truncateLabel } from "../escape.js";

export interface PieChartOptions {
  width?: number;
  donut?: boolean;
}

function toXY(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function slicePath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  const large = sweep > 180 ? 1 : 0;
  const [ox1, oy1] = toXY(cx, cy, outerR, startDeg);
  const [ox2, oy2] = toXY(cx, cy, outerR, endDeg);

  if (innerR <= 0) {
    return `M ${cx} ${cy} L ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} Z`;
  }
  const [ix1, iy1] = toXY(cx, cy, innerR, startDeg);
  const [ix2, iy2] = toXY(cx, cy, innerR, endDeg);
  return `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`;
}

export function renderPieChartSvg(data: PieChartData, options?: PieChartOptions): string {
  const W = options?.width ?? 520;
  const donut = options?.donut ?? true;
  const PAD = 24;
  const HDR_H = data.subtitle ? 68 : 52;
  const LEGEND_W = 190;
  const PIE_AREA = W - LEGEND_W - PAD * 2;
  const R = Math.min(PIE_AREA, 220) / 2 - 8;
  const cx = PAD + PIE_AREA / 2;
  const PIE_TOP = HDR_H + PAD;
  const pieH = R * 2 + 40;
  const cy = PIE_TOP + pieH / 2;
  const innerR = donut ? R * 0.58 : 0;

  const total = data.slices.reduce((s, sl) => s + sl.value, 0);
  const LEGEND_LINE_H = 32;
  const legendH = data.slices.length * LEGEND_LINE_H + 20;
  const H = Math.max(HDR_H + pieH + PAD * 2, HDR_H + legendH + PAD * 2);

  const paths: string[] = [];
  let angle = 0;

  if (total === 0) {
    paths.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="2"/>`);
    paths.push(`<text x="${cx}" y="${cy + 4}" fill="${TEXT_MUTED}" font-size="12" font-family="${FONT_FAMILY}" text-anchor="middle">No data</text>`);
  } else {
    data.slices.forEach((slice, i) => {
      if (slice.value <= 0) return;
      const deg = (slice.value / total) * 360;
      const color = slice.color ?? CHART_PALETTE[i % CHART_PALETTE.length]!;
      const pct = Math.round((slice.value / total) * 100);

      if (deg >= 359.99) {
        paths.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${color}"/>`);
        if (donut) paths.push(`<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#0f172a"/>`);
      } else {
        const d = slicePath(cx, cy, R, innerR, angle, angle + deg);
        paths.push(`<path d="${d}" fill="${color}"><title>${escapeXml(slice.label)}: ${slice.value} (${pct}%)</title></path>`);

        // Percentage label on larger slices
        if (deg > 25) {
          const midAngle = angle + deg / 2;
          const labelR = donut ? (R + innerR) / 2 : R * 0.65;
          const [lx, ly] = toXY(cx, cy, labelR, midAngle);
          paths.push(`<text x="${lx}" y="${ly + 4}" fill="#fff" font-size="11" font-weight="700" font-family="${FONT_FAMILY}" text-anchor="middle" style="text-shadow: 0 1px 3px rgba(0,0,0,0.5)">${pct}%</text>`);
        }
      }
      angle += deg;
    });

    // Donut center
    if (donut) {
      paths.push(`<circle cx="${cx}" cy="${cy}" r="${innerR - 2}" fill="#0f172a" stroke="${BORDER_COLOR}" stroke-width="1"/>`);
      paths.push(`<text x="${cx}" y="${cy - 2}" fill="${TEXT_PRIMARY}" font-size="22" font-weight="800" font-family="${FONT_FAMILY}" text-anchor="middle">${total}</text>`);
      paths.push(`<text x="${cx}" y="${cy + 14}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="middle">TOTAL</text>`);
    }
  }

  // Legend
  const legendX = PAD + PIE_AREA + 16;
  const legendStartY = PIE_TOP + 8;
  const legend = data.slices.map((slice, i) => {
    const y = legendStartY + i * LEGEND_LINE_H;
    const color = slice.color ?? CHART_PALETTE[i % CHART_PALETTE.length]!;
    const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
    const label = escapeXml(truncateLabel(slice.label, 16));
    return `
      <rect x="${legendX}" y="${y}" width="14" height="14" rx="3" fill="${color}"/>
      <text x="${legendX + 22}" y="${y + 10}" fill="${TEXT_PRIMARY}" font-size="12" font-weight="600" font-family="${FONT_FAMILY}">${label}</text>
      <text x="${legendX + 22}" y="${y + 24}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}">${slice.value} \u00b7 ${pct}%</text>
    `;
  }).join("");

  const title = escapeXml(truncateLabel(data.title, 35));
  const subtitle = data.subtitle
    ? `<text x="${PAD + 16}" y="${PAD + 38}" fill="${TEXT_MUTED}" font-size="11" font-family="${FONT_FAMILY}">${escapeXml(data.subtitle)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${svgDefs(W, H)}
  <rect width="${W}" height="${H}" rx="12" fill="url(#bgGrad)"/>
  <rect x="${PAD}" y="${PAD}" width="${W - PAD * 2}" height="${HDR_H - PAD}" rx="8" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1" filter="url(#shadow)"/>
  <text x="${PAD + 16}" y="${PAD + 22}" fill="${TEXT_PRIMARY}" font-size="15" font-weight="700" font-family="${FONT_FAMILY}">${title}</text>
  ${subtitle}
  ${paths.join("\n")}
  ${legend}
</svg>`;
}
