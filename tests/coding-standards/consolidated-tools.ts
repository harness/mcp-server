/**
 * Single source of truth for the fixed consolidated MCP tool surface.
 * Import from here in coding-standards tests — do not duplicate tool lists.
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

export const CONSOLIDATED_MCP_TOOL_COUNT = CONSOLIDATED_MCP_TOOLS.length;

export type ConsolidatedMcpTool = (typeof CONSOLIDATED_MCP_TOOLS)[number];

/** Maps MCP tool name → handler source file under src/tools/. */
export const CONSOLIDATED_TOOL_HANDLER_FILES: Record<ConsolidatedMcpTool, string> = {
  harness_list: "src/tools/harness-list.ts",
  harness_get: "src/tools/harness-get.ts",
  harness_create: "src/tools/harness-create.ts",
  harness_update: "src/tools/harness-update.ts",
  harness_delete: "src/tools/harness-delete.ts",
  harness_execute: "src/tools/harness-execute.ts",
  harness_diagnose: "src/tools/harness-diagnose.ts",
  harness_search: "src/tools/harness-search.ts",
  harness_describe: "src/tools/harness-describe.ts",
  harness_status: "src/tools/harness-status.ts",
  harness_schema: "src/tools/harness-schema.ts",
};

export const ALLOWED_REGISTER_TOOL_FILES = new Set(Object.values(CONSOLIDATED_TOOL_HANDLER_FILES));

/** Only these harness-*.ts handler files may exist under src/tools/. */
export const ALLOWED_HARNESS_HANDLER_FILES = ALLOWED_REGISTER_TOOL_FILES;

export const ALLOWED_MCP_TOOLS = new Set<string>(CONSOLIDATED_MCP_TOOLS);

/** registerAllTools() PascalCase suffixes in src/tools/index.ts */
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

export const WRITE_TOOL_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;
