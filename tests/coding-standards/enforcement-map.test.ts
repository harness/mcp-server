/**
 * Maps docs/coding-standards.md rules to automated tests so guardrails cannot
 * silently disappear when files are renamed or deleted.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOL_COUNT } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

type EnforcementEntry = {
  rule: string;
  docSection: string;
  testFiles: string[];
};

/** Every automated rule in docs/coding-standards.md should appear here. */
export const ENFORCEMENT_MAP: EnforcementEntry[] = [
  {
    rule: "Fixed consolidated MCP tools (no new registerTool handlers)",
    docSection: "§1",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Toolset definitions are pure data",
    docSection: "§2",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Shared response extractors (no new inline extractors)",
    docSection: "§3",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Harness scoping model on ResourceDefinition",
    docSection: "§4",
    testFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    rule: "identifierFields and registry metadata",
    docSection: "§5",
    testFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    rule: "Error handling (toMcpError / errorResult)",
    docSection: "§6",
    testFiles: [
      "tests/coding-standards/error-handling.test.ts",
      "tests/coding-standards/architecture.test.ts",
    ],
  },
  {
    rule: "Logging — no console.log in src/",
    docSection: "§7",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Tool input schema conventions (snake_case, pagination)",
    docSection: "§8",
    testFiles: [
      "tests/coding-standards/input-conventions.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/scope-params.test.ts",
    ],
  },
  {
    rule: "Write safety (confirm + elicitation)",
    docSection: "§9",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    rule: "Singleton HarnessClient and controlled fetch()",
    docSection: "§10",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "File organization under src/tools/",
    docSection: "§11",
    testFiles: ["tests/coding-standards/file-organization.test.ts"],
  },
  {
    rule: "Documentation matches enforced architecture",
    docSection: "intro",
    testFiles: ["tests/coding-standards/docs-consistency.test.ts"],
  },
];

/** October 2026 security hardening — not in coding-standards.md but must stay tested. */
export const SECURITY_REGRESSION_MAP: EnforcementEntry[] = [
  {
    rule: "pnpm/npm CVE override floors and lockfile resolution",
    docSection: "security-deps",
    testFiles: [
      "tests/scripts/cve-dependency-pins.test.ts",
      "tests/scripts/adm-zip-security-lib.test.ts",
      "tests/scripts/ip-address-security-lib.test.ts",
    ],
  },
  {
    rule: "adm-zip npm consumer postinstall and published manifest",
    docSection: "security-supply-chain",
    testFiles: ["tests/scripts/adm-zip-supply-chain.test.ts"],
  },
  {
    rule: "npm-shrinkwrap drift check",
    docSection: "security-shrinkwrap",
    testFiles: ["tests/scripts/npm-shrinkwrap-check.test.ts"],
  },
  {
    rule: "Production Dockerfile OpenSSL and adm-zip install ordering",
    docSection: "security-docker",
    testFiles: ["tests/docker/production-dockerfile.test.ts"],
  },
  {
    rule: "Service account aggregate list extractors",
    docSection: "security-api",
    testFiles: [
      "tests/registry/extractors-service-account.test.ts",
      "tests/registry/access-control-service-account.test.ts",
    ],
  },
];

/** Documented in coding-standards.md but not fully automatable. */
export const MANUAL_ONLY_STANDARDS = [
  "Never expose secret values in tool responses — only metadata",
  "Never auto-run pipelines without presenting execution plan to the user",
  "Rate limiting behavior under load (RateLimiter integration)",
] as const;

function fileHasTests(relativePath: string): boolean {
  const full = join(REPO_ROOT, relativePath);
  const content = readFileSync(full, "utf8");
  return /\bit\s*\(/.test(content) || /\bdescribe\s*\(/.test(content);
}

describe("Coding standards — enforcement map", () => {
  it(`maps every major docs/coding-standards.md rule to at least one test file`, () => {
    expect(ENFORCEMENT_MAP.length).toBeGreaterThanOrEqual(10);
  });

  it("every security regression test file exists and contains vitest cases", () => {
    const violations: string[] = [];

    for (const entry of SECURITY_REGRESSION_MAP) {
      for (const testFile of entry.testFiles) {
        const full = join(REPO_ROOT, testFile);
        if (!existsSync(full)) {
          violations.push(`${entry.docSection} ${entry.rule}: missing ${testFile}`);
          continue;
        }
        if (!fileHasTests(testFile)) {
          violations.push(`${entry.docSection} ${entry.rule}: ${testFile} has no it()/describe()`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every mapped test file exists and contains vitest cases", () => {
    const violations: string[] = [];

    for (const entry of ENFORCEMENT_MAP) {
      for (const testFile of entry.testFiles) {
        const full = join(REPO_ROOT, testFile);
        if (!existsSync(full)) {
          violations.push(`${entry.docSection} ${entry.rule}: missing ${testFile}`);
          continue;
        }
        if (!fileHasTests(testFile)) {
          violations.push(`${entry.docSection} ${entry.rule}: ${testFile} has no it()/describe()`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("consolidated tool count in SSOT matches docs (11 tools)", () => {
    const doc = readFileSync(join(REPO_ROOT, "docs/coding-standards.md"), "utf8");
    expect(CONSOLIDATED_MCP_TOOL_COUNT).toBe(11);
    expect(doc).toMatch(/11 consolidated tool handlers/);
  });

  it("documents manual-only standards for reviewers", () => {
    expect(MANUAL_ONLY_STANDARDS.length).toBeGreaterThan(0);
  });
});
