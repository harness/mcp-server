/**
 * Single source of truth for consolidated MCP tool guardrails.
 * Keep aligned with docs/coding-standards.md and src/tools/index.ts.
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

export const ALLOWED_MCP_TOOL_SET = new Set<string>(ALLOWED_MCP_TOOLS);

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

export const HANDLER_BASENAMES = [
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

export const HANDLER_PATHS = HANDLER_BASENAMES.map((f) => `src/tools/${f}`);

export const ALLOWED_REGISTER_TOOL_FILES = new Set<string>(HANDLER_PATHS);

export const WRITE_HANDLER_PATHS = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** Handlers that call HarnessClient / registry dispatch against the live API. */
export const API_DISPATCH_HANDLER_PATHS = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  ...WRITE_HANDLER_PATHS,
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-status.ts",
] as const;

/** Local metadata / schema tools — no live API dispatch. */
export const LOCAL_ONLY_HANDLER_PATHS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
] as const;
