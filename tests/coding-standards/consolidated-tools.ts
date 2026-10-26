/**
 * Single source of truth for the 11 consolidated MCP tools and their handler files.
 * Used by coding-standards guardrails — keep in sync with docs/coding-standards.md.
 */

/** MCP tool names exposed by the server (alphabetical). */
export const CONSOLIDATED_MCP_TOOLS = [
  "harness_create",
  "harness_delete",
  "harness_describe",
  "harness_diagnose",
  "harness_execute",
  "harness_get",
  "harness_list",
  "harness_schema",
  "harness_search",
  "harness_status",
  "harness_update",
] as const;

export type ConsolidatedMcpTool = (typeof CONSOLIDATED_MCP_TOOLS)[number];

export const CONSOLIDATED_MCP_TOOL_COUNT = CONSOLIDATED_MCP_TOOLS.length;

/** Handler source files — one registerTool() per consolidated tool. */
export const REGISTER_TOOL_HANDLER_FILES = [
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

export const ALLOWED_MCP_TOOLS = new Set<string>(CONSOLIDATED_MCP_TOOLS);

export const ALLOWED_REGISTER_TOOL_FILES = new Set<string>(REGISTER_TOOL_HANDLER_FILES);

/** Same as REGISTER_TOOL_HANDLER_FILES — no extra harness-*.ts handlers allowed. */
export const ALLOWED_HARNESS_HANDLER_FILES = new Set<string>(REGISTER_TOOL_HANDLER_FILES);

export const HANDLER_FILES = [...REGISTER_TOOL_HANDLER_FILES] as const;

export const WRITE_HANDLER_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** API-calling handlers (registry dispatch / HarnessClient). */
export const API_HANDLER_FILES = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  ...WRITE_HANDLER_FILES,
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-status.ts",
] as const;

/** Local metadata tools — no live API dispatch. */
export const LOCAL_ONLY_HANDLER_FILES = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
] as const;

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
