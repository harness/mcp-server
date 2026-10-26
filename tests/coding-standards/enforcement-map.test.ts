/**
 * Maps docs/coding-standards.md Commit Checklist items to automated guardrail tests.
 * When adding a new checklist rule, extend CHECKLIST_ENFORCEMENT and add a real test.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");
const REGISTRY_TESTS_DIR = join(REPO_ROOT, "tests/registry");

type EnforcementEntry = {
  /** Stable id for failures and docs cross-reference */
  id: string;
  /** Short label matching the commit checklist */
  summary: string;
  /** Vitest files under tests/coding-standards/ or tests/registry/ */
  testFiles: string[];
  /** Checklist items verified only in CI or by human review */
  manual?: boolean;
};

const CHECKLIST_ENFORCEMENT: EnforcementEntry[] = [
  {
    id: "no-new-register-tool",
    summary: "No new server.registerTool() calls",
    testFiles: ["coding-standards/architecture.test.ts"],
  },
  {
    id: "no-console-log",
    summary: "No console.log() in src/",
    testFiles: ["coding-standards/architecture.test.ts"],
  },
  {
    id: "no-raw-fetch",
    summary: "No undocumented global fetch()",
    testFiles: ["coding-standards/architecture.test.ts"],
  },
  {
    id: "fixed-harness-handlers",
    summary: "No new harness-*.ts handler files",
    testFiles: [
      "coding-standards/architecture.test.ts",
      "coding-standards/file-organization.test.ts",
    ],
  },
  {
    id: "pure-data-toolsets",
    summary: "Toolset files are pure data",
    testFiles: ["coding-standards/architecture.test.ts"],
  },
  {
    id: "zod-describe-chaining",
    summary: "Zod .describe() after .optional()/.default()",
    testFiles: [
      "coding-standards/architecture.test.ts",
      "coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    id: "shared-extractors",
    summary: "Response extractors from extractors.ts",
    testFiles: ["coding-standards/architecture.test.ts"],
  },
  {
    id: "resource-scope",
    summary: "Scope declared on every resource",
    testFiles: [
      "coding-standards/registry-contract.test.ts",
      "coding-standards/toolset-scope.test.ts",
    ],
  },
  {
    id: "identifier-fields",
    summary: "identifierFields on every resource",
    testFiles: [
      "coding-standards/registry-contract.test.ts",
      "registry/structural-validation.test.ts",
    ],
  },
  {
    id: "operation-policy",
    summary: "operationPolicy on every endpoint",
    testFiles: [
      "coding-standards/registry-contract.test.ts",
      "registry/structural-validation.test.ts",
    ],
  },
  {
    id: "write-confirmation",
    summary: "Write/execute handlers require confirmation",
    testFiles: [
      "coding-standards/architecture.test.ts",
      "coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    id: "error-handling",
    summary: "toMcpError + errorResult on API handlers",
    testFiles: ["coding-standards/error-handling.test.ts"],
  },
  {
    id: "input-conventions",
    summary: "snake_case params and pagination defaults",
    testFiles: [
      "coding-standards/input-conventions.test.ts",
      "coding-standards/scope-params.test.ts",
    ],
  },
  {
    id: "doc-drift",
    summary: "docs/coding-standards.md aligned with 11-tool model",
    testFiles: ["coding-standards/docs-consistency.test.ts"],
  },
  {
    id: "no-secrets-exposed",
    summary: "No secret values in tool responses",
    manual: true,
    testFiles: [],
  },
  {
    id: "build-typecheck-test",
    summary: "pnpm build, typecheck, and test pass",
    manual: true,
    testFiles: [],
  },
];

function resolveTestPath(relativePath: string): string {
  if (relativePath.startsWith("coding-standards/")) {
    return join(CODING_STANDARDS_DIR, relativePath.slice("coding-standards/".length));
  }
  if (relativePath.startsWith("registry/")) {
    return join(REGISTRY_TESTS_DIR, relativePath.slice("registry/".length));
  }
  return join(REPO_ROOT, relativePath);
}

describe("Coding standards — commit checklist enforcement map", () => {
  it("every automated checklist item references at least one guardrail test file", () => {
    const missing: string[] = [];

    for (const entry of CHECKLIST_ENFORCEMENT) {
      if (entry.manual) continue;
      if (entry.testFiles.length === 0) {
        missing.push(`${entry.id}: no testFiles`);
        continue;
      }
      for (const file of entry.testFiles) {
        const path = resolveTestPath(file);
        if (!existsSync(path)) {
          missing.push(`${entry.id}: missing ${file}`);
        }
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("documents manual checklist items without automated guardrails", () => {
    const manualIds = CHECKLIST_ENFORCEMENT.filter((e) => e.manual).map((e) => e.id);
    expect(manualIds).toContain("no-secrets-exposed");
    expect(manualIds).toContain("build-typecheck-test");
  });

  it("pnpm standards:check runs coding-standards and structural-validation suites", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const script = pkg.scripts["standards:check"] ?? "";
    expect(script).toContain("tests/coding-standards");
    expect(script).toContain("tests/registry/structural-validation.test.ts");
  });

  it("CI workflow runs pnpm standards:check", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("pnpm standards:check");
  });
});
