/**
 * Maps docs/coding-standards.md Commit Checklist items to automated guardrails.
 * When adding a checklist rule, extend this map and implement coverage in the referenced test file.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

/** Checklist themes from docs/coding-standards.md → vitest files that enforce them. */
const CHECKLIST_ENFORCEMENT: Array<{ checklist: string; guardFiles: string[] }> = [
  {
    checklist: "No new server.registerTool() calls",
    guardFiles: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/consolidated-tools.test.ts"],
  },
  {
    checklist: "No console.log() in src/",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "No direct fetch() outside documented exceptions",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "No new harness-*.ts handler files",
    guardFiles: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/file-organization.test.ts"],
  },
  {
    checklist: "Toolset files are pure data",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "Zod .describe() chaining (Zod 4)",
    guardFiles: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/input-conventions.test.ts"],
  },
  {
    checklist: "Every inputSchema param has .describe()",
    guardFiles: ["tests/coding-standards/registry-metadata.test.ts"],
  },
  {
    checklist: "Tool input snake_case and list pagination defaults",
    guardFiles: ["tests/coding-standards/input-conventions.test.ts"],
  },
  {
    checklist: "Response extractors from extractors.ts",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "Scope and identifierFields on resources",
    guardFiles: [
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "operationPolicy on every endpoint",
    guardFiles: ["tests/registry/structural-validation.test.ts"],
  },
  {
    checklist: "Write operations require confirmation (confirm + elicitation)",
    guardFiles: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/registry-metadata.test.ts"],
  },
  {
    checklist: "No secrets exposed in tool output (redaction)",
    guardFiles: ["tests/utils/redact.test.ts", "tests/utils/body-preview.test.ts"],
  },
  {
    checklist: "HarnessClient singleton (no extra instances or bypass)",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "Error handling (toMcpError / errorResult)",
    guardFiles: ["tests/coding-standards/error-handling.test.ts"],
  },
  {
    checklist: "Registry contract and dispatch",
    guardFiles: ["tests/coding-standards/registry-contract.test.ts"],
  },
  {
    checklist: "Contributor docs aligned with enforced tool count and Zod v4",
    guardFiles: ["tests/coding-standards/docs-consistency.test.ts"],
  },
  {
    checklist: "Transitive dependency CVE floors (body-parser, zod, fast-uri, ip-address)",
    guardFiles: ["tests/scripts/cve-dependency-pins.test.ts", "tests/scripts/ip-address-security-lib.test.ts"],
  },
  {
    checklist: "HTTP framework security pins (hono, @hono/node-server, vite)",
    guardFiles: ["tests/scripts/http-framework-security-pins.test.ts"],
  },
  {
    checklist: "adm-zip CVE pins and postinstall remediation (onnxruntime-node nested copy)",
    guardFiles: [
      "tests/scripts/adm-zip-dependency-pins.test.ts",
      "tests/scripts/adm-zip-security-lib.test.ts",
      "tests/release-metadata.test.ts",
    ],
  },
  {
    checklist: "Production container image Debian/OpenSSL security baseline",
    guardFiles: ["tests/docker/production-dockerfile.test.ts"],
  },
];

describe("Coding standards — enforcement map", () => {
  it("every checklist guard file exists on disk", () => {
    const missing: string[] = [];
    const seen = new Set<string>();

    for (const { guardFiles } of CHECKLIST_ENFORCEMENT) {
      for (const rel of guardFiles) {
        if (seen.has(rel)) continue;
        seen.add(rel);
        if (!existsSync(join(REPO_ROOT, rel))) {
          missing.push(rel);
        }
      }
    }

    expect(missing, `Missing guardrail test files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("docs/coding-standards.md commit checklist points contributors at pnpm standards:check", () => {
    const content = readFileSync(STANDARDS_PATH, "utf8");
    const checklistSection = content.slice(content.indexOf("## Commit Checklist"));
    expect(checklistSection).toContain("pnpm standards:check");
  });

  it("maps each documented checklist theme to at least one guard file", () => {
    expect(CHECKLIST_ENFORCEMENT.length).toBeGreaterThanOrEqual(10);
    for (const entry of CHECKLIST_ENFORCEMENT) {
      expect(entry.guardFiles.length, entry.checklist).toBeGreaterThan(0);
    }
  });
});
