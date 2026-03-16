import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult, mixedResult } from "../utils/response-formatter.js";
import { toProjectHealthData, renderStatusSummarySvg } from "../utils/svg/index.js";
import { buildDeepLink } from "../utils/deep-links.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import { sendProgress } from "../utils/progress.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString } from "../utils/type-guards.js";

const log = createLogger("status");

interface ExecutionItem {
  pipelineIdentifier?: string;
  planExecutionId?: string;
  name?: string;
  status?: string;
  startTs?: number;
  endTs?: number;
}

interface ListResult {
  items?: ExecutionItem[];
  total?: number;
}

function summarizeExecution(
  exec: ExecutionItem,
  baseUrl: string,
  accountId: string,
  orgId: string,
  projectId: string,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    execution_id: exec.planExecutionId,
    pipeline: exec.pipelineIdentifier,
    name: exec.name,
    status: exec.status,
    started_at: exec.startTs ? new Date(exec.startTs).toISOString() : undefined,
    ended_at: exec.endTs ? new Date(exec.endTs).toISOString() : undefined,
  };

  if (exec.planExecutionId && exec.pipelineIdentifier) {
    try {
      summary.openInHarness = buildDeepLink(baseUrl, accountId,
        "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipelineIdentifier}/executions/{planExecutionId}/pipeline",
        {
          orgIdentifier: orgId,
          projectIdentifier: projectId,
          pipelineIdentifier: exec.pipelineIdentifier,
          planExecutionId: exec.planExecutionId,
        },
      );
    } catch {
      // non-critical
    }
  }

  return summary;
}

export function registerStatusTool(
  server: McpServer,
  registry: Registry,
  client: HarnessClient,
  config: Config,
): void {
  server.registerTool(
    "harness_status",
    {
      description: "Get a live project health overview: recent failed executions, currently running executions, and recent deployment activity. You can pass a Harness URL to auto-extract org and project. Ideal first question: 'what's happening in my project right now?'",
      inputSchema: {
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        url: z.string().describe("A Harness UI URL — org and project are extracted automatically").optional(),
        limit: z.number().describe("Max items per section (default 5, max 20)").default(5).optional(),
        include_visual: z.boolean().describe("Include visual health dashboard image (default false)").default(false).optional(),
      },
      annotations: {
        title: "Project Health Status",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args, extra) => {
      try {
        const signal = extra.signal;
        const merged = applyUrlDefaults(args as Record<string, unknown>, args.url);
        const orgId = asString(merged.org_id) ?? config.HARNESS_DEFAULT_ORG_ID;
        const projectId = asString(merged.project_id) ?? config.HARNESS_DEFAULT_PROJECT_ID ?? "";
        const limit = Math.min(args.limit ?? 5, 20);

        const baseInput: Record<string, unknown> = {
          org_id: orgId,
          project_id: projectId,
          size: limit,
          page: 0,
        };

        log.info("Fetching project status", { orgId, projectId, limit });
        await sendProgress(extra, 0, 2, "Fetching failed, running, and recent executions...");

        // 3 parallel dispatches: failed, running, recent activity
        const [failedResult, runningResult, recentResult] = await Promise.allSettled([
          registry.dispatch(client, "execution", "list", {
            ...baseInput,
            status: "Failed",
          }, signal),
          registry.dispatch(client, "execution", "list", {
            ...baseInput,
            status: "Running",
          }, signal),
          registry.dispatch(client, "execution", "list", {
            ...baseInput,
            size: Math.min(limit * 2, 20),
          }, signal),
        ]);

        // Extract results with graceful degradation
        const failed = failedResult.status === "fulfilled"
          ? (failedResult.value as ListResult)
          : null;
        const running = runningResult.status === "fulfilled"
          ? (runningResult.value as ListResult)
          : null;
        const recent = recentResult.status === "fulfilled"
          ? (recentResult.value as ListResult)
          : null;

        if (failedResult.status === "rejected") {
          log.warn("Failed to fetch failed executions", { error: String(failedResult.reason) });
        }
        if (runningResult.status === "rejected") {
          log.warn("Failed to fetch running executions", { error: String(runningResult.reason) });
        }
        if (recentResult.status === "rejected") {
          log.warn("Failed to fetch recent executions", { error: String(recentResult.reason) });
        }

        await sendProgress(extra, 1, 2, "Building status summary...");

        const failedItems = (failed?.items ?? []).map((e) =>
          summarizeExecution(e, config.HARNESS_BASE_URL, config.HARNESS_ACCOUNT_ID, orgId, projectId),
        );
        const runningItems = (running?.items ?? []).map((e) =>
          summarizeExecution(e, config.HARNESS_BASE_URL, config.HARNESS_ACCOUNT_ID, orgId, projectId),
        );
        const recentItems = (recent?.items ?? []).map((e) =>
          summarizeExecution(e, config.HARNESS_BASE_URL, config.HARNESS_ACCOUNT_ID, orgId, projectId),
        );

        // Compute health
        const totalFailed = failed?.total ?? failedItems.length;
        const totalRunning = running?.total ?? runningItems.length;
        const totalRecent = recent?.total ?? recentItems.length;

        let health: "healthy" | "degraded" | "failing";
        if (totalFailed === 0) {
          health = "healthy";
        } else if (totalRecent > 0 && totalFailed < totalRecent) {
          health = "degraded";
        } else {
          health = "failing";
        }

        // Build project-level deployments deep link
        let deploymentsLink: string | undefined;
        try {
          deploymentsLink = buildDeepLink(
            config.HARNESS_BASE_URL,
            config.HARNESS_ACCOUNT_ID,
            "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/deployments",
            { orgIdentifier: orgId, projectIdentifier: projectId },
          );
        } catch {
          // non-critical
        }

        // Collect errors from rejected promises
        const errors: Record<string, string> = {};
        if (failedResult.status === "rejected") errors.failed = String(failedResult.reason);
        if (runningResult.status === "rejected") errors.running = String(runningResult.reason);
        if (recentResult.status === "rejected") errors.recent = String(recentResult.reason);

        await sendProgress(extra, 2, 2, "Status complete");

        const status: Record<string, unknown> = {
          project: {
            org: orgId,
            project: projectId,
            url: deploymentsLink,
          },
          failed_executions: failedItems,
          running_executions: runningItems,
          recent_activity: recentItems,
          summary: {
            total_failed: totalFailed,
            total_running: totalRunning,
            total_recent: totalRecent,
            health,
          },
          openInHarness: deploymentsLink,
        };

        if (Object.keys(errors).length > 0) {
          status._errors = errors;
        }

        // Visual rendering (opt-in)
        if (args.include_visual) {
          try {
            const healthData = toProjectHealthData(status, orgId, projectId);
            if (healthData) {
              const svg = renderStatusSummarySvg(healthData);
              return mixedResult(status, svg);
            }
          } catch (err) {
            log.warn("SVG rendering failed, returning text-only", { error: String(err) });
          }
        }

        return jsonResult(status);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
