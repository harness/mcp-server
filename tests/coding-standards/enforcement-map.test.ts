/**
 * Explicit map from docs/coding-standards.md rules to enforcing tests.
 * When you add a guardrail under tests/coding-standards/, register it here so
 * the commit checklist cannot drift from CI without a failing test.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

/** Non-test shared constants — excluded from "every test file is mapped". */
const NON_TEST_MODULES = new Set(["consolidated-tools.ts"]);

/**
 * docSection references headings/rules in docs/coding-standards.md.
 * tests are basenames under tests/coding-standards/.
 */
export const STANDARDS_ENFORCEMENT_MAP: Array<{
  topic: string;
  docSection: string;
  tests: string[];
}> = [
  {
    topic: "Fixed consolidated MCP tools (no new handlers)",
    docSection: "Rules §1, Commit checklist",
    tests: ["architecture.test.ts", "consolidated-tools-sync.test.ts", "file-organization.test.ts"],
  },
  {
    topic: "Pure-data toolsets (no client/MCP/registry/logger)",
    docSection: "Rules §2",
    tests: ["architecture.test.ts"],
  },
  {
    topic: "Shared response extractors",
    docSection: "Rules §3",
    tests: ["architecture.test.ts"],
  },
  {
    topic: "Harness scoping model",
    docSection: "Rules §4",
    tests: ["toolset-scope.test.ts", "scope-params.test.ts", "registry-contract.test.ts"],
  },
  {
    topic: "identifierFields and registry metadata",
    docSection: "Rules §5",
    tests: ["registry-metadata.test.ts", "registry-contract.test.ts"],
  },
  {
    topic: "Error handling (errorResult / toMcpError)",
    docSection: "Rules §6",
    tests: ["error-handling.test.ts", "architecture.test.ts"],
  },
  {
    topic: "Stderr-only logging (no console.log in src/)",
    docSection: "Rules §7",
    tests: ["architecture.test.ts"],
  },
  {
    topic: "Tool input schema conventions (Zod v4, snake_case, pagination)",
    docSection: "Rules §8",
    tests: ["input-conventions.test.ts", "registry-metadata.test.ts", "architecture.test.ts"],
  },
  {
    topic: "Write safety (elicitation / confirm)",
    docSection: "Rules §9, Commit checklist",
    tests: ["registry-metadata.test.ts", "architecture.test.ts"],
  },
  {
    topic: "Singleton HarnessClient and no raw fetch in handlers/toolsets",
    docSection: "Rules §10",
    tests: ["architecture.test.ts"],
  },
  {
    topic: "File organization (toolsets vs src/tools/)",
    docSection: "Rules §11",
    tests: ["file-organization.test.ts"],
  },
  {
    topic: "Documentation matches enforced constants (11 tools, Zod v4)",
    docSection: "Architecture overview, Tech stack",
    tests: ["docs-consistency.test.ts"],
  },
  {
    topic: "operationPolicy on every endpoint",
    docSection: "Commit checklist",
    tests: ["registry-contract.test.ts"],
  },
  {
    topic: "Dependency and container CVE guardrails",
    docSection: "Automated Enforcement",
    tests: ["security-regression-map.test.ts"],
  },
];

function listCodingStandardsTestFiles(): string[] {
  return readdirSync(CODING_STANDARDS_DIR)
    .filter((f) => f.endsWith(".test.ts"))
    .sort();
}

describe("Coding standards — enforcement map", () => {
  it("every mapped test file exists under tests/coding-standards/", () => {
    const missing: string[] = [];
    const seen = new Set<string>();

    for (const entry of STANDARDS_ENFORCEMENT_MAP) {
      for (const test of entry.tests) {
        seen.add(test);
        const path = join(CODING_STANDARDS_DIR, test);
        if (!existsSync(path)) {
          missing.push(test);
        }
      }
    }

    expect(missing, `Missing enforcement test files: ${missing.join(", ")}`).toEqual([]);
    expect(seen.size).toBeGreaterThan(0);
  });

  it("every tests/coding-standards/*.test.ts is registered in STANDARDS_ENFORCEMENT_MAP", () => {
    const mapped = new Set<string>();
    for (const entry of STANDARDS_ENFORCEMENT_MAP) {
      for (const test of entry.tests) {
        mapped.add(test);
      }
    }

    const onDisk = listCodingStandardsTestFiles();
    const unmapped = onDisk.filter((f) => f !== "enforcement-map.test.ts" && !mapped.has(f));

    expect(
      unmapped,
      `Add new guardrail tests to STANDARDS_ENFORCEMENT_MAP: ${unmapped.join(", ")}`,
    ).toEqual([]);
  });

  it("package.json standards:check runs the full tests/coding-standards/ suite", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: { "standards:check": string };
    };
    const script = packageJson.scripts["standards:check"];
    expect(script).toContain("tests/coding-standards");
  });

  it("non-test modules in tests/coding-standards/ stay documented", () => {
    const tsFiles = readdirSync(CODING_STANDARDS_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    const unexpected = tsFiles.filter((f) => !NON_TEST_MODULES.has(f));
    expect(unexpected, `Unexpected non-test modules: ${unexpected.join(", ")}`).toEqual([]);
  });
});
