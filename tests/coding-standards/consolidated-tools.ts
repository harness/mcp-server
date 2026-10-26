/**
 * Single source of truth for the fixed consolidated MCP tool surface.
 * Keep in sync with docs/coding-standards.md and src/tools/index.ts.
 */

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

export const CONSOLIDATED_TOOL_COUNT = CONSOLIDATED_MCP_TOOLS.length;

/** Files that may call server.registerTool() — one per consolidated tool. */
export const HARNESS_HANDLER_FILES = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-describe.ts",
  "src/tools/harness-status.ts",
  "src/tools/harness-schema.ts",
] as const;

export const HARNESS_HANDLER_FILE_SET = new Set<string>(HARNESS_HANDLER_FILES);

export const REGISTER_TOOL_SUFFIXES = [
  "List",
  "Get",
  "Create",
  "Update",
  "Delete",
  "Execute",
  "Diagnose",
  "Search",
  "Describe",
  "Status",
  "Schema",
] as const;
