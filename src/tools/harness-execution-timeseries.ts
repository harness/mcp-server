import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult, mixedResult } from "../utils/response-formatter.js";
import { renderExecutionsTimeseriesSvg } from "../utils/svg/executions-timeseries.js";
import type { ExecutionTimeseriesData, DayCounts } from "../utils/svg/types.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString } from "../utils/type-guards.js";

const log = createLogger("execution-timeseries");

interface ExecutionItem {
  planExecutionId?: string;
  pipelineIdentifier?: string;
  status?: string;
  startTs?: number;
}

function toDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildTimeseriesData(
  orgId: string,
  projectId: string,
  items: ExecutionItem[],
  days: number,
): ExecutionTimeseriesData {
  const now = Date.now();
  const fromMs = now - days * 24 * 60 * 60 * 1000;
  const fromDate = toDateKey(fromMs);
  const toDate = toDateKey(now);

  const dayMap = new Map<string, DayCounts>();
  for (let i = 0; i <= days; i++) {
    const d = new Date(fromMs + i * 24 * 60 * 60 * 1000);
    const key = toDateKey(d.getTime());
    dayMap.set(key, {
      date: key,
      Success: 0,
      Failed: 0,
      Expired: 0,
      Running: 0,
      Aborted: 0,
    });
  }

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalExpired = 0;
  let totalRunning = 0;

  for (const item of items) {
    const ts = item.startTs;
    if (ts == null || ts < fromMs) continue;
    const key = toDateKey(ts);
    const row = dayMap.get(key);
    if (!row) continue;

    const status = item.status ?? "Unknown";
    if (status === "Success") {
      row.Success++;
      totalSuccess++;
    } else if (status === "Failed" || status === "Errored") {
      row.Failed++;
      totalFailed++;
    } else if (status === "Expired") {
      row.Expired++;
      totalExpired++;
    } else if (status === "Running") {
      row.Running++;
      totalRunning++;
    } else if (status === "Aborted") {
      row.Aborted = (row.Aborted ?? 0) + 1;
    }
  }

  const sortedDays = Array.from(dayMap.keys()).sort();
  const daysArray: DayCounts[] = sortedDays.map((date) => dayMap.get(date)!);

  return {
    orgId,
    projectId,
    days: daysArray,
    totalSuccess,
    totalFailed,
    totalExpired,
    totalRunning,
    fromDate,
    toDate,
  };
}

export function registerExecutionTimeseriesTool(
  server: McpServer,
  registry: Registry,
  client: HarnessClient,
  config: Config,
): void {
  server.registerTool(
    "harness_execution_timeseries",
    {
      description: "Get pipeline execution counts over time (timeseries) for a project. Returns a PNG chart of daily Success/Failed/Expired/Running counts for the last N days, plus summary JSON. Use this when the user wants to see execution trends or a visualization of runs over time.",
      inputSchema: {
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        url: z.string().describe("Harness UI URL — org and project extracted automatically").optional(),
        days: z.number().min(1).max(90).describe("Number of days to include (default 30)").default(30).optional(),
        include_visual: z.boolean().describe("Include PNG chart inline (default true)").default(true).optional(),
      },
      annotations: {
        title: "Execution Timeseries",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args, extra) => {
      try {
        const merged = applyUrlDefaults(args as Record<string, unknown>, args.url);
        const orgId = asString(merged.org_id) ?? config.HARNESS_DEFAULT_ORG_ID;
        const projectId = asString(merged.project_id) ?? config.HARNESS_DEFAULT_PROJECT_ID ?? "";
        const days = args.days ?? 30;
        const includeVisual = args.include_visual !== false;

        if (!projectId) {
          return errorResult("project_id is required. Set HARNESS_DEFAULT_PROJECT_ID or pass project_id.");
        }

        log.info("Fetching executions for timeseries", { orgId, projectId, days });

        const listResult = await registry.dispatch(client, "execution", "list", {
          org_id: orgId,
          project_id: projectId,
          size: 100,
          page: 0,
        }, extra.signal);

        const items = (listResult as { items?: ExecutionItem[] }).items ?? [];
        const data = buildTimeseriesData(orgId, projectId, items, days);

        const summary = {
          org_id: orgId,
          project_id: projectId,
          from_date: data.fromDate,
          to_date: data.toDate,
          total_success: data.totalSuccess,
          total_failed: data.totalFailed,
          total_expired: data.totalExpired,
          total_running: data.totalRunning,
          days_with_data: data.days.filter((d) =>
            d.Success + d.Failed + d.Expired + d.Running + (d.Aborted ?? 0) > 0,
          ).length,
        };

        if (includeVisual) {
          const svg = renderExecutionsTimeseriesSvg(data, { width: 900 });
          return mixedResult(summary, svg);
        }
        return jsonResult(summary);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
