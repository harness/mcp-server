/**
 * Guards the "No secrets exposed" commit-checklist rule from docs/coding-standards.md.
 * API responses may contain credentials; handlers must redact before surfacing errors.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Coding standards — secrets redaction guard", () => {
  it("keeps unit tests for redactSensitiveFields", () => {
    expect(existsSync(join(REPO_ROOT, "tests/utils/redact.test.ts"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "src/utils/redact.ts"))).toBe(true);
  });

  it("HarnessClient applies redaction on error and response paths", () => {
    const content = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");
    expect(content).toContain("redactSensitiveFields");
    expect(content).toContain("redactJsonString");
  });
});
