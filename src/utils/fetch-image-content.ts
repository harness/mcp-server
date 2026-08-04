/**
 * Fetch a remote image into an MCP image content block (base64).
 * Fail-open: returns undefined on network/size/type errors so callers can
 * still return JSON (e.g. signed_url) without failing the tool call.
 */

import type { ImageContentItem } from "./response-formatter.js";

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
const DEFAULT_TIMEOUT_MS = 10_000;

function normalizeMimeType(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const mime = raw.split(";")[0]?.trim().toLowerCase();
  if (!mime) return undefined;
  if (mime === "image/png" || mime === "image/jpeg" || mime === "image/webp" || mime === "image/gif") {
    return mime;
  }
  return undefined;
}

/**
 * Download `url` and return an MCP `{ type: "image", data, mimeType }` block.
 * Caps response size so tool payloads stay within practical MCP limits.
 */
export async function fetchImageContentBlock(
  url: string,
  options?: { maxBytes?: number; timeoutMs?: number },
): Promise<ImageContentItem | undefined> {
  if (!url || typeof url !== "string") return undefined;

  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) return undefined;

    const mimeType = normalizeMimeType(response.headers.get("content-type")) ?? "image/png";
    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader) {
      const declared = Number(lengthHeader);
      if (Number.isFinite(declared) && declared > maxBytes) return undefined;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) return undefined;

    return {
      type: "image",
      data: buffer.toString("base64"),
      mimeType,
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
