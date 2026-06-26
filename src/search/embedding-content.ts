import { isRecord } from "../utils/type-guards.js";

/** Flatten Harness tags (object, array, or string) for semantic-search embedding text. */
export function formatTagsForEmbedding(tags: unknown): string {
  if (tags == null) return "";
  if (typeof tags === "string") return tags;
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => formatTagsForEmbedding(tag))
      .filter(Boolean)
      .join(" ");
  }
  if (isRecord(tags)) {
    return Object.entries(tags)
      .map(([key, value]) =>
        value != null && value !== "" ? `${key}:${String(value)}` : key,
      )
      .join(" ");
  }
  return String(tags);
}

/** Build embedding text for a Harness resource list/get item. */
export function buildResourceIndexContent(
  resourceType: string,
  item: Record<string, unknown>,
): string {
  return [
    resourceType.replace(/_/g, " "),
    item["name"],
    item["description"],
    item["identifier"],
    formatTagsForEmbedding(item["tags"]),
  ].filter(Boolean).join(" ");
}
