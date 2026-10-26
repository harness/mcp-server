/**
 * Single source of truth for the fixed consolidated MCP tool surface.
 * Keep in sync with src/tools/index.ts and docs/coding-standards.md.
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

export const CONSOLIDATED_MCP_TOOL_SET = new Set<string>(CONSOLIDATED_MCP_TOOLS);
