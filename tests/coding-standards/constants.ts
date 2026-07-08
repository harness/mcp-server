/**
 * Single source of truth for coding-standards guardrails.
 *
 * Import from here in tests/coding-standards/*.test.ts and in
 * docs-consistency checks so tool/handler lists cannot drift.
 */

/** The only MCP tools allowed in the server. */
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

/** Only these files may call server.registerTool(). */
export const ALLOWED_REGISTER_TOOL_FILES = [
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

/** Only these harness-*.ts handler files may exist under src/tools/. */
export const ALLOWED_HARNESS_HANDLER_FILES = [...ALLOWED_REGISTER_TOOL_FILES] as const;

export const WRITE_TOOL_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** Handlers that dispatch to the registry against the live Harness API. */
export const API_DISPATCH_HANDLERS = [
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

/** Local metadata tools — no org_id/project_id or toMcpError required. */
export const LOCAL_ONLY_HANDLERS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
] as const;

export const ALL_HANDLER_FILES = [
  ...API_DISPATCH_HANDLERS,
  ...LOCAL_ONLY_HANDLERS,
] as const;
