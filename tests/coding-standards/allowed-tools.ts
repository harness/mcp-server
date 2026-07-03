/**
 * Single source of truth for the fixed MCP tool surface.
 *
 * All coding-standards tests import from here so new handlers cannot drift
 * across files. Canonical list: docs/coding-standards.md §1.
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

export const ALLOWED_MCP_TOOLS_SET = new Set<string>(ALLOWED_MCP_TOOLS);
export const ALLOWED_REGISTER_TOOL_FILES_SET = new Set<string>(ALLOWED_REGISTER_TOOL_FILES);
export const ALLOWED_HARNESS_HANDLER_FILES_SET = new Set<string>(ALLOWED_REGISTER_TOOL_FILES);

/** Write/execute handlers that require confirmation elicitation. */
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

/** Local metadata / schema tools — no API dispatch or scope params required. */
export const LOCAL_ONLY_HANDLERS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
] as const;

/** All harness handler files (for inputSchema documentation checks). */
export const ALL_HANDLER_FILES = [...ALLOWED_REGISTER_TOOL_FILES] as const;

/** Toolset helper modules — not required to export a ToolsetDefinition. */
export const TOOLSET_HELPER_FILES = new Set([
  "src/registry/toolsets/chaos-descriptions.ts",
  "src/registry/toolsets/scopes.ts",
]);

/** Allowed root files under src/tools/ (handlers + shared schemas). */
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

export const ALLOWED_TOOLS_SUBDIRS = new Set(["diagnose", "entity-schema"]);

/** Files allowed to call the global fetch() API (documented exceptions). */
export const ALLOWED_GLOBAL_FETCH_FILES = new Set([
  "src/client/harness-client.ts",
  "src/utils/log-resolver.ts",
  "src/audit/sinks/webhook.ts",
  "src/search/remote-provider.ts",
]);

/** Only this file may instantiate HarnessClient in production src/. */
export const ALLOWED_HARNESS_CLIENT_FILES = new Set(["src/index.ts"]);

/** Tool handlers may call client.request() only in documented exceptions. */
export const ALLOWED_CLIENT_REQUEST_FILES = new Set([
  "src/tools/harness-execute.ts",
  "src/tools/entity-schema/live.ts",
  "src/tools/diagnose/pipeline.ts",
]);
