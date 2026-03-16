import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { mixedResult, errorResult } from "../utils/response-formatter.js";
import { renderBarChartSvg } from "../utils/svg/charts/bar.js";
import { renderPieChartSvg } from "../utils/svg/charts/pie.js";
import { renderScatterChartSvg } from "../utils/svg/charts/scatter.js";
import type { BarChartData } from "../utils/svg/charts/types.js";
import type { PieChartData } from "../utils/svg/charts/types.js";
import type { ScatterChartData } from "../utils/svg/charts/types.js";
import { createLogger } from "../utils/logger.js";
import { toMcpError } from "../utils/errors.js";

const log = createLogger("chart");

// ─── Analysis generators ────────────────────────────────────────────────────

interface LabelValue { label: string; value: number; percentage?: number }

function analyzeBar(title: string, items: LabelValue[]): string {
  const total = items.reduce((s, i) => s + i.value, 0);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const lines: string[] = [
    `## ${title}`,
    "",
    `**Total**: ${total} across ${items.length} categories.`,
    "",
    "### Breakdown",
    ...sorted.map((i) => `- **${i.label}**: ${i.value} (${total > 0 ? Math.round((i.value / total) * 100) : 0}%)`),
    "",
    "### Key Insights",
  ];
  if (top && bottom && items.length > 1) {
    lines.push(`- **Highest**: ${top.label} at ${top.value} (${total > 0 ? Math.round((top.value / total) * 100) : 0}% of total).`);
    lines.push(`- **Lowest**: ${bottom.label} at ${bottom.value} (${total > 0 ? Math.round((bottom.value / total) * 100) : 0}% of total).`);
    if (top.value > 0 && bottom.value > 0) {
      lines.push(`- The top category is ${(top.value / bottom.value).toFixed(1)}x the lowest.`);
    }
  }
  return lines.join("\n");
}

function analyzePie(title: string, slices: LabelValue[]): string {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const dominant = sorted[0];
  const lines: string[] = [
    `## ${title}`,
    "",
    `**Total**: ${total} across ${slices.length} segments.`,
    "",
    "### Distribution",
    ...sorted.map((sl) => {
      const pct = total > 0 ? Math.round((sl.value / total) * 100) : 0;
      return `- **${sl.label}**: ${sl.value} (${pct}%)`;
    }),
    "",
    "### Key Insights",
  ];
  if (dominant && total > 0) {
    const domPct = Math.round((dominant.value / total) * 100);
    lines.push(`- **${dominant.label}** is the largest segment at ${domPct}% of total.`);
    if (domPct > 50) {
      lines.push(`- This single category accounts for more than half of all items.`);
    }
  }
  if (slices.length >= 3) {
    const topTwo = sorted.slice(0, 2).reduce((s, sl) => s + sl.value, 0);
    const topTwoPct = total > 0 ? Math.round((topTwo / total) * 100) : 0;
    lines.push(`- Top 2 categories represent ${topTwoPct}% of the total.`);
  }
  return lines.join("\n");
}

interface PointData { x: number; y: number; label?: string }

function analyzeScatter(title: string, points: PointData[], xLabel?: string, yLabel?: string): string {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const avgX = xs.reduce((s, v) => s + v, 0) / xs.length;
  const avgY = ys.reduce((s, v) => s + v, 0) / ys.length;
  const xName = xLabel ?? "X";
  const yName = yLabel ?? "Y";
  const lines: string[] = [
    `## ${title}`,
    "",
    `**${points.length} data points** plotted.`,
    "",
    "### Statistics",
    `| Metric | ${xName} | ${yName} |`,
    `|--------|-------|-------|`,
    `| Min | ${xMin.toFixed(1)} | ${yMin.toFixed(1)} |`,
    `| Max | ${xMax.toFixed(1)} | ${yMax.toFixed(1)} |`,
    `| Average | ${avgX.toFixed(1)} | ${avgY.toFixed(1)} |`,
    `| Range | ${(xMax - xMin).toFixed(1)} | ${(yMax - yMin).toFixed(1)} |`,
  ];
  return lines.join("\n");
}

const BarItemSchema = z.object({
  label: z.string().describe("Bar label"),
  value: z.number().describe("Numeric value"),
  color: z.string().describe("CSS hex color for this bar").optional(),
});

