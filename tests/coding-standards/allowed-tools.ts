/**
 * Single source of truth for the fixed 11 consolidated MCP tool handlers.
 * Import from here in coding-standards tests — do not duplicate these lists.
 */

/** Registered MCP tool names (server.registerTool first argument). */
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
export const ALLOWED_HARNESS_HANDLER_FILES = ALLOWED_REGISTER_TOOL_FILES;

/** Allowed top-level files under src/tools/ (handlers + shared schemas). */
export const ALLOWED_TOOLS_ROOT_FILES = [
  ...ALLOWED_REGISTER_TOOL_FILES.map((f) => f.replace("src/tools/", "")),
  "index.ts",
  "input-schemas.ts",
  "output-schemas.ts",
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

/** Local metadata / schema tools — no live API dispatch. */
export const LOCAL_ONLY_HANDLERS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
] as const;

/** Write/execute handlers that require confirmation via elicitation. */
export const WRITE_HANDLER_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** All harness handler files (API + local). */
export const ALL_HANDLER_FILES = [
  ...API_DISPATCH_HANDLERS,
  ...LOCAL_ONLY_HANDLERS,
] as const;
