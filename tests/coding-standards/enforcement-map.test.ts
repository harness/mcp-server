/**
 * Maps docs/coding-standards.md commit checklist items to automated guardrails.
 * Fails if a checklist-backed test file is removed without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

type ChecklistEnforcement = {
  /** Human-readable checklist line from docs/coding-standards.md */
  checklist: string;
  /** Test file(s) that enforce it (repo-relative) */
  testFiles: string[];
  /** Substring that must appear in at least one test file (sanity check) */
  mustContain: string;
};

const ENFORCEMENT_MAP: ChecklistEnforcement[] = [
  {
    checklist: "No new registerTool() outside fixed harness handlers",
    testFiles: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/consolidated-tools.test.ts"],
    mustContain: "registerTool",
  },
  {
    checklist: "No console.log() in src/",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "console.log",
  },
  {
    checklist: "No undocumented global fetch()",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "global fetch",
  },
  {
    checklist: "No new harness-*.ts handler files",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
    mustContain: "harness-",
  },
  {
    checklist: "Toolset files are pure data",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "toolset purity",
  },
  {
    checklist: "Zod v4 import and describe-after-optional chaining",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "zod/v4",
  },
  {
    checklist: "Shared response extractors (no new inline extractors)",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "inline responseExtractor",
  },
  {
    checklist: "Scope declared on resources",
    testFiles: ["tests/coding-standards/toolset-scope.test.ts", "tests/coding-standards/scope-params.test.ts"],
    mustContain: "scope",
  },
  {
    checklist: "identifierFields and operationPolicy on endpoints",
    testFiles: ["tests/coding-standards/registry-contract.test.ts"],
    mustContain: "identifierFields",
  },
  {
    checklist: "Write handlers use confirm + elicitation",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "confirmViaElicitation",
  },
  {
    checklist: "ToolsetName union matches ALL_TOOLSETS",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "ToolsetName",
  },
  {
    checklist: "snake_case params and pagination defaults",
    testFiles: ["tests/coding-standards/input-conventions.test.ts"],
    mustContain: "snake_case",
  },
  {
    checklist: "Error handling uses toMcpError / errorResult",
    testFiles: ["tests/coding-standards/error-handling.test.ts"],
    mustContain: "toMcpError",
  },
  {
    checklist: "Docs stay on 11-tool / Zod v4 model",
    testFiles: ["tests/coding-standards/docs-consistency.test.ts"],
    mustContain: "consolidated tool handlers",
  },
  {
    checklist: "Registry structural validation",
    testFiles: ["tests/registry/structural-validation.test.ts"],
    mustContain: "structural validation",
  },
  {
    checklist: "CVE dependency floors (body-parser, zod, fast-uri, ip-address)",
    testFiles: ["tests/scripts/cve-dependency-pins.test.ts"],
    mustContain: "CVE dependency pins",
  },
  {
    checklist: "HTTP framework CVE pins (hono, @hono/node-server, vite)",
    testFiles: ["tests/scripts/http-framework-security-pins.test.ts"],
    mustContain: "HTTP framework security pins",
  },
  {
    checklist: "Production Dockerfile Debian/OpenSSL security layers",
    testFiles: ["tests/docker/production-dockerfile.test.ts"],
    mustContain: "DEBIAN_SECURITY_REFRESH",
  },
  {
    checklist: "adm-zip postinstall security patch for npm consumers",
    testFiles: [
      "tests/scripts/adm-zip-security-lib.test.ts",
      "tests/scripts/npm-publish-security-manifest.test.ts",
    ],
    mustContain: "ensure-secure-adm-zip",
  },
  {
    checklist: "ip-address security floor and active install resolution",
    testFiles: ["tests/scripts/ip-address-security-lib.test.ts"],
    mustContain: "SECURE_IP_ADDRESS_VERSION",
  },
  {
    checklist: "Shared pnpm-lock version parsing for security scans",
    testFiles: ["tests/scripts/pnpm-lock-parse-lib.test.ts"],
    mustContain: "parsePnpmLockPackageVersions",
  },
];

describe("Coding standards — enforcement map", () => {
  it("every commit checklist guardrail has on-disk test coverage", () => {
    const missing: string[] = [];

    for (const entry of ENFORCEMENT_MAP) {
      let foundContent = false;
      for (const file of entry.testFiles) {
        const full = join(REPO_ROOT, file);
        if (!existsSync(full)) {
          missing.push(`${entry.checklist}: missing file ${file}`);
          continue;
        }
        const content = readFileSync(full, "utf8");
        if (content.includes(entry.mustContain)) {
          foundContent = true;
        }
      }
      if (!foundContent) {
        missing.push(
          `${entry.checklist}: none of ${entry.testFiles.join(", ")} contain "${entry.mustContain}"`,
        );
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("standards suite includes every coding-standards test module", () => {
    const expectedModules = [
      "architecture.test.ts",
      "consolidated-tools.test.ts",
      "docs-consistency.test.ts",
      "enforcement-map.test.ts",
      "error-handling.test.ts",
      "file-organization.test.ts",
      "input-conventions.test.ts",
      "registry-contract.test.ts",
      "registry-metadata.test.ts",
      "scope-params.test.ts",
      "toolset-scope.test.ts",
    ];

    for (const module of expectedModules) {
      expect(
        existsSync(join(CODING_STANDARDS_DIR, module)),
        `missing tests/coding-standards/${module}`,
      ).toBe(true);
    }
  });

  it("security regression suite includes every docker and scripts guard module", () => {
    const securityModules = [
      "tests/docker/production-dockerfile.test.ts",
      "tests/scripts/adm-zip-security-lib.test.ts",
      "tests/scripts/cve-dependency-pins.test.ts",
      "tests/scripts/http-framework-security-pins.test.ts",
      "tests/scripts/ip-address-security-lib.test.ts",
      "tests/scripts/npm-publish-security-manifest.test.ts",
      "tests/scripts/pnpm-lock-parse-lib.test.ts",
    ];

    for (const module of securityModules) {
      expect(existsSync(join(REPO_ROOT, module)), `missing ${module}`).toBe(true);
    }

    const mappedSecurityTests = new Set(
      ENFORCEMENT_MAP.flatMap((entry) => entry.testFiles).filter((file) =>
        file.startsWith("tests/docker/") || file.startsWith("tests/scripts/"),
      ),
    );
    for (const module of securityModules) {
      expect(mappedSecurityTests.has(module), `${module} must appear in ENFORCEMENT_MAP`).toBe(
        true,
      );
    }
  });
});
