/**
 * Safety and security rules from docs/coding-standards.md §9.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Registry } from "../../src/registry/index.js";

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

describe("Coding standards — security (§9)", () => {
  const registry = new Registry(MINIMAL_CONFIG);

  it("secret resource is read-only (list + get only — no write operations)", () => {
    const def = registry.getResource("secret");
    const writeOps = ["create", "update", "delete"] as const;

    for (const op of writeOps) {
      expect(def.operations[op], `secret must not expose ${op}`).toBeUndefined();
    }
    expect(def.operations.list).toBeDefined();
    expect(def.operations.get).toBeDefined();
    expect(def.executeActions ?? {}).toEqual({});
  });

  it("secret resource descriptions state values are never exposed", () => {
    const def = registry.getResource("secret");
    expect(def.description.toLowerCase()).toMatch(/never/);
    expect(def.description.toLowerCase()).toMatch(/value/);

    for (const spec of Object.values(def.operations)) {
      expect(spec.description?.toLowerCase() ?? "").toMatch(/never exposed|value never/);
    }
  });

  it("HarnessClient enforces client-side rate limiting via RateLimiter", () => {
    const content = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");
    expect(content).toMatch(/import\s*\{[^}]*RateLimiter[^}]*\}\s*from/);
    expect(content).toMatch(/new\s+RateLimiter\s*\(/);
    expect(content).toMatch(/rateLimiter\.acquire\s*\(/);
  });

  it("write/execute handlers require confirm param and elicitation before dispatch", () => {
    const violations: string[] = [];

    for (const file of WRITE_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!/confirm:\s*z\.boolean\(/.test(content)) {
        violations.push(`${file}: missing confirm z.boolean() param`);
      }
      if (!content.includes("confirmViaElicitation")) {
        violations.push(`${file}: missing confirmViaElicitation()`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("body preview redacts sensitive upload content before confirmation prompts", () => {
    const content = readFileSync(join(REPO_ROOT, "src/utils/body-preview.ts"), "utf8");
    expect(content).toMatch(/content_base64|contentBase64/);
    expect(content).toMatch(/redact/i);
  });

  it("redact utility masks token/password/secret key patterns", () => {
    const content = readFileSync(join(REPO_ROOT, "src/utils/redact.ts"), "utf8");
    expect(content).toMatch(/token|password|secret/i);
    expect(content).toContain("[REDACTED]");
  });
});
