/**
 * Guardrails for docs/coding-standards.md §9 — never expose secret values in outputs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { redactSensitiveFields } from "../../src/utils/redact.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Coding standards — security redaction", () => {
  it("redactSensitiveFields masks common credential keys", () => {
    const result = redactSensitiveFields({
      name: "my-secret",
      token: "pat.account.id.secret",
      nested: { apiKey: "sk-live-example" },
    }) as Record<string, unknown>;

    expect(result.name).toBe("my-secret");
    expect(result.token).toBe("[REDACTED]");
    expect((result.nested as Record<string, unknown>).apiKey).toBe("[REDACTED]");
  });

  it("HarnessClient uses redactJsonString for error and debug bodies", () => {
    const clientSource = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");
    expect(clientSource).toContain("redactJsonString");
    expect(clientSource).toContain("redactSensitiveFields");
  });
});