const PieSliceSchema = z.object({
  label: z.string().describe("Slice label"),
  value: z.number().describe("Numeric value"),
  color: z.string().describe("CSS hex color for this slice").optional(),
});

const ScatterPointSchema = z.object({
  x: z.number().describe("X coordinate"),
  y: z.number().describe("Y coordinate"),
  label: z.string().describe("Point label for tooltip").optional(),
  color: z.string().describe("CSS hex color").optional(),
});

export function registerChartTool(
  server: McpServer,
  _registry: Registry,
  _client: HarnessClient,
  _config: Config,
): void {
  server.registerTool(
    "harness_chart",
    {
      description:
        "Render a chart as an inline PNG image. Supports bar, pie, and scatter chart types. " +
        "Provide the chart_type and corresponding data. Useful for visualizing any Harness data " +
        "(execution counts, deployment frequency, failure rates, durations, etc.).",
      inputSchema: {
        chart_type: z.enum(["bar", "pie", "scatter"]).describe("Type of chart to render"),
        title: z.string().describe("Chart title"),
        subtitle: z.string().describe("Optional subtitle / description").optional(),
        width: z.number().min(200).max(1600).describe("Chart width in pixels (default varies by type)").optional(),

        // Bar chart data
        items: z.array(BarItemSchema).describe("Bar chart items — array of {label, value, color?}. Required for chart_type='bar'.").optional(),

        // Pie chart data
        slices: z.array(PieSliceSchema).describe("Pie chart slices — array of {label, value, color?}. Required for chart_type='pie'.").optional(),
        donut: z.boolean().describe("Render as donut chart instead of pie (default true)").default(true).optional(),

        // Scatter chart data
        points: z.array(ScatterPointSchema).describe("Scatter plot points — array of {x, y, label?, color?}. Required for chart_type='scatter'.").optional(),
        x_label: z.string().describe("X-axis label for scatter chart").optional(),
        y_label: z.string().describe("Y-axis label for scatter chart").optional(),
      },
      annotations: {
        title: "Render Chart",
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const { chart_type, title, subtitle, width } = args;

        let svg: string;
        let chartData: Record<string, unknown>;

        switch (chart_type) {
          case "bar": {
            if (!args.items || args.items.length === 0) {
              return errorResult("'items' is required for bar chart. Provide array of {label, value}.");
            }
            const data: BarChartData = { title, subtitle, items: args.items };
            svg = renderBarChartSvg(data, { width });
            const total = args.items.reduce((s, i) => s + i.value, 0);
            const analysis = analyzeBar(title, args.items);
            chartData = { chart_type, title, subtitle, total, item_count: args.items.length, items: args.items, analysis };
            break;
          }
          case "pie": {
            if (!args.slices || args.slices.length === 0) {
              return errorResult("'slices' is required for pie chart. Provide array of {label, value}.");
            }
            const data: PieChartData = { title, subtitle, slices: args.slices };
            svg = renderPieChartSvg(data, { width, donut: args.donut });
            const total = args.slices.reduce((s, sl) => s + sl.value, 0);
            const slicesWithPct = args.slices.map((sl) => ({
              ...sl,
              percentage: total > 0 ? Math.round((sl.value / total) * 100) : 0,
            }));
            const analysis = analyzePie(title, slicesWithPct);
            chartData = { chart_type, title, subtitle, total, slices: slicesWithPct, analysis };
            break;
          }
          case "scatter": {
            if (!args.points || args.points.length === 0) {
              return errorResult("'points' is required for scatter chart. Provide array of {x, y}.");
            }
            const data: ScatterChartData = {
              title,
              subtitle,
              points: args.points,
              xLabel: args.x_label,
              yLabel: args.y_label,
            };
            svg = renderScatterChartSvg(data, { width });
            const analysis = analyzeScatter(title, args.points, args.x_label, args.y_label);
            chartData = { chart_type, title, subtitle, point_count: args.points.length, x_label: args.x_label, y_label: args.y_label, points: args.points, analysis };
            break;
          }
          default:
            return errorResult(`Unknown chart_type '${chart_type}'. Supported: bar, pie, scatter.`);
        }

        log.info("Rendered chart", { chart_type, title });
        return mixedResult(chartData, svg);
      } catch (err) {
        throw toMcpError(err);
      }
    },
  );
}
