/** One `executableResponses[]` entry; the variant key varies by step type. */
type ExecutableResponse = Record<string, { logKeys?: unknown } | null | undefined>;

/**
 * Collect de-duplicated log keys from an execution-graph node's
 * `executableResponses` (task, taskChain, async, sync, child, … variants).
 */
export function logKeysFromNode(node: {
  executableResponses?: ExecutableResponse[] | null;
}): string[] | undefined {
  const keys = new Set<string>();
  for (const response of node.executableResponses ?? []) {
    for (const variant of Object.values(response ?? {})) {
      const variantKeys = variant?.logKeys;
      if (!Array.isArray(variantKeys)) continue;
      for (const key of variantKeys) {
        if (typeof key === "string" && key.trim()) keys.add(key.trim());
      }
    }
  }
  return keys.size ? [...keys] : undefined;
}
