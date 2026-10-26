/**
 * Maps docs/coding-standards.md Commit Checklist bullets to automated guardrails.
 * CI-only and manual items are documented so contributors know what still requires human review.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

type EnforcementRef = readonly string[] | "ci" | "manual";

/** Must stay aligned with the Commit Checklist section in docs/coding-standards.md. */
const COMMIT_CHECKLIST_ENFORCEMENT: Array<{ needle: string; enforcement: EnforcementRef }> = [
  {
    needle: "No new `server.registerTool()` calls",
    enforcement: ["architecture.test.ts", "consolidated-tools.test.ts", "file-organization.test.ts"],
  },
  {
    needle: "No `console.log()`",
    enforcement: ["architecture.test.ts"],
  },
  {
    needle: "No direct `fetch()` calls",
    enforcement: ["architecture.test.ts"],
  },
  {
    needle: "No new `harness-*.ts` handler files",
    enforcement: ["architecture.test.ts", "file-organization.test.ts"],
  },
  {
    needle: "Toolset files are pure data",
    enforcement: ["architecture.test.ts"],
  },
  {
    needle: "All Zod params have `.describe()`",
    enforcement: ["architecture.test.ts", "input-conventions.test.ts", "registry-metadata.test.ts"],
  },
  {
    needle: "Response extractors are from `extractors.ts`",
    enforcement: ["architecture.test.ts", "../registry/structural-validation.test.ts"],
  },
  {
    needle: "Scope is declared correctly",
    enforcement: [
      "scope-params.test.ts",
      "toolset-scope.test.ts",
      "../registry/structural-validation.test.ts",
    ],
  },
  {
    needle: "`identifierFields` are declared",
    enforcement: ["registry-metadata.test.ts", "../registry/structural-validation.test.ts"],
  },
  {
    needle: "`operationPolicy` on every endpoint",
    enforcement: ["registry-contract.test.ts", "../registry/structural-validation.test.ts"],
  },
  {
    needle: "Write operations require confirmation",
    enforcement: ["architecture.test.ts"],
  },
  {
    needle: "No secrets exposed",
    enforcement: "manual",
  },
  { needle: "`pnpm build` passes", enforcement: "ci" },
  { needle: "`pnpm typecheck` passes", enforcement: "ci" },
  { needle: "`pnpm test` passes", enforcement: "ci" },
  {
    needle: "`pnpm standards:check` passes",
    enforcement: ["enforcement-map.test.ts", "../registry/structural-validation.test.ts"],
  },
];

function resolveEnforcementPath(file: string): string {
  return file.startsWith("../")
    ? join(CODING_STANDARDS_DIR, file)
    : join(CODING_STANDARDS_DIR, file);
}

describe("Coding standards — commit checklist coverage", () => {
  it("docs/coding-standards.md Commit Checklist bullets are mapped to enforcement", () => {
    const content = readFileSync(STANDARDS_DOC, "utf8");
    const checklistSection = content.slice(content.indexOf("## Commit Checklist"));
    const bullets = [...checklistSection.matchAll(/^- \[ \] \*\*(.+?)\*\*/gm)].map((m) => m[1]!.trim());

    expect(bullets.length).toBeGreaterThan(0);

    const unmapped: string[] = [];
    for (const bullet of bullets) {
      const entry = COMMIT_CHECKLIST_ENFORCEMENT.find((e) => bullet.startsWith(e.needle) || e.needle.startsWith(bullet));
      if (!entry) {
        unmapped.push(bullet);
      }
    }

    expect(
      unmapped,
      `Add Commit Checklist mapping for: ${unmapped.join("; ")}`,
    ).toEqual([]);

    expect(COMMIT_CHECKLIST_ENFORCEMENT.length).toBe(bullets.length);
  });

  it("every automated checklist mapping points at existing test files", () => {
    const missing: string[] = [];

    for (const { needle, enforcement } of COMMIT_CHECKLIST_ENFORCEMENT) {
      if (enforcement === "ci" || enforcement === "manual") continue;

      for (const file of enforcement) {
        const path = resolveEnforcementPath(file);
        if (!existsSync(path)) {
          missing.push(`${needle} → ${file}`);
        }
      }
    }

    expect(missing, `Missing enforcement files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("CI workflow runs build, typecheck, test, and standards:check", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/pnpm build/);
    expect(ci).toMatch(/pnpm typecheck/);
    expect(ci).toMatch(/pnpm test/);
    expect(ci).toMatch(/pnpm standards:check/);
  });

  it("every coding-standards test file is referenced by checklist or RULE_ENFORCEMENT", () => {
    const referenced = new Set<string>();

    for (const { enforcement } of COMMIT_CHECKLIST_ENFORCEMENT) {
      if (Array.isArray(enforcement)) {
        for (const file of enforcement) {
          if (!file.startsWith("../")) referenced.add(file);
        }
      }
    }

    const enforcementMap = readFileSync(join(CODING_STANDARDS_DIR, "enforcement-map.test.ts"), "utf8");
    for (const match of enforcementMap.matchAll(/"([^"]+\.test\.ts)"/g)) {
      const file = match[1]!;
      if (!file.includes("/")) referenced.add(file);
    }

    const onDisk = readdirSync(CODING_STANDARDS_DIR)
      .filter((f) => f.endsWith(".test.ts"))
      .filter((f) => f !== "enforcement-map.test.ts" && f !== "commit-checklist-coverage.test.ts");

    const orphan = onDisk.filter((f) => !referenced.has(f));
    expect(
      orphan,
      `Add ${orphan.join(", ")} to COMMIT_CHECKLIST_ENFORCEMENT or RULE_ENFORCEMENT`,
    ).toEqual([]);
  });
});
