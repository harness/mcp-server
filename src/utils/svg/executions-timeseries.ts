/**
 * Execution count timeseries — stacked bar chart by day.
 * Rich version: gradient bars, grid, axis labels, legend, totals footer.
 */

import type { ExecutionTimeseriesData } from "./types.js";
import {
  getStatusColor,
  FONT_FAMILY, SURFACE_COLOR, BORDER_COLOR,
  TEXT_PRIMARY, TEXT_MUTED, GRID_COLOR,
  svgDefs,
} from "./colors.js";
import { escapeXml } from "./escape.js";

export interface ExecutionsTimeseriesOptions {
  width?: number;
  barHeight?: number;
  maxDays?: number;
}

const STATUS_ORDER: string[] = ["Success", "Failed", "Expired", "Running", "Aborted"];

function fmtShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function renderExecutionsTimeseriesSvg(
  data: ExecutionTimeseriesData,
  options?: ExecutionsTimeseriesOptions,
): string {
  const W = options?.width ?? 900;
  const barH = options?.barHeight ?? 24;
  const maxDays = options?.maxDays ?? 35;
  const PAD = 24;
  const LABEL_W = 56;
  const CHART_LEFT = PAD + LABEL_W;
  const CHART_W = W - CHART_LEFT - PAD;
  const HDR_H = 64;
  const LEGEND_H = 36;
  const GAP = 3;

  const days = data.days.slice(-maxDays);
  const dayCount = days.length;
  const chartH = dayCount > 0 ? (barH + GAP) * dayCount : 0;
  const H = HDR_H + chartH + LEGEND_H + PAD * 2;

  const maxCount = Math.max(1, ...days.map((d) =>
    STATUS_ORDER.reduce((sum, k) => sum + (typeof d[k] === "number" ? (d[k] as number) : 0), 0),
  ));

  // Grid (5 vertical lines)
  const grid: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const x = CHART_LEFT + (i / 4) * CHART_W;
    const val = Math.round((maxCount * i) / 4);
    grid.push(`<line x1="${x}" y1="${HDR_H + PAD}" x2="${x}" y2="${HDR_H + PAD + chartH}" stroke="${GRID_COLOR}" stroke-width="1" stroke-dasharray="3,3"/>`);
    if (i > 0) grid.push(`<text x="${x}" y="${HDR_H + PAD + chartH + 14}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="middle">${val}</text>`);
  }

  // Bars
  const bars: string[] = [];
  days.forEach((d, i) => {
    const y = HDR_H + PAD + i * (barH + GAP);
    let x = CHART_LEFT;
    const total = STATUS_ORDER.reduce((sum, k) => sum + (typeof d[k] === "number" ? (d[k] as number) : 0), 0);

    // Row stripe
    if (i % 2 === 0) {
      bars.push(`<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${barH}" rx="3" fill="${SURFACE_COLOR}" opacity="0.2"/>`);
    }

    if (total === 0) {
      bars.push(`<rect x="${CHART_LEFT}" y="${y + 2}" width="${CHART_W}" height="${barH - 4}" rx="3" fill="${BORDER_COLOR}" opacity="0.15"/>`);
    } else {
      for (const status of STATUS_ORDER) {
        const n = typeof d[status] === "number" ? (d[status] as number) : 0;
        if (n <= 0) continue;
        const w = Math.max(2, (n / maxCount) * CHART_W);
        const color = getStatusColor(status);
        bars.push(`<rect x="${x}" y="${y + 2}" width="${w}" height="${barH - 4}" rx="3" fill="${color}" opacity="0.85"><title>${escapeXml(status)}: ${n} on ${d.date}</title></rect>`);
        x += w;
      }
    }

    // Date label
    const label = fmtShortDate(d.date);
    bars.push(`<text x="${PAD + 4}" y="${y + barH / 2 + 4}" fill="${TEXT_MUTED}" font-size="9" font-weight="500" font-family="${FONT_FAMILY}">${escapeXml(label)}</text>`);
  });

  // Header
  const title = `Execution Timeseries \u00b7 ${escapeXml(data.projectId)}`;
  const sub = `${escapeXml(data.fromDate)} \u2013 ${escapeXml(data.toDate)}`;

  // Legend
  const legendItems = [
    { key: "Success", count: data.totalSuccess },
    { key: "Failed", count: data.totalFailed },
    { key: "Expired", count: data.totalExpired },
    { key: "Running", count: data.totalRunning },
  ].filter((x) => x.count > 0);

  const legendY = HDR_H + PAD + chartH + 24;
  let legendX = PAD;
  const legendParts = legendItems.map((item) => {
    const fill = getStatusColor(item.key);
    const text = `${item.key} ${item.count}`;
    const part = `<rect x="${legendX}" y="${legendY - 5}" width="10" height="10" rx="2" fill="${fill}"/><text x="${legendX + 14}" y="${legendY + 4}" fill="${TEXT_MUTED}" font-size="10" font-weight="500" font-family="${FONT_FAMILY}">${escapeXml(text)}</text>`;
    legendX += 16 + text.length * 6 + 16;
    return part;
  });

  const total = data.totalSuccess + data.totalFailed + data.totalExpired + data.totalRunning;
  const totalLabel = `<text x="${W - PAD}" y="${legendY + 4}" fill="${TEXT_MUTED}" font-size="9" font-family="${FONT_FAMILY}" text-anchor="end">Total: ${total}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${svgDefs(W, H)}
  <rect width="${W}" height="${H}" rx="12" fill="url(#bgGrad)"/>
  <rect x="${PAD}" y="${PAD}" width="${W - PAD * 2}" height="${HDR_H - PAD}" rx="8" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1" filter="url(#shadow)"/>
  <text x="${PAD + 16}" y="${PAD + 20}" fill="${TEXT_PRIMARY}" font-size="14" font-weight="700" font-family="${FONT_FAMILY}">${title}</text>
  <text x="${PAD + 16}" y="${PAD + 36}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}">${sub}</text>
  ${grid.join("\n")}
  ${bars.join("\n")}
  ${legendParts.join("\n  ")}
  ${totalLabel}
</svg>`;
}
