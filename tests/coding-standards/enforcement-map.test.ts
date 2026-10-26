/**
 * Maps docs/coding-standards.md Commit Checklist items to automated guardrails.
 *
 * When adding a new architecture rule, extend this map and the enforcing test file
 * so `pnpm standards:check` stays the single verification entrypoint.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";

const REPO_ROOT = join(import.meta.dirname, "../..");

type EnforcementEntry = {
  /** Short label matching the commit checklist in docs/coding-standards.md */
  checklist: string;
  /** false = verified manually (build/typecheck/test) or by review */
  automated: boolean;
  /** Vitest files that enforce this rule (relative to repo root) */
  tests: string[];
};

const STANDARDS_ENFORCEMENT: EnforcementEntry[] = [
  {
    checklist: "No new server.registerTool() outside the 11 harness handlers",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools.test.ts",
      "tests/coding-standards/docs-consistency.test.ts",
    ],
  },
  {
    checklist: "No console.log() in src/ (stderr-only logging)",
    automated: true,
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "No undocumented global fetch(); Harness API via HarnessClient",
    automated: true,
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "No new harness-*.ts handler files under src/tools/",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    checklist: "Toolset files are pure data (no client/MCP/registry/logger imports)",
    automated: true,
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "Zod v4 import path and describe-after-optional/default chaining",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/docs-consistency.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    checklist: "Shared response extractors (no new inline toolset extractors)",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "Resource scope and scope injection conventions",
    automated: true,
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "identifierFields declared on every resource",
    automated: true,
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "operationPolicy on every endpoint",
    automated: true,
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "Write/execute operations require confirmation + elicitation",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    checklist: "Tool input snake_case and harness_list pagination defaults",
    automated: true,
    tests: ["tests/coding-standards/input-conventions.test.ts"],
  },
  {
    checklist: "Error handling uses toMcpError / errorResult",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/error-handling.test.ts",
    ],
  },
  {
    checklist: "Registry toolset registration matches ToolsetName union",
    automated: true,
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "File organization (toolsets vs src/tools/)",
    automated: true,
    tests: ["tests/coding-standards/file-organization.test.ts"],
  },
  {
    checklist: "Documentation stays on 11-tool / Zod v4 / registerTool model",
    automated: true,
    tests: ["tests/coding-standards/docs-consistency.test.ts"],
  },
  {
    checklist: "pnpm build passes",
    automated: false,
    tests: [],
  },
  {
    checklist: "pnpm typecheck passes",
    automated: false,
    tests: [],
  },
  {
    checklist: "pnpm test passes",
    automated: false,
    tests: [],
  },
  {
    checklist: "No secrets exposed in tool responses",
    automated: false,
    tests: [],
  },
];

describe("Coding standards — enforcement map", () => {
  it("every automated checklist item references at least one guardrail test file", () => {
    const missing = STANDARDS_ENFORCEMENT.filter((e) => e.automated && e.tests.length === 0);
    expect(missing.map((e) => e.checklist)).toEqual([]);
  });

  it("every referenced guardrail test file exists on disk", () => {
    const allTests = [...new Set(STANDARDS_ENFORCEMENT.flatMap((e) => e.tests))];
    const missing = allTests.filter((path) => !existsSync(join(REPO_ROOT, path)));
    expect(missing, `Missing enforcement test files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("pnpm standards:check includes all coding-standards tests and structural validation", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const script = pkg.scripts["standards:check"] ?? "";
    expect(script).toContain("tests/coding-standards");
    expect(script).toContain("tests/registry/structural-validation.test.ts");
  });

  it("CI runs pnpm standards:check", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("pnpm standards:check");
  });
});
