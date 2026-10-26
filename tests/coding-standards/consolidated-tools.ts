/**
 * Single source of truth for the 11 consolidated MCP tools and their handler paths.
 * Used by architecture, docs-consistency, input-conventions, error-handling, and registry-metadata tests.
 */

/** Canonical MCP tool names — must match registerTool() registrations in src/tools/harness-*.ts */
export const CONSOLIDATED_MCP_TOOLS = [
  "harness_list",
  "harness_get",
  "harness_create",
  "harness_update",
  "harness_delete",
  "harness_execute",
  "harness_diagnose",
  "harness_search",
  "harness_describe",
  "harness_status",
  "harness_schema",
] as const;

export type ConsolidatedMcpTool = (typeof CONSOLIDATED_MCP_TOOLS)[number];

export const CONSOLIDATED_MCP_TOOL_SET = new Set<string>(CONSOLIDATED_MCP_TOOLS);

const HANDLER_BASENAMES = [
  "harness-list.ts",
  "harness-get.ts",
  "harness-create.ts",
  "harness-update.ts",
  "harness-delete.ts",
  "harness-execute.ts",
  "harness-diagnose.ts",
  "harness-search.ts",
  "harness-describe.ts",
  "harness-status.ts",
  "harness-schema.ts",
] as const;

/** Paths relative to repo root (src/tools/harness-*.ts). */
export const HARNESS_HANDLER_PATHS = HANDLER_BASENAMES.map((f) => `src/tools/${f}`);

export const WRITE_HANDLER_PATHS = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** Handlers that call the live Harness API via registry dispatch. */
export const API_HANDLER_PATHS = HARNESS_HANDLER_PATHS.filter(
  (p) => p !== "src/tools/harness-describe.ts" && p !== "src/tools/harness-schema.ts",
);

export const LOCAL_ONLY_HANDLER_PATHS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
] as const;

/** Allowed harness-*.ts filenames under src/tools/ (handlers only). */
export const HARNESS_HANDLER_BASENAMES = new Set<string>(HANDLER_BASENAMES);
