/**
 * Single source of truth for the fixed MCP tool surface and handler allowlists.
 * Keep in sync with docs/coding-standards.md — docs-consistency.test.ts enforces alignment.
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
export const ALLOWED_HARNESS_HANDLER_FILES = new Set<string>(ALLOWED_REGISTER_TOOL_FILES);

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

/** Toolset helper modules — not required to export a ToolsetDefinition. */
export const TOOLSET_HELPER_FILES = new Set([
  "src/registry/toolsets/chaos-descriptions.ts",
  "src/registry/toolsets/scopes.ts",
]);

/** Legacy inline responseExtractor arrow functions — new ones must live in extractors.ts. */
export const ALLOWED_INLINE_EXTRACTOR_COUNTS: Record<string, number> = {
  "src/registry/toolsets/ansible.ts": 4,
  "src/registry/toolsets/chaos.ts": 2,
  "src/registry/toolsets/ccm.ts": 1,
  "src/registry/toolsets/governance.ts": 1,
  "src/registry/toolsets/iacm.ts": 1,
  "src/registry/toolsets/idp.ts": 1,
  "src/registry/toolsets/knowledge-graph.ts": 1,
  "src/registry/toolsets/sto.ts": 3,
};

export const WRITE_TOOL_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** Handlers that call HarnessClient / registry dispatch against the live API. */
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

/** Local metadata / schema tools — no toMcpError or org_id/project_id required. */
export const LOCAL_ONLY_HANDLERS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
] as const;

export const ALL_HANDLER_FILES = [
  ...API_DISPATCH_HANDLERS,
  ...LOCAL_ONLY_HANDLERS,
] as const;

/** Files allowed to call the global fetch() API (documented exceptions). */
export const ALLOWED_GLOBAL_FETCH_FILES = new Set([
  "src/client/harness-client.ts",
  "src/utils/log-resolver.ts",
  "src/audit/sinks/webhook.ts",
  "src/search/remote-provider.ts",
]);

/** Tool handlers may call client.request() only in documented exceptions. */
export const ALLOWED_CLIENT_REQUEST_FILES = new Set([
  "src/tools/harness-execute.ts",
  "src/tools/entity-schema/live.ts",
  "src/tools/diagnose/pipeline.ts",
]);

/** Only this file may instantiate HarnessClient in production src/. */
export const ALLOWED_HARNESS_CLIENT_FILES = new Set(["src/index.ts"]);

export const FORBIDDEN_TOOLSET_IMPORTS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /from\s+["'][^"']*harness-client/, reason: "HarnessClient import" },
  { pattern: /from\s+["']@modelcontextprotocol\/sdk/, reason: "McpServer/MCP SDK import" },
  { pattern: /from\s+["'][^"']*\/registry\/index/, reason: "Registry import" },
  { pattern: /from\s+["'][^"']*\/utils\/logger/, reason: "createLogger import — logging belongs in handlers" },
];

/** Global fetch API calls — not method names like `async fetch(` or interface `fetch(...)`. */
export const GLOBAL_FETCH_PATTERN = /\bawait fetch\s*\(|\breturn fetch\s*\(|[^.\w]fetch\s*\(\s*["'`]|^fetch\s*\(/m;
