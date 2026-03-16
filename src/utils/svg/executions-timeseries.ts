/**
 * Execution count timeseries — stacked bar chart by day (Success / Failed / Expired / Running).
 */

import type { ExecutionTimeseriesData, DayCounts } from "./types.js";
import { getStatusColor, FONT_FAMILY, BG_COLOR, SURFACE_COLOR, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from "./colors.js";
import { escapeXml } from "./escape.js";

export interface ExecutionsTimeseriesOptions {
  width?: number;
  height?: number;
  barHeight?: number;
  maxDays?: number;
}

const STATUS_ORDER: string[] = ["Success", "Failed", "Expired", "Running", "Aborted"];

function formatShortDate(iso: string): string {
  const d = new Date(iso + "Z");
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${m}/${day}`;
}

export function renderExecutionsTimeseriesSvg(
  data: ExecutionTimeseriesData,
  options?: ExecutionsTimeseriesOptions,
): string {
  const width = options?.width ?? 900;
  const barHeight = options?.barHeight ?? 28;
  const maxDays = options?.maxDays ?? 35;
  const PADDING = 20;
  const LABEL_WIDTH = 52;
  const CHART_LEFT = LABEL_WIDTH + PADDING;
  const CHART_WIDTH = width - CHART_LEFT - PADDING;
  const HEADER_HEIGHT = 56;
  const LEGEND_HEIGHT = 32;

  const days = data.days.slice(-maxDays);
  const dayCount = days.length;
  const rowBarWidth = CHART_WIDTH; // one horizontal stacked bar per row
  const chartHeight = dayCount > 0 ? barHeight * dayCount + (dayCount - 1) * 4 : 0;
  const totalHeight = HEADER_HEIGHT + chartHeight + LEGEND_HEIGHT + PADDING * 2;

  const maxCount = Math.max(
    1,
    ...days.map((d) =>
      STATUS_ORDER.reduce((sum, k) => sum + (typeof d[k] === "number" ? (d[k] as number) : 0), 0),
    ),
  );

  const bars: string[] = [];
  days.forEach((d, i) => {
    const y = HEADER_HEIGHT + PADDING + i * (barHeight + 4);
    let x = CHART_LEFT;
    const total = STATUS_ORDER.reduce((sum, k) => sum + (typeof d[k] === "number" ? (d[k] as number) : 0), 0);
    if (total === 0) {
      bars.push(
        `<rect x="${CHART_LEFT}" y="${y}" width="${rowBarWidth}" height="${barHeight}" rx="3" fill="${BORDER_COLOR}" opacity="0.3"/>`,
      );
    } else {
      for (const status of STATUS_ORDER) {
        const n = typeof d[status] === "number" ? (d[status] as number) : 0;
        if (n <= 0) continue;
        const w = Math.max(1, (n / maxCount) * rowBarWidth);
        const color = getStatusColor(status);
        bars.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${barHeight}" rx="2" fill="${color}" opacity="0.9"><title>${escapeXml(status)} ${n}</title></rect>`,
        );
        x += w;
      }
    }
    const label = formatShortDate(d.date);
    bars.push(
      `<text x="${PADDING}" y="${y + barHeight / 2 + 4}" fill="${TEXT_SECONDARY}" font-size="10" font-family="${FONT_FAMILY}">${escapeXml(label)}</text>`,
    );
  });

  const title = `Executions · ${escapeXml(data.projectId)}`;
  const sub = `${escapeXml(data.fromDate)} – ${escapeXml(data.toDate)} · Total: ${data.totalSuccess} success, ${data.totalFailed} failed`;

  const legendItems = [
    { key: "Success", count: data.totalSuccess },
    { key: "Failed", count: data.totalFailed },
    { key: "Expired", count: data.totalExpired },
    { key: "Running", count: data.totalRunning },
  ].filter((x) => x.count > 0);

  let legendX = PADDING;
  const legendY = HEADER_HEIGHT + chartHeight + PADDING + LEGEND_HEIGHT - 8;
  const legendParts = legendItems.map((item) => {
    const fill = getStatusColor(item.key);
    const text = `${item.key} ${item.count}`;
    const part = `<circle cx="${legendX + 4}" cy="${legendY - 4}" r="3" fill="${fill}"/><text x="${legendX + 14}" y="${legendY}" fill="${TEXT_MUTED}" font-size="10" font-family="${FONT_FAMILY}">${escapeXml(text)}</text>`;
    legendX += 14 + text.length * 6 + 16;
    return part;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <rect width="${width}" height="${totalHeight}" rx="8" fill="${BG_COLOR}"/>
  <rect x="${PADDING}" y="${PADDING}" width="${width - PADDING * 2}" height="${HEADER_HEIGHT - PADDING}" rx="6" fill="${SURFACE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <text x="${PADDING + 16}" y="${PADDING + 20}" fill="${TEXT_PRIMARY}" font-size="14" font-weight="600" font-family="${FONT_FAMILY}">${title}</text>
  <text x="${PADDING + 16}" y="${PADDING + 36}" fill="${TEXT_MUTED}" font-size="11" font-family="${FONT_FAMILY}">${sub}</text>
  ${bars.join("\n")}
  ${legendParts.join("\n  ")}
</svg>`;
}
