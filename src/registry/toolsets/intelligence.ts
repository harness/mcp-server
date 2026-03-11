import type { ToolsetDefinition } from "../types.js";

/**
 * Intelligence toolset — exists for HARNESS_TOOLSETS filtering.
 * The `harness_ask` tool is standalone (not registry-dispatched), but
 * this toolset must be present so `parseToolsetFilter()` accepts "intelligence".
 */
export const intelligenceToolset: ToolsetDefinition = {
  name: "intelligence",
  displayName: "AI Intelligence",
  description: "Harness AI DevOps Agent — generate and update entities via natural language",
  resources: [],
};
