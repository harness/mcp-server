/**
 * Single source of truth for the fixed consolidated MCP tool surface.
 * Used by architecture guardrails and docs-consistency tests — keep aligned with
 * docs/coding-standards.md and src/tools/index.ts register*Tool() wiring.
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

export const CONSOLIDATED_MCP_TOOL_COUNT = CONSOLIDATED_MCP_TOOLS.length;

/** registerAllTools() in src/tools/index.ts must call exactly these (PascalCase suffix). */
export const REGISTER_TOOL_INDEX_SUFFIXES = [
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

const toolToHandlerFile = (tool: ConsolidatedMcpTool): string => {
  const slug = tool.replace(/^harness_/, "").replace(/_/g, "-");
  return `src/tools/harness-${slug}.ts`;
};

/** Handler files that call server.registerTool() — one per consolidated tool. */
export const ALLOWED_REGISTER_TOOL_FILES: readonly string[] = CONSOLIDATED_MCP_TOOLS.map(toolToHandlerFile);

export const ALLOWED_MCP_TOOLS = new Set<string>(CONSOLIDATED_MCP_TOOLS);

export const ALLOWED_REGISTER_TOOL_FILES_SET = new Set<string>(ALLOWED_REGISTER_TOOL_FILES);

/** Only these harness-*.ts handler files may exist under src/tools/. */
export const ALLOWED_HARNESS_HANDLER_FILES = ALLOWED_REGISTER_TOOL_FILES_SET;

export const WRITE_TOOL_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;
