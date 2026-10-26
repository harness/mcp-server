/**
 * Maps docs/coding-standards.md commit checklist and architecture rules to the
 * automated guardrails that enforce them. Fails CI if a rule loses test coverage.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

type EnforcementEntry = {
  /** Short label matching docs/coding-standards.md commit checklist / rules */
  rule: string;
  /** Vitest files that enforce this rule (relative to repo root) */
  tests: string[];
  /** Optional substring that must appear in at least one test file */
  signal?: string;
};

/**
 * Keep in sync with the Commit Checklist in docs/coding-standards.md.
 * When you add a new guardrail, add a row here so the map stays complete.
 */
const ENFORCEMENT_MAP: EnforcementEntry[] = [
  {
    rule: "Fixed consolidated MCP tools (no extra registerTool handlers)",
    tests: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/consolidated-tools.ts"],
    signal: "ALLOWED_REGISTER_TOOL_FILES",
  },
  {
    rule: "No console.log in src (stdio JSON-RPC safety)",
    tests: ["tests/coding-standards/architecture.test.ts"],
    signal: "console.log",
  },
  {
    rule: "No undocumented global fetch(); HarnessClient singleton",
    tests: ["tests/coding-standards/architecture.test.ts"],
    signal: "ALLOWED_GLOBAL_FETCH_FILES",
  },
  {
    rule: "No new harness-*.ts handler files under src/tools/",
    tests: ["tests/coding-standards/architecture.test.ts"],
    signal: "ALLOWED_HARNESS_HANDLER_FILES",
  },
  {
    rule: "Toolset purity (no HarnessClient / Registry / createLogger)",
    tests: ["tests/coding-standards/architecture.test.ts"],
    signal: "FORBIDDEN_TOOLSET_IMPORTS",
  },
  {
    rule: "Zod v4 import path and describe-after-optional chaining",
    tests: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/input-conventions.test.ts"],
    signal: "zod/v4",
  },
  {
    rule: "Shared response extractors (no new inline extractors in toolsets)",
    tests: ["tests/coding-standards/architecture.test.ts"],
    signal: "ALLOWED_INLINE_EXTRACTOR_COUNTS",
  },
  {
    rule: "Registry scope, identifierFields, operationPolicy",
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
    ],
    signal: "operationPolicy",
  },
  {
    rule: "Write tools use confirm + elicitation; dispatch tools use toMcpError",
    tests: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/error-handling.test.ts"],
    signal: "confirmViaElicitation",
  },
  {
    rule: "Tool input snake_case and harness_list pagination defaults",
    tests: ["tests/coding-standards/input-conventions.test.ts"],
    signal: "snake_case",
  },
  {
    rule: "File organization (toolsets vs tools vs client)",
    tests: ["tests/coding-standards/file-organization.test.ts"],
    signal: "src/registry/toolsets",
  },
  {
    rule: "Documentation drift (11 tools, Zod v4, standards:check)",
    tests: ["tests/coding-standards/docs-consistency.test.ts"],
    signal: "CONSOLIDATED_MCP_TOOLS",
  },
  {
    rule: "Registry structural validation (resource definitions)",
    tests: ["tests/registry/structural-validation.test.ts"],
    signal: "structural",
  },
  {
    rule: "Production Dockerfile Debian security refresh and OpenSSL floor (Trivy)",
    tests: ["tests/docker/production-dockerfile.test.ts"],
    signal: "DEBIAN_SECURITY_REFRESH",
  },
  {
    rule: "CVE dependency pins (body-parser, zod, fast-uri, ip-address)",
    tests: ["tests/scripts/cve-dependency-pins.test.ts"],
    signal: "SECURE_BODY_PARSER_VERSION",
  },
  {
    rule: "HTTP framework security pins (hono, @hono/node-server, vite)",
    tests: ["tests/scripts/http-framework-security-pins.test.ts"],
    signal: "SECURE_HONO_VERSION",
  },
  {
    rule: "adm-zip CVE patch (postinstall, nested onnxruntime-node)",
    tests: [
      "tests/scripts/adm-zip-security-lib.test.ts",
      "tests/scripts/adm-zip-postinstall.test.ts",
      "tests/scripts/cve-dependency-pins.test.ts",
      "tests/scripts/npm-shrinkwrap-guardrails.test.ts",
    ],
    signal: "SECURE_ADM_ZIP_VERSION",
  },
  {
    rule: "npm-shrinkwrap.json metadata and adm-zip pins (npm-shrinkwrap:check)",
    tests: ["tests/scripts/npm-shrinkwrap-guardrails.test.ts"],
    signal: "generate-npm-shrinkwrap.mjs",
  },
  {
    rule: "Service account aggregate list extractors and multi-scope dispatch",
    tests: [
      "tests/registry/extractors-service-account.test.ts",
      "tests/registry/access-control-service-account.test.ts",
    ],
    signal: "serviceAccountListExtract",
  },
  {
    rule: "Security regression artifact map (Dockerfile, shrinkwrap, CVE libs)",
    tests: [
      "tests/scripts/security-regression-map.test.ts",
      "tests/scripts/npm-publish-security-artifacts.test.ts",
    ],
    signal: "SECURITY_REGRESSION_MAP",
  },
];

describe("Coding standards — enforcement map", () => {
  it("every mapped guardrail test file exists on disk", () => {
    const missing: string[] = [];
    const seen = new Set<string>();

    for (const entry of ENFORCEMENT_MAP) {
      for (const testPath of entry.tests) {
        if (seen.has(testPath)) continue;
        seen.add(testPath);
        if (!existsSync(join(REPO_ROOT, testPath))) {
          missing.push(testPath);
        }
      }
    }

    expect(missing, `Missing enforcement test files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every mapped rule has a detectable signal in its guardrail tests", () => {
    const violations: string[] = [];

    for (const { rule, tests, signal } of ENFORCEMENT_MAP) {
      if (!signal) continue;

      const found = tests.some((testPath) => {
        const content = readFileSync(join(REPO_ROOT, testPath), "utf8");
        return content.includes(signal);
      });

      if (!found) {
        violations.push(`${rule}: signal "${signal}" not found in ${tests.join(", ")}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("docs/coding-standards.md documents pnpm standards:check and commit checklist", () => {
    const standards = readFileSync(STANDARDS_PATH, "utf8");
    expect(standards).toContain("pnpm standards:check");
    expect(standards).toContain("## Commit Checklist");
    expect(standards).toMatch(/11 consolidated tool handlers/);
  });

  it("standards:check script includes all coding-standards tests and structural validation", () => {
    const pkg = readFileSync(join(REPO_ROOT, "package.json"), "utf8");
    expect(pkg).toContain('"standards:check"');
    expect(pkg).toContain("tests/coding-standards");
    expect(pkg).toContain("tests/registry/structural-validation.test.ts");
  });
});
