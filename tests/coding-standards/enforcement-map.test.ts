/**
 * Traceability from docs/coding-standards.md rules to automated guardrails.
 * When adding a new architecture rule, extend this map and the matching test file.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const STANDARDS_DIR = join(import.meta.dirname);
const STRUCTURAL_VALIDATION = join(import.meta.dirname, "../registry/structural-validation.test.ts");

/** docs/coding-standards.md section → vitest modules that enforce it. */
const ENFORCEMENT_MAP: ReadonlyArray<{ section: string; files: readonly string[] }> = [
  {
    section: "§1 — fixed consolidated MCP tools (no new handlers)",
    files: [
      "architecture.test.ts",
      "consolidated-tools-sync.test.ts",
      "file-organization.test.ts",
    ],
  },
  {
    section: "§2 — toolset definitions are pure data",
    files: ["architecture.test.ts"],
  },
  {
    section: "§3 — shared response extractors",
    files: ["architecture.test.ts"],
  },
  {
    section: "§4 — Harness scoping model",
    files: ["scope-params.test.ts", "toolset-scope.test.ts", "registry-contract.test.ts"],
  },
  {
    section: "§5 — identifierFields and registry metadata",
    files: ["registry-contract.test.ts", "registry-metadata.test.ts"],
  },
  {
    section: "§6 — error handling pattern",
    files: ["error-handling.test.ts", "architecture.test.ts"],
  },
  {
    section: "§7 — logging (no stdout)",
    files: ["architecture.test.ts"],
  },
  {
    section: "§8 — tool input schema conventions",
    files: ["input-conventions.test.ts", "registry-metadata.test.ts", "architecture.test.ts"],
  },
  {
    section: "§9 — write confirmation / safety",
    files: ["architecture.test.ts", "registry-metadata.test.ts"],
  },
  {
    section: "§10 — singleton HarnessClient / no raw fetch",
    files: ["architecture.test.ts"],
  },
  {
    section: "§11 — file organization",
    files: ["file-organization.test.ts"],
  },
  {
    section: "Registry structural validation (path/params, operationPolicy)",
    files: ["../registry/structural-validation.test.ts"],
  },
  {
    section: "Documentation drift (11 tools, Zod v4, registerTool)",
    files: ["docs-consistency.test.ts"],
  },
  {
    section: "Security / supply-chain regression pins (CVE, Docker, adm-zip, ip-address)",
    files: ["security-regression-map.test.ts"],
  },
];

describe("Coding standards — enforcement map", () => {
  it("every mapped guardrail test file exists on disk", () => {
    const missing: string[] = [];

    for (const { section, files } of ENFORCEMENT_MAP) {
      for (const file of files) {
        const full = file.startsWith("../") ? join(STANDARDS_DIR, file) : join(STANDARDS_DIR, file);
        if (!existsSync(full)) {
          missing.push(`${section}: ${file}`);
        }
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("structural-validation.test.ts is part of pnpm standards:check", () => {
    expect(existsSync(STRUCTURAL_VALIDATION)).toBe(true);
  });

  it("maps at least one test file per major coding-standards section", () => {
    expect(ENFORCEMENT_MAP.length).toBeGreaterThanOrEqual(10);
    const uniqueFiles = new Set(
      ENFORCEMENT_MAP.flatMap((e) => e.files.map((f) => f.replace(/^\.\.\//, ""))),
    );
    expect(uniqueFiles.size).toBeGreaterThanOrEqual(8);
  });
});
