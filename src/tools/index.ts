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
import { registerSchemaTool } from "./harness-schema.js";
import type { SchemaEntry } from "../data/schemas/types.js";
import type { SearchManager } from "../search/index.js";
import "../data/examples/load-all.js";


export function registerAllTools(server: McpServer, registry: Registry, client: HarnessClient, config: Config, additionalSchemas?: Record<string, SchemaEntry>, searchManager?: SearchManager): void {
  registerListTool(server, registry, client, searchManager);
  registerGetTool(server, registry, client, searchManager);
  registerCreateTool(server, registry, client, config);
  registerUpdateTool(server, registry, client, config);
  registerDeleteTool(server, registry, client, config);
  registerExecuteTool(server, registry, client, config);
  registerDiagnoseTool(server, registry, client, config);
  registerSearchTool(server, registry, client, searchManager);
  registerDescribeTool(server, registry);
  registerStatusTool(server, registry, client, config);
  registerSchemaTool(server, registry, client, additionalSchemas);
}
