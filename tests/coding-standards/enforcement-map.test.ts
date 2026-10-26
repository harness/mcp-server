/**
 * Maps docs/coding-standards.md commit checklist items to on-disk guardrail tests.
 * Prevents accidental removal of architecture enforcement without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Rule label → test files that enforce it (paths repo-relative). */
const ENFORCEMENT_MAP: Record<string, readonly string[]> = {
  "§1 Fixed consolidated MCP tools (no new handlers)": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/consolidated-tools.test.ts",
    "tests/coding-standards/consolidated-tools.ts",
    "tests/coding-standards/file-organization.test.ts",
  ],
  "§2 Pure-data toolsets": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/toolset-scope.test.ts",
  ],
  "§3 Shared response extractors": [
    "tests/coding-standards/architecture.test.ts",
    "tests/registry/structural-validation.test.ts",
  ],
  "§4 Harness scoping model": [
    "tests/coding-standards/scope-params.test.ts",
    "tests/coding-standards/toolset-scope.test.ts",
    "tests/coding-standards/registry-contract.test.ts",
    "tests/registry/structural-validation.test.ts",
  ],
  "§5 identifierFields and deep links": [
    "tests/coding-standards/registry-metadata.test.ts",
    "tests/registry/structural-validation.test.ts",
  ],
  "§5b operationPolicy on every endpoint": ["tests/coding-standards/registry-contract.test.ts"],
  "§6 Error handling (toMcpError / errorResult)": [
    "tests/coding-standards/error-handling.test.ts",
    "tests/coding-standards/architecture.test.ts",
  ],
  "§7 Logging (no stdout console.log)": ["tests/coding-standards/architecture.test.ts"],
  "§8 Tool input schema conventions": [
    "tests/coding-standards/input-conventions.test.ts",
    "tests/coding-standards/registry-metadata.test.ts",
    "tests/coding-standards/architecture.test.ts",
  ],
  "§9 Write safety (confirm + elicitation)": ["tests/coding-standards/architecture.test.ts"],
  "§9b Secret redaction (metadata-only contract)": [
    "tests/utils/redact.test.ts",
    "tests/client/harness-client.test.ts",
  ],
  "§10 Singleton HarnessClient and fetch allowlist": ["tests/coding-standards/architecture.test.ts"],
  "§11 File organization": ["tests/coding-standards/file-organization.test.ts"],
  "Docs stay aligned with enforced constants": ["tests/coding-standards/docs-consistency.test.ts"],
  "Commit checklist → guardrails or CI": ["tests/coding-standards/commit-checklist-coverage.test.ts"],
};

function assertGuardFilesExist(rule: string, files: readonly string[]): void {
  const missing = files.filter((f) => !existsSync(join(REPO_ROOT, f)));
  expect(
    missing,
    `${rule}: missing guard file(s):\n${missing.join("\n")}`,
  ).toEqual([]);
}

describe("Coding standards — enforcement map", () => {
  it("documents every mapped rule with at least one guard test file", () => {
    for (const files of Object.values(ENFORCEMENT_MAP)) {
      expect(files.length).toBeGreaterThan(0);
    }
    expect(Object.keys(ENFORCEMENT_MAP).length).toBeGreaterThanOrEqual(10);
  });

  for (const [rule, files] of Object.entries(ENFORCEMENT_MAP)) {
    it(rule, () => {
      assertGuardFilesExist(rule, files);
    });
  }

  it("canonical standards doc and CI entrypoint exist", () => {
    expect(existsSync(join(REPO_ROOT, "docs/coding-standards.md"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, ".github/workflows/ci.yml"))).toBe(true);
  });
});
