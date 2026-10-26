/**
 * Living index: docs/coding-standards.md commit checklist → enforcing tests.
 *
 * When you add a new automated guardrail, extend this map so contributors can
 * find enforcement quickly and CI failures map back to the standard they protect.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

type EnforcementEntry = {
  /** Short label from docs/coding-standards.md commit checklist or architecture rules. */
  standard: string;
  /** Relative paths under the repo root. */
  tests: string[];
};

/**
 * Not every checklist item is fully automatable (e.g. secret values in API responses).
 * Items marked manual-only are documented here for visibility, not enforced by CI.
 */
const ENFORCEMENT_MAP: EnforcementEntry[] = [
  {
    standard: "Fixed consolidated MCP tools (no new registerTool / harness handlers)",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools.test.ts",
      "tests/coding-standards/consolidated-tools.ts",
    ],
  },
  {
    standard: "stderr-only logging (no console.log in src/)",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    standard: "HTTP via HarnessClient singleton (no stray fetch / client instances)",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    standard: "Pure-data toolsets (no HarnessClient, Registry, logger in toolsets)",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    standard: "Shared response extractors (no new inline extractors)",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    standard: "Registry registration (ALL_TOOLSETS ↔ ToolsetName union)",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    standard: "Write tools: confirm param + elicitation",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    standard: "Error handling: toMcpError + errorResult",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/error-handling.test.ts",
    ],
  },
  {
    standard: "Zod v4 imports and describe-after-optional chaining",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    standard: "Tool input conventions (snake_case, pagination defaults)",
    tests: ["tests/coding-standards/input-conventions.test.ts"],
  },
  {
    standard: "Scope model (no manual account/org/project injection in toolsets)",
    tests: [
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
    ],
  },
  {
    standard: "identifierFields, deep links, operationPolicy metadata",
    tests: [
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    standard: "Registry dispatch contract (EndpointSpec shape)",
    tests: ["tests/coding-standards/registry-contract.test.ts"],
  },
  {
    standard: "File organization (toolsets vs src/tools/)",
    tests: ["tests/coding-standards/file-organization.test.ts"],
  },
  {
    standard: "Documentation drift (11 tools, Zod v4, standards:check in docs)",
    tests: ["tests/coding-standards/docs-consistency.test.ts"],
  },
  {
    standard: "Security regression guards (CVE pins, Docker hardening, shrinkwrap)",
    tests: [
      "tests/coding-standards/security-regression-map.test.ts",
      "tests/docker/dockerfile-adm-zip-postinstall.test.ts",
      "tests/docker/production-dockerfile.test.ts",
      "tests/scripts/cve-dependency-pins.test.ts",
      "tests/scripts/http-framework-security-pins.test.ts",
      "tests/scripts/ip-address-security-lib.test.ts",
      "tests/scripts/npm-shrinkwrap-security.test.ts",
    ],
  },
];

const MANUAL_ONLY_STANDARDS = [
  "No secret values in tool output (metadata only) — review at PR time",
  "Destructive operations require user confirmation — elicitation + confirm flag",
];

describe("Coding standards — enforcement map", () => {
  it("documents automated guardrails and every mapped test file exists", () => {
    expect(ENFORCEMENT_MAP.length).toBeGreaterThan(0);

    for (const entry of ENFORCEMENT_MAP) {
      expect(entry.tests.length, entry.standard).toBeGreaterThan(0);
      for (const testPath of entry.tests) {
        const full = join(REPO_ROOT, testPath);
        expect(existsSync(full), `missing enforcement test for "${entry.standard}": ${testPath}`).toBe(
          true,
        );
      }
    }
  });

  it("lists manual-only standards for contributor visibility", () => {
    expect(MANUAL_ONLY_STANDARDS.length).toBeGreaterThan(0);
  });
});
