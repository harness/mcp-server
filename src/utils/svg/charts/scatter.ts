/**
 * Scatter plot renderer.
 */

import type { ScatterChartData } from "./types.js";
import { FONT_FAMILY, BG_COLOR, SURFACE_COLOR, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from "../colors.js";
import { escapeXml, truncateLabel } from "../escape.js";

export interface ScatterChartOptions {
  width?: number;
  height?: number;
  dotRadius?: number;
}

const DEFAULT_COLOR = "#3b82f6";

export function renderScatterChartSvg(data: ScatterChartData, options?: ScatterChartOptions): string {
  const width = options?.width ?? 700;
  const chartAreaHeight = options?.height ?? 350;
  const dotR = options?.dotRadius ?? 5;
  const PADDING = 20;
  const HEADER_HEIGHT = data.subtitle ? 62 : 48;
  const AXIS_MARGIN_LEFT = 60;
  const AXIS_MARGIN_BOTTOM = 40;
  const CHART_LEFT = PADDING + AXIS_MARGIN_LEFT;
  const CHART_WIDTH = width - CHART_LEFT - PADDING;
  const CHART_TOP = HEADER_HEIGHT + PADDING;
  const CHART_HEIGHT = chartAreaHeight - AXIS_MARGIN_BOTTOM;
  const totalHeight = HEADER_HEIGHT + chartAreaHeight + PADDING * 2;

  const points = data.points;

  // Compute data bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  // Add 10% padding
  const padX = rangeX * 0.1;
  const padY = rangeY * 0.1;
  const xMin = minX - padX;
  const xMax = maxX + padX;
  const yMin = minY - padY;
  const yMax = maxY + padY;
  const rX = xMax - xMin;
  const rY = yMax - yMin;

  function scaleX(v: number): number {
    return CHART_LEFT + ((v - xMin) / rX) * CHART_WIDTH;
  }
  function scaleY(v: number): number {
    return CHART_TOP + CHART_HEIGHT - ((v - yMin) / rY) * CHART_HEIGHT;
  }

  // Grid lines (5 horizontal)
  const gridLines: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const val = yMin + (rY * i) / 4;
    const y = scaleY(val);
    gridLines.push(`<line x1="${CHART_LEFT}" y1="${y}" x2="${CHART_LEFT + CHART_WIDTH}" y2="${y}" stroke="${BORDER_COLOR}" stroke-width="1"/>`);
    const label = Number.isInteger(val) ? String(val) : val.toFixed(1);
    gridLines.push(`<text x="${CHART_LEFT - 8}" y="${y + 4}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="end">${label}</text>`);
  }

  // X-axis labels (5)
  for (let i = 0; i <= 4; i++) {
    const val = xMin + (rX * i) / 4;
    const x = scaleX(val);
    const label = Number.isInteger(val) ? String(val) : val.toFixed(1);
    gridLines.push(`<text x="${x}" y="${CHART_TOP + CHART_HEIGHT + 16}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="middle">${label}</text>`);
  }

  // Dots
  const dots = points.map((p) => {
    const x = scaleX(p.x);
    const y = scaleY(p.y);
    const color = p.color ?? DEFAULT_COLOR;
    const tooltip = p.label ? escapeXml(`${p.label}: (${p.x}, ${p.y})`) : escapeXml(`(${p.x}, ${p.y})`);
    return `<circle cx="${x}" cy="${y}" r="${dotR}" fill="${color}" opacity="0.8"><title>${tooltip}</title></circle>`;
  }).join("\n");

  // Axes
  const axes = `
    <line x1="${CHART_LEFT}" y1="${CHART_TOP}" x2="${CHART_LEFT}" y2="${CHART_TOP + CHART_HEIGHT}" stroke="${TEXT_MUTED}" stroke-width="1"/>
    <line x1="${CHART_LEFT}" y1="${CHART_TOP + CHART_HEIGHT}" x2="${CHART_LEFT + CHART_WIDTH}" y2="${CHART_TOP + CHART_HEIGHT}" stroke="${TEXT_MUTED}" stroke-width="1"/>
  `;

  // Axis labels
  const xAxisLabel = data.xLabel ? `<text x="${CHART_LEFT + CHART_WIDTH / 2}" y="${CHART_TOP + CHART_HEIGHT + 34}" fill="${TEXT_SECONDARY}" font-size="10" font-family="${FONT_FAMILY}" text-anchor="middle">${escapeXml(data.xLabel)}</text>` : "";
  const yAxisLabel = data.yLabel ? `<text x="${PADDING + 4}" y="${CHART_TOP + CHART_HEIGHT / 2}" fill="${TEXT_SECONDARY}" font-size="10" font-family="${FONT_FAMILY}" text-anchor="middle" transform="rotate(-90, ${PADDING + 4}, ${CHART_TOP + CHART_HEIGHT / 2})">${escapeXml(data.yLabel)}</text>` : "";

  const title = escapeXml(truncateLabel(data.title, 50));
  const subtitle = data.subtitle ? `<text x="${PADDING + 12}" y="${PADDING + 36}" fill="${TEXT_MUTED}" font-size="11" font-family="${FONT_FAMILY}">${escapeXml(data.subtitle)}</text>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <rect width="${width}" height="${totalHeight}" rx="8" fill="${BG_COLOR}"/>
  <rect x="${PADDING}" y="${PADDING}" width="${width - PADDING * 2}" height="${HEADER_HEIGHT - PADDING}" rx="6" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <text x="${PADDING + 12}" y="${PADDING + 20}" fill="${TEXT_PRIMARY}" font-size="14" font-weight="600" font-family="${FONT_FAMILY}">${title}</text>
  ${subtitle}
  ${gridLines.join("\n")}
  ${axes}
  ${dots}
  ${xAxisLabel}
  ${yAxisLabel}
</svg>`;
}
