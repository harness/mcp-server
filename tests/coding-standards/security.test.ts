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

/** Paths that would return decrypted secret material — must never appear in toolsets. */
const FORBIDDEN_SECRET_VALUE_PATHS = [
  /\/secrets\/[^"']*\/value/i,
  /secretValue/i,
  /decryptedValue/i,
  /getSecretValue/i,
];

describe("Coding standards — safety and security", () => {
  it("write handlers require explicit confirm before dispatch", () => {
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

  it("secret toolset documents that values are never exposed", () => {
    const registry = new Registry(MINIMAL_CONFIG);
    const def = registry.getResource("secret");

    expect(def.description).toMatch(/never/i);
    for (const [operation, spec] of Object.entries(def.operations)) {
      expect(
        spec.description,
        `secret.${operation} description must state values are not returned`,
      ).toMatch(/never|metadata/i);
    }
  });

  it("toolset endpoint paths do not fetch decrypted secret values", () => {
    const secretsContent = readFileSync(
      join(REPO_ROOT, "src/registry/toolsets/secrets.ts"),
      "utf8",
    );
    const violations: string[] = [];

    for (const pattern of FORBIDDEN_SECRET_VALUE_PATHS) {
      if (pattern.test(secretsContent)) {
        violations.push(`secrets.ts matches forbidden pattern ${pattern}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("harness-client redacts sensitive fields in request/response logs by default", () => {
    const content = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");
    expect(content).toContain("redactJsonString");
    expect(content).toMatch(/logUnsafeBodies/);
  });
});
