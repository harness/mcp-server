/**
 * Safety and security rules from docs/coding-standards.md §9.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Registry } from "../../src/registry/index.js";
import { redactSensitiveFields } from "../../src/utils/redact.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

const WRITE_HANDLER_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

const MINIMAL_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
} as const;

describe("Coding standards — safety and security", () => {
  const registry = new Registry(MINIMAL_CONFIG);

  it("secret resource is read-only (list + get only — no write operations)", () => {
    const def = registry.getResource("secret");
    const opNames = Object.keys(def.operations);

    expect(opNames.sort()).toEqual(["get", "list"]);
    expect(def.executeActions ?? {}).toEqual({});
  });

  it("HarnessClient enforces client-side rate limiting via RateLimiter", () => {
    const content = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");
    expect(content).toMatch(/import\s*\{[^}]*RateLimiter[^}]*\}\s*from/);
    expect(content).toMatch(/new\s+RateLimiter\s*\(/);
    expect(content).toMatch(/rateLimiter\.acquire/);
  });

  it("write/execute handlers require confirm param and elicitation before dispatch", () => {
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

  it("redactSensitiveFields masks secret-like keys in nested objects", () => {
    const input = {
      name: "my-connector",
      spec: {
        password: "super-secret",
        nested: { apiKey: "key-123", safe: "visible" },
      },
    };

    const redacted = redactSensitiveFields(input) as Record<string, unknown>;
    const spec = redacted.spec as Record<string, unknown>;
    const nested = spec.nested as Record<string, unknown>;

    expect(spec.password).toBe("[REDACTED]");
    expect(nested.apiKey).toBe("[REDACTED]");
    expect(nested.safe).toBe("visible");
    expect(redacted.name).toBe("my-connector");
  });
});
