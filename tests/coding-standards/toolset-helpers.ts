/**
 * Toolset modules that are not full ToolsetDefinition exports (shared helpers).
 * Keep in sync with docs/coding-standards.md §2 exceptions.
 */
export const TOOLSET_HELPER_FILES = new Set([
  "src/registry/toolsets/ccm-cost-category.ts",
  "src/registry/toolsets/chaos-descriptions.ts",
  "src/registry/toolsets/related-activities.ts",
  "src/registry/toolsets/scopes.ts",
]);
