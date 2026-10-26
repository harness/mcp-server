/**
 * Single source of truth for the fixed consolidated MCP tool surface.
 * Keep in sync with docs/coding-standards.md and src/tools/index.ts register* calls.
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

export const CONSOLIDATED_TOOL_COUNT = CONSOLIDATED_MCP_TOOLS.length;

/** MCP tool name → src/tools/harness-*.ts path (repo-relative). */
export function harnessHandlerPath(tool: ConsolidatedMcpTool): string {
  return `src/tools/${tool.replaceAll("_", "-")}.ts`;
}

export const ALLOWED_REGISTER_TOOL_FILES = CONSOLIDATED_MCP_TOOLS.map(harnessHandlerPath);

export const ALLOWED_HARNESS_HANDLER_FILES = new Set(ALLOWED_REGISTER_TOOL_FILES);

/** registerListTool → "List" — used to validate src/tools/index.ts wiring. */
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

export const WRITE_HANDLER_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

export const HANDLER_FILES = [...ALLOWED_REGISTER_TOOL_FILES] as const;

export const ALLOWED_TOOLS_ROOT_FILES = new Set([
  ...ALLOWED_REGISTER_TOOL_FILES.map((p) => p.replace("src/tools/", "")),
  "index.ts",
  "field-copy.ts",
  "input-schemas.ts",
  "output-schemas.ts",
]);
