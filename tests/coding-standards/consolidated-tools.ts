/**
 * Single source of truth for the 11 consolidated MCP tool handlers.
 * Import from here in coding-standards tests — do not duplicate handler lists.
 *
 * Canonical architecture: docs/coding-standards.md
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

export const ALLOWED_MCP_TOOLS = new Set<string>(CONSOLIDATED_MCP_TOOLS);

/** PascalCase suffixes expected in registerAllTools (registerListTool, …). */
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

export const HANDLER_FILES = [
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

export const ALLOWED_REGISTER_TOOL_FILES = new Set<string>(HANDLER_FILES);

export const ALLOWED_HARNESS_HANDLER_FILES = new Set<string>(HANDLER_FILES);

export const WRITE_TOOL_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** Handlers that call HarnessClient / registry dispatch against the live API. */
export const API_HANDLERS = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-status.ts",
] as const;

/** Local metadata / schema tools — no live API dispatch contract. */
export const LOCAL_ONLY_HANDLERS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
] as const;

/** API handlers that must expose optional org_id / project_id. */
export const SCOPE_AWARE_HANDLERS = API_HANDLERS;

export const ALLOWED_TOOLS_ROOT_FILES = new Set([
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
  "index.ts",
  "field-copy.ts",
  "input-schemas.ts",
  "output-schemas.ts",
]);
