/**
 * Safety and security rules from docs/coding-standards.md §9.
 *
 * Complements architecture.test.ts (HTTP/logging) with secret-metadata,
 * rate limiting, and confirmation-preview redaction checks.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Registry } from "../../src/registry/index.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

const MINIMAL_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
} as const;

const WRITE_CONFIRMATION_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
] as const;

describe("Coding standards — safety and security", () => {
  it("secret resource is read-only metadata (no create/update/delete)", () => {
    const registry = new Registry(MINIMAL_CONFIG);
    const def = registry.getResource("secret");

    expect(def.operations.create).toBeUndefined();
    expect(def.operations.update).toBeUndefined();
    expect(def.operations.delete).toBeUndefined();
    expect(def.operations.list).toBeDefined();
    expect(def.operations.get).toBeDefined();
  });

  it("HarnessClient enforces rate limiting via RateLimiter", () => {
    const content = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");

    expect(content).toMatch(/import\s*\{[^}]*RateLimiter[^}]*\}\s*from/);
    expect(content).toMatch(/new\s+RateLimiter\s*\(/);
    expect(content).toMatch(/this\.rateLimiter\.acquire\(\)/);
  });

  it("HarnessClient redacts request/response bodies in error logs by default", () => {
    const content = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");

    expect(content).toContain("redactJsonString");
    expect(content).toMatch(/logUnsafeBodies\s*\?[\s\S]*:\s*redactJsonString/);
  });

  it("write handlers use formatBodyPreview for elicitation (redacts sensitive upload content)", () => {
    const violations: string[] = [];

    for (const file of WRITE_CONFIRMATION_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("formatBodyPreview")) {
        violations.push(`${file}: missing formatBodyPreview for confirmation prompts`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
