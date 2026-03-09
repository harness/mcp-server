import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("resource:execution-summary");

export function registerExecutionSummaryResource(server: McpServer, registry: Registry, client: HarnessClient, config: Config): void {
  server.registerResource(
    "execution-summary",
    "executions:///recent",
    {
      title: "Recent Executions",
      description: "Recent pipeline execution summaries (last 10).",
      mimeType: "application/json",
    },
    async (uri) => {
      try {
        log.info("Fetching recent executions");

        const result = await registry.dispatch(client, "execution", "list", {
          org_id: config.HARNESS_DEFAULT_ORG_ID,
          project_id: config.HARNESS_DEFAULT_PROJECT_ID ?? "",
          size: 10,
          page: 0,
        });

        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (err) {
        log.warn("Failed to fetch recent executions", { error: String(err) });
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: String(err), items: [] }, null, 2),
          }],
        };
      }
    },
  );
}
