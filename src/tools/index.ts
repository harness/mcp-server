import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";

import { registerListTool } from "./harness-list.js";
import { registerGetTool } from "./harness-get.js";
import { registerCreateTool } from "./harness-create.js";
import { registerUpdateTool } from "./harness-update.js";
import { registerDeleteTool } from "./harness-delete.js";
import { registerExecuteTool } from "./harness-execute.js";
import { registerDiagnoseTool } from "./harness-diagnose.js";
import { registerSearchTool } from "./harness-search.js";
import { registerDescribeTool } from "./harness-describe.js";
import { registerStatusTool } from "./harness-status.js";

export function registerAllTools(server: McpServer, registry: Registry, client: HarnessClient, config: Config): void {
  registerListTool(server, registry, client);
  registerGetTool(server, registry, client);
  registerCreateTool(server, registry, client);
  registerUpdateTool(server, registry, client);
  registerDeleteTool(server, registry, client);
  registerExecuteTool(server, registry, client);
  registerDiagnoseTool(server, registry, client, config);
  registerSearchTool(server, registry, client);
  registerDescribeTool(server, registry);
  registerStatusTool(server, registry, client, config);
}
