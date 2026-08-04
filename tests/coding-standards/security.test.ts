/**
 * Safety and security rules from docs/coding-standards.md §9.
 *
 * Complements architecture.test.ts (write confirmation) and registry-contract.test.ts
 * (operationPolicy) with secret-metadata-only guarantees and client-side safeguards.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Registry } from "../../src/registry/index.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const SRC = join(REPO_ROOT, "src");
const TOOLSETS_DIR = join(SRC, "registry/toolsets");

const MINIMAL_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
} as const;

/** Paths that would return decrypted secret material — must never appear in toolsets. */
const FORBIDDEN_SECRET_VALUE_PATH_PATTERNS = [
  /\/secret[s]?\/[^/]+\/value\b/i,
  /\/secret-values?\b/i,
  /\/decrypt\b/i,
  /\/plaintext\b/i,
  /\/ng\/api\/.*\/secrets\/.*\/file\b/i,
];

const WRITE_HANDLER_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

function collectEndpointPaths(registry: Registry): Array<{ resource: string; op: string; path: string }> {
  const paths: Array<{ resource: string; op: string; path: string }> = [];

  for (const resourceType of registry.getAllResourceTypes()) {
    const def = registry.getResource(resourceType);
    for (const [operation, spec] of Object.entries(def.operations)) {
      paths.push({ resource: resourceType, op: operation, path: spec.path });
    }
    for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
      paths.push({ resource: resourceType, op: action, path: spec.path });
    }
  }

  return paths;
}

describe("Coding standards — safety and security (§9)", () => {
  const registry = new Registry(MINIMAL_CONFIG);

  it("secret resource is read-only metadata (no create/update/delete)", () => {
    const def = registry.getResource("secret");
    expect(def.operations.create).toBeUndefined();
    expect(def.operations.update).toBeUndefined();
    expect(def.operations.delete).toBeUndefined();
    expect(def.executeActions).toBeUndefined();
  });

  it("no registry endpoint paths fetch decrypted secret values", () => {
    const violations: string[] = [];

    for (const { resource, op, path } of collectEndpointPaths(registry)) {
      for (const pattern of FORBIDDEN_SECRET_VALUE_PATH_PATTERNS) {
        if (pattern.test(path)) {
          violations.push(`${resource}.${op}: ${path}`);
        }
      }
    }

    expect(
      violations,
      `Endpoints that may expose secret values:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("write handlers require confirm param and confirmViaElicitation", () => {
    const violations: string[] = [];

    for (const file of WRITE_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!/confirm:\s*z\.boolean\(/.test(content)) {
        violations.push(`${file}: missing confirm z.boolean() input param`);
      }
      if (!content.includes("confirmViaElicitation")) {
        violations.push(`${file}: missing confirmViaElicitation()`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("HarnessClient enforces client-side rate limiting via RateLimiter", () => {
    const content = readFileSync(join(SRC, "client/harness-client.ts"), "utf8");
    expect(content).toMatch(/new RateLimiter\(/);
    expect(content).toMatch(/rateLimiter\.acquire\(/);
  });

  it("HarnessClient redacts sensitive fields in request/response logs", () => {
    const content = readFileSync(join(SRC, "client/harness-client.ts"), "utf8");
    expect(content).toContain("redactJsonString");
    expect(content).not.toMatch(/logUnsafeBodies\s*\?\s*bodyString\s*:\s*bodyString/);
  });

  it("toolset files do not define secret-value fetch endpoints", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(TOOLSETS_DIR)) {
      const content = readFileSync(file, "utf8");
      const fileRel = rel(file);

      for (const pattern of FORBIDDEN_SECRET_VALUE_PATH_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${fileRel}: matches ${pattern}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
