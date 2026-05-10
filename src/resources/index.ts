import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";

import { registerPipelineYamlResource } from "./pipeline-yaml.js";
import { registerExecutionSummaryResource } from "./execution-summary.js";
import { registerHarnessSchemaResource } from "./harness-schema.js";
import type { SchemaEntry } from "../data/schemas/index.js";

export function registerAllResources(server: McpServer, registry: Registry, client: HarnessClient, config: Config, additionalSchemas?: Record<string, SchemaEntry>): void {
  registerPipelineYamlResource(server, registry, client, config);
  registerExecutionSummaryResource(server, registry, client, config);
  registerHarnessSchemaResource(server, additionalSchemas);
}
