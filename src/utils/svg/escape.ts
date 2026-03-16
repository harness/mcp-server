/**
 * XML safety utilities for SVG generation.
 */

const XML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const XML_ESCAPE_RE = /[&<>"']/g;

export function escapeXml(str: string): string {
  return str.replace(XML_ESCAPE_RE, (ch) => XML_ESCAPE_MAP[ch]!);
}

export function truncateLabel(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}
