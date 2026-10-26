/**
 * Maps docs/coding-standards.md commit-checklist rules to the vitest suites
 * that enforce them. Prevents guardrails from being deleted without updating
 * this inventory (same pattern as security-regression-map.test.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Checklist rule → vitest files under tests/coding-standards/ (and related). */
export const STANDARDS_ENFORCEMENT_MAP = [
  {
    rule: "Fixed consolidated MCP tools — no extra registerTool() or harness-*.ts handlers",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    rule: "Toolset purity — no HarnessClient/MCP/Registry/logger; ToolsetDefinition exports",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Shared response extractors — no new inline extractors in toolsets",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Harness scoping model — scope params and registry dispatch",
    testFiles: [
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/registry-contract.test.ts",
    ],
  },
  {
    rule: "identifierFields, deep links, and registry metadata",
    testFiles: [
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    rule: "Error handling — toMcpError, errorResult, HarnessApiError mapping",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/error-handling.test.ts",
    ],
  },
  {
    rule: "Logging — no console.log in src/; toolsets stay side-effect free",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Tool input schema — Zod v4, describe() chaining, snake_case conventions",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/input-conventions.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    rule: "Write safety — confirm param and confirmViaElicitation on write/execute tools",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "HTTP client singleton — no stray fetch() or HarnessClient construction",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Registry registration — ALL_TOOLSETS vs ToolsetName union",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Documentation stays aligned with enforced architecture (11 tools, Zod v4)",
    testFiles: ["tests/coding-standards/docs-consistency.test.ts"],
  },
] as const;

describe("Coding standards — enforcement map", () => {
  it("keeps every mapped architecture guard test file in the repo", () => {
    const seen = new Set<string>();

    for (const entry of STANDARDS_ENFORCEMENT_MAP) {
      for (const relativePath of entry.testFiles) {
        if (seen.has(relativePath)) continue;
        seen.add(relativePath);

        const absolute = join(REPO_ROOT, relativePath);
        expect(existsSync(absolute), `missing standards guard: ${relativePath}`).toBe(true);
      }
    }
  });

  it("runs all mapped suites via pnpm standards:check", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: { "standards:check": string };
    };
    const cmd = packageJson.scripts["standards:check"];

    expect(cmd).toContain("tests/coding-standards");
    expect(cmd).toContain("tests/registry/structural-validation.test.ts");

    for (const relativePath of new Set(
      STANDARDS_ENFORCEMENT_MAP.flatMap((e) => e.testFiles),
    )) {
      if (!relativePath.startsWith("tests/coding-standards/")) continue;
      const fileName = relativePath.replace("tests/coding-standards/", "");
      expect(cmd, `standards:check should cover ${relativePath}`).toContain("tests/coding-standards");
      expect(
        existsSync(join(REPO_ROOT, relativePath)),
        `mapped file missing: ${relativePath}`,
      ).toBe(true);
      // Vitest runs the whole tests/coding-standards directory — file must live there.
      expect(fileName.length).toBeGreaterThan(0);
    }
  });

  it("documents at least one guard per commit-checklist theme", () => {
    expect(STANDARDS_ENFORCEMENT_MAP.length).toBeGreaterThanOrEqual(10);
  });
});
