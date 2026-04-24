/**
 * Standard MCP response formatters.
 *
 * Uses compact JSON (no indentation) to minimize token count for LLM consumers.
 * Errors keep minimal formatting for readability in tool-call error surfaces.
 */

import { svgToPngBase64 } from "./svg/render-png.js";

export type ContentItem =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export interface ToolResult {
  /** Required: MCP SDK's CallToolResult extends Result which has an index signature. */
  [key: string]: unknown;
  content: ContentItem[];
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

export async function imageResult(svgString: string): Promise<ToolResult> {
  const data = await svgToPngBase64(svgString);
  return {
    content: [{ type: "image", data, mimeType: "image/png" }],
  };
}

export interface MixedResultOptions {
  /** Scale factor for PNG (default 3 for crisp inline display). */
  scale?: number;
}

export async function mixedResult(data: unknown, svgString: string, options?: MixedResultOptions): Promise<ToolResult> {
  const scale = options?.scale ?? 3;
  const imageData = await svgToPngBase64(svgString, { scale });
  return {
    content: [
      { type: "text", text: JSON.stringify(data) },
      { type: "image", data: imageData, mimeType: "image/png" },
    ],
  };
}
