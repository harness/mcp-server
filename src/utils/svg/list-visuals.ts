/**
 * Visual chart generation for harness_list results.
 * Builds charts from list result items based on resource type and visual_type.
 */

import type { ExecutionTimeseriesData, DayCounts } from "./types.js";
import { renderExecutionsTimeseriesSvg } from "./executions-timeseries.js";
import { renderBarChartSvg } from "./charts/bar.js";
import { renderPieChartSvg } from "./charts/pie.js";
import { getStatusColor, CHART_PALETTE } from "./colors.js";

// ─── Execution item shape (minimal, from list result) ────────────────────────

interface ExecutionItem {
  planExecutionId?: string;
  pipelineIdentifier?: string;
  name?: string;
  status?: string;
  startTs?: number;
}

// ─── Timeseries aggregation ──────────────────────────────────────────────────

function toDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function buildTimeseriesData(items: ExecutionItem[], days: number): ExecutionTimeseriesData {
  const now = Date.now();
  const fromMs = now - days * 24 * 60 * 60 * 1000;

  const dayMap = new Map<string, DayCounts>();
  for (let i = 0; i <= days; i++) {
    const key = toDateKey(fromMs + i * 86400000);
    dayMap.set(key, { date: key, Success: 0, Failed: 0, Expired: 0, Running: 0, Aborted: 0 });
  }

  let totalSuccess = 0, totalFailed = 0, totalExpired = 0, totalRunning = 0;

  for (const item of items) {
    if (item.startTs == null || item.startTs < fromMs) continue;
    const row = dayMap.get(toDateKey(item.startTs));
    if (!row) continue;
    const s = item.status ?? "Unknown";
    if (s === "Success") { row.Success++; totalSuccess++; }
    else if (s === "Failed" || s === "Errored") { row.Failed++; totalFailed++; }
    else if (s === "Expired") { row.Expired++; totalExpired++; }
    else if (s === "Running") { row.Running++; totalRunning++; }
    else if (s === "Aborted") { row.Aborted = (row.Aborted ?? 0) + 1; }
  }

  const sorted = Array.from(dayMap.keys()).sort();
  return {
    orgId: "", projectId: "",
    days: sorted.map((k) => dayMap.get(k)!),
    totalSuccess, totalFailed, totalExpired, totalRunning,
    fromDate: sorted[0] ?? "", toDate: sorted[sorted.length - 1] ?? "",
  };
}

// ─── Status aggregation ──────────────────────────────────────────────────────

interface StatusCount { label: string; value: number; color: string }

function aggregateByStatus(items: ExecutionItem[]): StatusCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const s = item.status ?? "Unknown";
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: getStatusColor(label) }));
}

// ─── Pipeline aggregation ────────────────────────────────────────────────────

function aggregateByPipeline(items: ExecutionItem[]): StatusCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const p = item.pipelineIdentifier ?? item.name ?? "unknown";
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: CHART_PALETTE[i % CHART_PALETTE.length]! }));
}

// ─── Analysis text ───────────────────────────────────────────────────────────

function buildAnalysis(title: string, items: StatusCount[]): string {
  const total = items.reduce((s, i) => s + i.value, 0);
  const lines = [
    `## ${title}`,
    "",
    `**Total**: ${total} across ${items.length} categories.`,
    "",
    "### Breakdown",
    ...items.map((i) => `- **${i.label}**: ${i.value} (${total > 0 ? Math.round((i.value / total) * 100) : 0}%)`),
  ];
  if (items.length > 1) {
    const top = items[0]!;
    lines.push("", "### Key Insights");
    lines.push(`- **${top.label}** is the largest at ${total > 0 ? Math.round((top.value / total) * 100) : 0}% of total.`);
    if (items.length >= 3) {
      const topTwo = items.slice(0, 2).reduce((s, i) => s + i.value, 0);
      lines.push(`- Top 2 represent ${total > 0 ? Math.round((topTwo / total) * 100) : 0}% of total.`);
    }
  }
  return lines.join("\n");
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type ListVisualType = "timeseries" | "bar" | "pie";

export interface ListVisualResult {
  svg: string;
  analysis: string;
}

/**
 * Generate a chart SVG from list result items.
 * Only works for execution-type resources. Returns null for non-execution types.
 */
export function renderListVisual(
  resourceType: string,
  items: unknown[],
  visualType: ListVisualType,
): ListVisualResult | null {
  // Only execution resources support visuals
  if (resourceType !== "execution") return null;

  const execItems = items as ExecutionItem[];
  if (execItems.length === 0) return null;

  switch (visualType) {
    case "timeseries": {
      const data = buildTimeseriesData(execItems, 30);
      const svg = renderExecutionsTimeseriesSvg(data, { width: 900 });
      const analysis = [
        `## Execution Timeseries (last 30 days)`,
        "",
        `**${data.totalSuccess}** success, **${data.totalFailed}** failed, **${data.totalExpired}** expired, **${data.totalRunning}** running.`,
        "",
        `Active days: ${data.days.filter((d) => d.Success + d.Failed + d.Expired + d.Running > 0).length} of ${data.days.length}.`,
      ].join("\n");
      return { svg, analysis };
    }
    case "pie": {
      const counts = aggregateByStatus(execItems);
      const total = counts.reduce((s, c) => s + c.value, 0);
      const svg = renderPieChartSvg(
        { title: "Executions by status", subtitle: `${total} executions`, slices: counts },
        { donut: true },
      );
      return { svg, analysis: buildAnalysis("Executions by status", counts) };
    }
    case "bar": {
      const counts = aggregateByPipeline(execItems);
      const total = counts.reduce((s, c) => s + c.value, 0);
      const svg = renderBarChartSvg(
        { title: "Executions by pipeline", subtitle: `${total} executions`, items: counts },
      );
      return { svg, analysis: buildAnalysis("Executions by pipeline", counts) };
    }
    default:
      return null;
  }
}
