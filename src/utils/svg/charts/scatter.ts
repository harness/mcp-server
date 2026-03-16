/**
 * Scatter plot — rich version with grid, axes, labels, crosshairs on hover area.
 */

import type { ScatterChartData } from "./types.js";
import {
  FONT_FAMILY, SURFACE_COLOR, BORDER_COLOR,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, GRID_COLOR, CHART_PALETTE,
  svgDefs,
} from "../colors.js";
import { escapeXml, truncateLabel } from "../escape.js";

export interface ScatterChartOptions {
  width?: number;
  height?: number;
  dotRadius?: number;
}

function fmtAxis(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export function renderScatterChartSvg(data: ScatterChartData, options?: ScatterChartOptions): string {
  const W = options?.width ?? 720;
  const plotH = options?.height ?? 360;
  const dotR = options?.dotRadius ?? 5;
  const PAD = 24;
  const HDR_H = data.subtitle ? 68 : 52;
  const AXIS_L = 56;
  const AXIS_B = 48;
  const CX = PAD + AXIS_L;
  const CW = W - CX - PAD;
  const CT = HDR_H + PAD;
  const CH = plotH - AXIS_B;
  const H = HDR_H + plotH + PAD * 2;

  const pts = data.points;

  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const p of pts) {
    if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
  }
  if (!isFinite(xMin)) { xMin = 0; xMax = 1; yMin = 0; yMax = 1; }
  const padX = (xMax - xMin || 1) * 0.08, padY = (yMax - yMin || 1) * 0.08;
  const x0 = xMin - padX, x1 = xMax + padX, y0 = yMin - padY, y1 = yMax + padY;
  const rX = x1 - x0, rY = y1 - y0;
  const sx = (v: number) => CX + ((v - x0) / rX) * CW;
  const sy = (v: number) => CT + CH - ((v - y0) / rY) * CH;

  // Grid
  const grid: string[] = [];
  for (let i = 0; i <= 5; i++) {
    const yVal = y0 + (rY * i) / 5;
    const py = sy(yVal);
    grid.push(`<line x1="${CX}" y1="${py}" x2="${CX + CW}" y2="${py}" stroke="${GRID_COLOR}" stroke-width="1"/>`);
    grid.push(`<text x="${CX - 8}" y="${py + 3}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="end">${fmtAxis(yVal)}</text>`);
  }
  for (let i = 0; i <= 5; i++) {
    const xVal = x0 + (rX * i) / 5;
    const px = sx(xVal);
    grid.push(`<line x1="${px}" y1="${CT}" x2="${px}" y2="${CT + CH}" stroke="${GRID_COLOR}" stroke-width="1"/>`);
    grid.push(`<text x="${px}" y="${CT + CH + 16}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="middle">${fmtAxis(xVal)}</text>`);
  }

  // Axes
  const axes = `
    <line x1="${CX}" y1="${CT}" x2="${CX}" y2="${CT + CH}" stroke="${TEXT_MUTED}" stroke-width="1.5"/>
    <line x1="${CX}" y1="${CT + CH}" x2="${CX + CW}" y2="${CT + CH}" stroke="${TEXT_MUTED}" stroke-width="1.5"/>
  `;

  // Axis labels
  const xLabel = data.xLabel ? `<text x="${CX + CW / 2}" y="${CT + CH + 38}" fill="${TEXT_SECONDARY}" font-size="11" font-weight="600" font-family="${FONT_FAMILY}" text-anchor="middle">${escapeXml(data.xLabel)}</text>` : "";
  const yLabel = data.yLabel ? `<text x="${PAD}" y="${CT + CH / 2}" fill="${TEXT_SECONDARY}" font-size="11" font-weight="600" font-family="${FONT_FAMILY}" text-anchor="middle" transform="rotate(-90,${PAD},${CT + CH / 2})">${escapeXml(data.yLabel)}</text>` : "";

  // Dots with glow
  const dots = pts.map((p, i) => {
    const px = sx(p.x), py = sy(p.y);
    const color = p.color ?? CHART_PALETTE[i % CHART_PALETTE.length]!;
    const tip = p.label ? escapeXml(`${p.label}: (${p.x}, ${p.y})`) : escapeXml(`(${p.x}, ${p.y})`);
    return `<circle cx="${px}" cy="${py}" r="${dotR + 3}" fill="${color}" opacity="0.2"/>` +
      `<circle cx="${px}" cy="${py}" r="${dotR}" fill="${color}" stroke="#fff" stroke-width="1" stroke-opacity="0.3"><title>${tip}</title></circle>`;
  }).join("\n");

  // Header
  const title = escapeXml(truncateLabel(data.title, 45));
  const subtitle = data.subtitle
    ? `<text x="${PAD + 16}" y="${PAD + 38}" fill="${TEXT_MUTED}" font-size="11" font-family="${FONT_FAMILY}">${escapeXml(data.subtitle)}</text>`
    : "";

  // Footer stats
  const avgX = pts.reduce((s, p) => s + p.x, 0) / (pts.length || 1);
  const avgY = pts.reduce((s, p) => s + p.y, 0) / (pts.length || 1);
  const footerY = CT + CH + 38 + (data.xLabel ? 14 : 0);
  const footer = `<text x="${W - PAD}" y="${footerY}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="end">${pts.length} points \u00b7 avg (${fmtAxis(avgX)}, ${fmtAxis(avgY)})</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${svgDefs(W, H)}
  <rect width="${W}" height="${H}" rx="12" fill="url(#bgGrad)"/>
  <rect x="${PAD}" y="${PAD}" width="${W - PAD * 2}" height="${HDR_H - PAD}" rx="8" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1" filter="url(#shadow)"/>
  <text x="${PAD + 16}" y="${PAD + 22}" fill="${TEXT_PRIMARY}" font-size="15" font-weight="700" font-family="${FONT_FAMILY}">${title}</text>
  ${subtitle}
  ${grid.join("\n")}
  ${axes}
  ${dots}
  ${xLabel}
  ${yLabel}
  ${footer}
</svg>`;
}
