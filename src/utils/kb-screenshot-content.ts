/**
 * Attach crawl screenshot bytes as MCP image content when harness_get returns
 * a signed URL (kb_page_artifact or kb_crawl_page with include=screenshot).
 */

import { isRecord } from "./type-guards.js";
import { fetchImageContentBlock } from "./fetch-image-content.js";
import type { ContentItem, ToolResult } from "./response-formatter.js";
import { jsonResult } from "./response-formatter.js";

function signedScreenshotUrl(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind !== undefined && value.kind !== "screenshot") return undefined;
  return typeof value.signed_url === "string" ? value.signed_url : undefined;
}

/** Collect signed screenshot URLs from KB get responses (snake_case extractors). */
export function collectKbScreenshotUrls(resourceType: string, result: unknown): string[] {
  if (!isRecord(result)) return [];

  if (resourceType === "kb_page_artifact") {
    const url = signedScreenshotUrl(result);
    return url ? [url] : [];
  }

  if (resourceType === "kb_crawl_page") {
    const included = result.included_artifacts;
    if (!isRecord(included)) return [];
    const url = signedScreenshotUrl(included.screenshot);
    return url ? [url] : [];
  }

  return [];
}

/**
 * Return jsonResult, optionally appending MCP image blocks for KB screenshots.
 * Image fetch failures are ignored — JSON (including signed_url) still returns.
 */
export async function jsonResultWithKbScreenshots(
  resourceType: string,
  result: unknown,
): Promise<ToolResult> {
  const urls = collectKbScreenshotUrls(resourceType, result);
  if (urls.length === 0) return jsonResult(result);

  const images: ContentItem[] = [];
  for (const url of urls) {
    const image = await fetchImageContentBlock(url);
    if (image) images.push(image);
  }
  return jsonResult(result, images);
}
