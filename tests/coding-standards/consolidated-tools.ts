/**
 * Single source of truth for the fixed consolidated MCP tool surface.
 * Used by architecture and documentation consistency guardrails.
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
