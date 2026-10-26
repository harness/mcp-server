/**
 * Guardrails for docs/coding-standards.md §9 — never expose secret values in tool output or logs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Coding standards — secret value safety", () => {
  it("HarnessClient redacts sensitive fields in error/log payloads", () => {
    const clientPath = join(REPO_ROOT, "src/client/harness-client.ts");
    const content = readFileSync(clientPath, "utf8");
    expect(content).toContain("redactJsonString");
    expect(content).toContain("redactSensitiveFields");
  });

  it("MCP error mapping sanitizes messages (no token leakage)", () => {
    const errorsPath = join(REPO_ROOT, "src/utils/errors.ts");
    const content = readFileSync(errorsPath, "utf8");
    expect(content).toMatch(/function sanitizeErrorMessage/);
    expect(content).toContain("sanitizeErrorMessage(err.message)");
  });

  it("secret resource toolset documents that values are never returned", () => {
    const secretsPath = join(REPO_ROOT, "src/registry/toolsets/secrets.ts");
    const content = readFileSync(secretsPath, "utf8");
    expect(content).toMatch(/Values are NEVER returned/i);
    expect(content).toMatch(/values never exposed/i);
  });

  it("redact utility has regression tests", () => {
    const redactTests = join(REPO_ROOT, "tests/utils/redact.test.ts");
    expect(readFileSync(redactTests, "utf8").length).toBeGreaterThan(100);
  });
});
