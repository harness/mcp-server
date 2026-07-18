/**
 * Safety and security rules from docs/coding-standards.md §9.
 *
 * Complements registry-metadata write-handler checks with secret exposure,
 * client-side rate limiting, and response redaction guardrails.
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

/** Schema/body field names that must never appear in secret toolset specs. */
const FORBIDDEN_SECRET_VALUE_FIELDS = [
  "secretValue",
  "secretText",
  "decryptedValue",
  "plaintext",
] as const;

describe("Coding standards — safety and security (§9)", () => {
  const registry = new Registry(MINIMAL_CONFIG);

  it("secret resource is read-only metadata (list + get only)", () => {
    const def = registry.getResource("secret");
    const ops = Object.keys(def.operations);

    expect(ops.sort()).toEqual(["get", "list"]);
    expect(def.executeActions ?? {}).toEqual({});
  });

  it("secret resource description states values are never exposed", () => {
    const def = registry.getResource("secret");
    expect(def.description.toLowerCase()).toMatch(/never|not returned|metadata/);
  });

  it("HarnessClient enforces client-side rate limiting via RateLimiter", () => {
    const content = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");
    expect(content).toMatch(/import\s*\{[^}]*RateLimiter[^}]*\}\s*from/);
    expect(content).toMatch(/new\s+RateLimiter\s*\(/);
  });

  it("HarnessClient redacts sensitive fields in logged API bodies by default", () => {
    const content = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");
    expect(content).toContain("redactJsonString");
    expect(content).toMatch(/logUnsafeBodies\s*\?\s*[^:]+:\s*redactJsonString/);
  });

  it("redact utility covers common credential key patterns", () => {
    const content = readFileSync(join(REPO_ROOT, "src/utils/redact.ts"), "utf8");
    expect(content).toMatch(/api[_-]?key|access[_-]?token|password|secret/i);
    expect(content).toContain("redactSensitiveFields");
  });

  it("secrets toolset does not define body fields that expose secret values", () => {
    const content = readFileSync(
      join(REPO_ROOT, "src/registry/toolsets/secrets.ts"),
      "utf8",
    );

    for (const key of FORBIDDEN_SECRET_VALUE_FIELDS) {
      expect(
        content,
        `secrets toolset must not define exposed value field "${key}"`,
      ).not.toMatch(new RegExp(`\\b${key}\\s*:`));
    }
  });
});
