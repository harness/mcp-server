/**
 * Maps docs/coding-standards.md rules to the Vitest files that enforce them.
 * Fails if a guardrail file is removed or renamed without updating this map.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

type EnforcementEntry = {
  rule: string;
  file: string;
  mustMatch: RegExp;
};

const ENFORCEMENT_MAP: EnforcementEntry[] = [
  {
    rule: "§1 — fixed consolidated MCP tools (no new handlers)",
    file: "architecture.test.ts",
    mustMatch: /registerAllTools wires exactly the 11 allowed handlers/,
  },
  {
    rule: "§2 — toolset purity (no HarnessClient / Registry in toolsets)",
    file: "architecture.test.ts",
    mustMatch: /toolset files do not import HarnessClient/,
  },
  {
    rule: "§3 — shared response extractors",
    file: "architecture.test.ts",
    mustMatch: /does not add new inline responseExtractor/,
  },
  {
    rule: "§4 — Harness scoping model",
    file: "scope-params.test.ts",
    mustMatch: /optional org_id and project_id/,
  },
  {
    rule: "§5 — registry metadata (identifierFields, filters)",
    file: "registry-metadata.test.ts",
    mustMatch: /listFilterFields only on resources with a list operation/,
  },
  {
    rule: "§6 — error handling (toMcpError / errorResult)",
    file: "error-handling.test.ts",
    mustMatch: /API-calling handlers import and use toMcpError/,
  },
  {
    rule: "§7 — logging (no console.log in src/)",
    file: "architecture.test.ts",
    mustMatch: /never uses console\.log\(\) in src\//,
  },
  {
    rule: "§8 — tool input conventions (pagination, snake_case)",
    file: "input-conventions.test.ts",
    mustMatch: /pagination defaults page=0 and size=20/,
  },
  {
    rule: "§9 — write safety (confirm / elicitation)",
    file: "registry-metadata.test.ts",
    mustMatch: /confirmViaElicitation before dispatch/,
  },
  {
    rule: "§10 — singleton HarnessClient",
    file: "architecture.test.ts",
    mustMatch: /instantiates HarnessClient only in src\/index\.ts/,
  },
  {
    rule: "§11 — file organization (src/tools/ is fixed)",
    file: "file-organization.test.ts",
    mustMatch: /src\/tools\/ contains only the 11 harness handlers/,
  },
  {
    rule: "Registry contract (scope, operationPolicy)",
    file: "registry-contract.test.ts",
    mustMatch: /every endpoint spec declares operationPolicy/,
  },
  {
    rule: "Documentation drift (11 tools, Zod v4, standards:check)",
    file: "docs-consistency.test.ts",
    mustMatch: /documents 11 consolidated MCP tools/,
  },
  {
    rule: "Toolset scope injection (no manual camelCase scope in queryParams)",
    file: "toolset-scope.test.ts",
    mustMatch: /toolset queryParams use snake_case input keys for scope/,
  },
];

describe("Coding standards — enforcement map", () => {
  it("every documented rule has a living test file with the expected guardrail", () => {
    const violations: string[] = [];

    for (const { rule, file, mustMatch } of ENFORCEMENT_MAP) {
      const path = join(STANDARDS_DIR, file);
      if (!existsSync(path)) {
        violations.push(`${rule}: missing file ${file}`);
        continue;
      }
      const content = readFileSync(path, "utf8");
      if (!mustMatch.test(content)) {
        violations.push(`${rule}: ${file} no longer contains guardrail ${mustMatch}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("docs/coding-standards.md references the automated guardrail command", () => {
    const content = readFileSync(join(REPO_ROOT, "docs/coding-standards.md"), "utf8");
    expect(content).toContain("pnpm standards:check");
  });
});
