/**
 * Maps docs/coding-standards.md rules to the Vitest files that enforce them.
 * Fails if a guardrail test file is added or removed without updating this map.
 */
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const CODING_STANDARDS_DIR = join(import.meta.dirname);

/**
 * Keys must match every `*.test.ts` file in this directory (except this file lists itself).
 * Values are human-readable doc anchors for contributors — not executed at runtime.
 */
export const STANDARDS_ENFORCEMENT_MAP: Record<string, readonly string[]> = {
  "architecture.test.ts": [
    "§1 consolidated MCP tools (11 handlers, no new registerTool sites)",
    "§2 toolset purity (forbidden imports, ToolsetDefinition export)",
    "§3 inline responseExtractor budget",
    "§7 logging (no console.log in src/, no console in toolsets)",
    "§10 singleton HarnessClient and client.request exceptions",
    "§11 global fetch allowlist",
    "Zod v4 import path and registerTool (not server.tool)",
    "write handlers: confirm + elicitation, toMcpError/errorResult",
  ],
  "consolidated-tools.test.ts": ["§1 consolidated-tools.ts invariants"],
  "docs-consistency.test.ts": [
    "docs/coding-standards.md, AGENTS.md, CONTRIBUTING.md alignment",
  ],
  "error-handling.test.ts": ["§6 error handling (toMcpError, errorResult)"],
  "file-organization.test.ts": ["§11 file organization (src/tools layout)"],
  "input-conventions.test.ts": ["§8 snake_case params and pagination defaults"],
  "registry-contract.test.ts": [
    "§4 scope, §5 identifierFields, operationPolicy on endpoints",
  ],
  "registry-metadata.test.ts": [
    "§8 .describe() on inputSchema params",
    "§9 write confirmation via confirmViaElicitation",
    "listFilterFields only with list operation",
  ],
  "scope-params.test.ts": ["§4 optional org_id/project_id on API handlers"],
  "toolset-scope.test.ts": ["§4 no manual camelCase scope keys in queryParams"],
  "enforcement-map.test.ts": ["guardrail suite inventory (this file)"],
};

describe("Coding standards — enforcement map", () => {
  it("every coding-standards test file is documented in STANDARDS_ENFORCEMENT_MAP", () => {
    const onDisk = readdirSync(CODING_STANDARDS_DIR)
      .filter((f) => f.endsWith(".test.ts"))
      .sort();

    expect(Object.keys(STANDARDS_ENFORCEMENT_MAP).sort()).toEqual(onDisk);
  });

  it("every mapped file exists and has at least one documented rule", () => {
    for (const [file, rules] of Object.entries(STANDARDS_ENFORCEMENT_MAP)) {
      expect(rules.length, `${file} must document at least one rule`).toBeGreaterThan(0);
      expect(
        readdirSync(CODING_STANDARDS_DIR).includes(file),
        `missing test file ${file}`,
      ).toBe(true);
    }
  });
});
