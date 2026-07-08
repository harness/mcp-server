/**
 * Single source of truth for the 11 consolidated MCP tool handlers.
 * Imported by coding-standards tests and docs-consistency checks — keep in
 * sync with docs/coding-standards.md and AGENTS.md.
 */
export const ALLOWED_MCP_TOOLS = [
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

export type AllowedMcpTool = (typeof ALLOWED_MCP_TOOLS)[number];

/** Only these files may call server.registerTool(). */
export const ALLOWED_HARNESS_HANDLER_FILES = [
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

/** Handlers that perform write/execute operations requiring elicitation. */
export const WRITE_HANDLER_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** Handlers that call HarnessClient / registry dispatch against the live API. */
export const API_HANDLER_FILES = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  ...WRITE_HANDLER_FILES,
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-status.ts",
] as const;

/** Local metadata / schema tools — no live API dispatch. */
export const LOCAL_ONLY_HANDLER_FILES = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
] as const;

/** All 11 harness handler files (API + local-only). */
export const ALL_HANDLER_FILES = [
  ...API_HANDLER_FILES,
  ...LOCAL_ONLY_HANDLER_FILES,
] as const;

/** Allowed root-level files under src/tools/ (handlers + shared schemas). */
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
  "input-schemas.ts",
  "output-schemas.ts",
]);

/** registerAllTools() must wire exactly these register*Tool calls. */
export const EXPECTED_REGISTER_TOOL_CALLS = [
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
