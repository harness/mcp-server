/**
 * Standard MCP response formatters.
 *
 * Uses compact JSON (no indentation) to minimize token count for LLM consumers.
 * Errors keep minimal formatting for readability in tool-call error surfaces.
 */

export interface ToolResult {
  /** Required: MCP SDK's CallToolResult extends Result which has an index signature. */
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}
