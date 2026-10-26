/**
 * Maps docs/coding-standards.md "Commit Checklist" items to automated guard tests.
 * Fails if a guard file is removed without updating this map.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type ChecklistGuard = {
  /** Short label matching the commit checklist intent */
  label: string;
  /** Test files that enforce this rule (at least one must exist) */
  guardFiles: string[];
  /** When true, compliance is documented as manual-only (no automated guard yet) */
  manualOnly?: boolean;
};

const COMMIT_CHECKLIST_GUARDS: ChecklistGuard[] = [
  {
    label: "No new server.registerTool() outside fixed handlers",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    label: "No console.log() in src/",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    label: "No undocumented global fetch() / raw fetch in tools and toolsets",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    label: "No new harness-*.ts handler files under src/tools/",
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    label: "Toolset files are pure data (forbidden imports, ToolsetDefinition export)",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    label: "Zod v4 import path and describe-after-optional/default chaining",
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    label: "Shared response extractors (no new inline extractors in toolsets)",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    label: "Scope declared on resources and scope param conventions",
    guardFiles: [
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/scope-params.test.ts",
    ],
  },
  {
    label: "identifierFields and registry metadata contracts",
    guardFiles: [
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    label: "operationPolicy on every endpoint",
    guardFiles: ["tests/coding-standards/registry-contract.test.ts"],
  },
  {
    label: "Write tools use confirm + confirmViaElicitation and error mapping",
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/error-handling.test.ts",
    ],
  },
  {
    label: "ToolsetName union matches ALL_TOOLSETS registration",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    label: "HarnessClient singleton and pagination input conventions",
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/input-conventions.test.ts",
    ],
  },
  {
    label: "Docs stay aligned with 11-tool registry model and Zod v4",
    guardFiles: ["tests/coding-standards/docs-consistency.test.ts"],
  },
  {
    label: "No secrets exposed in tool responses (metadata-only)",
    guardFiles: [],
    manualOnly: true,
  },
];

describe("Commit checklist — automated guard coverage", () => {
  for (const guard of COMMIT_CHECKLIST_GUARDS) {
    it(`documents enforcement for: ${guard.label}`, () => {
      if (guard.manualOnly) {
        expect(guard.guardFiles).toHaveLength(0);
        return;
      }

      expect(guard.guardFiles.length).toBeGreaterThan(0);
      for (const file of guard.guardFiles) {
        const path = join(REPO_ROOT, file);
        expect(existsSync(path), `missing guard file ${file} for "${guard.label}"`).toBe(true);
      }
    });
  }

  it("standards:check includes structural-validation alongside coding-standards", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const script = pkg.scripts?.["standards:check"] ?? "";
    expect(script).toContain("tests/coding-standards");
    expect(script).toContain("tests/registry/structural-validation.test.ts");
  });
});
