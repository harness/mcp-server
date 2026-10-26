/**
 * Architecture layer layout from docs/coding-standards.md — registry-driven MCP model.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Documented layer entrypoints — update when the architecture table changes. */
const LAYER_ENTRYPOINTS = [
  "src/tools/index.ts",
  "src/registry/index.ts",
  "src/registry/extractors.ts",
  "src/client/harness-client.ts",
  "src/utils/logger.ts",
  "src/utils/errors.ts",
  "src/resources",
  "src/prompts",
] as const;

describe("Coding standards — architecture layers", () => {
  it("documented layer paths exist on disk", () => {
    const missing = LAYER_ENTRYPOINTS.filter((rel) => !existsSync(join(REPO_ROOT, rel)));
    expect(missing, `Missing architecture paths:\n${missing.join("\n")}`).toEqual([]);
  });

  it("toolset definitions live under src/registry/toolsets/", () => {
    const toolsetDir = join(REPO_ROOT, "src/registry/toolsets");
    const tsFiles = readdirSync(toolsetDir).filter((f) => f.endsWith(".ts"));
    expect(tsFiles.length).toBeGreaterThan(20);
  });
});
