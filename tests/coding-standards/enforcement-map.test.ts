/**
 * Maps docs/coding-standards.md rules to automated guardrails in this directory.
 * Fails if a standards test file is added without documenting which rule it enforces.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");

/** docs/coding-standards.md section → test files that enforce it (plus structural-validation). */
const RULE_ENFORCEMENT: Record<string, readonly string[]> = {
  "§1 consolidated MCP tools (no new handlers)": [
    "architecture.test.ts",
    "consolidated-tools.test.ts",
    "file-organization.test.ts",
  ],
  "§2 pure-data toolsets": ["architecture.test.ts"],
  "§3 shared response extractors": ["architecture.test.ts", "../registry/structural-validation.test.ts"],
  "§4 Harness scoping model": [
    "scope-params.test.ts",
    "toolset-scope.test.ts",
    "../registry/structural-validation.test.ts",
  ],
  "§5 identifier fields and deep links": ["registry-metadata.test.ts", "../registry/structural-validation.test.ts"],
  "§6 error handling": ["error-handling.test.ts", "architecture.test.ts"],
  "§7 logging (stderr only)": ["architecture.test.ts"],
  "§8 tool input schema conventions": ["input-conventions.test.ts", "architecture.test.ts"],
  "§9 safety (confirm / elicitation)": ["architecture.test.ts"],
  "§10 singleton HarnessClient": ["architecture.test.ts"],
  "§11 file organization": ["file-organization.test.ts"],
  "Registry contract / operationPolicy": ["registry-contract.test.ts", "../registry/structural-validation.test.ts"],
  "Contributor doc alignment": ["docs-consistency.test.ts"],
};

const EXEMPT_TEST_FILES = new Set(["enforcement-map.test.ts", "consolidated-tools.ts"]);

describe("Coding standards — enforcement map", () => {
  it("every coding-standards test file (except helpers) is listed in RULE_ENFORCEMENT", () => {
    const onDisk = readdirSync(CODING_STANDARDS_DIR)
      .filter((f) => f.endsWith(".test.ts"))
      .filter((f) => !EXEMPT_TEST_FILES.has(f));

    const mapped = new Set<string>();
    for (const files of Object.values(RULE_ENFORCEMENT)) {
      for (const file of files) {
        if (file.startsWith("../")) continue;
        mapped.add(file);
      }
    }

    const unmapped = onDisk.filter((f) => !mapped.has(f));
    expect(
      unmapped,
      `Add ${unmapped.join(", ")} to RULE_ENFORCEMENT in enforcement-map.test.ts`,
    ).toEqual([]);
  });

  it("every mapped test file exists on disk", () => {
    const missing: string[] = [];
    for (const files of Object.values(RULE_ENFORCEMENT)) {
      for (const file of files) {
        const path = join(CODING_STANDARDS_DIR, file);
        if (!existsSync(path)) {
          missing.push(file);
        }
      }
    }
    expect(missing, `Missing enforcement files: ${missing.join(", ")}`).toEqual([]);
  });

  it("package.json standards:check runs coding-standards and structural-validation", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: { "standards:check": string };
    };
    expect(pkg.scripts["standards:check"]).toContain("tests/coding-standards");
    expect(pkg.scripts["standards:check"]).toContain("structural-validation.test.ts");
  });

  it("docs/coding-standards.md is the canonical architecture reference", () => {
    const content = readFileSync(STANDARDS_DOC, "utf8");
    expect(content).toContain("registry-driven MCP server");
    expect(content).toContain("registerTool()");
    expect(content).not.toMatch(/\bserver\.tool\s*\(/);
  });
});
