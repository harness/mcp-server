/**
 * Guards the "No secrets exposed" commit-checklist rule at HTTP/logging boundaries.
 * Full redaction behavior is covered in tests/utils/redact.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CLIENT_PATH = join(REPO_ROOT, "src/client/harness-client.ts");
const BODY_PREVIEW_PATH = join(REPO_ROOT, "src/utils/body-preview.ts");

describe("Coding standards — secret output boundaries", () => {
  it("HarnessClient redacts request/response bodies in logs by default", () => {
    const content = readFileSync(CLIENT_PATH, "utf8");
    expect(content).toMatch(/from\s+["'][^"']*redact\.js["']/);
    expect(content).toContain("redactJsonString");
    expect(content).toContain("redactSensitiveFields");
    expect(content).toMatch(/logUnsafeBodies\s*\?\s*[^:]+:\s*redactJsonString/);
  });

  it("body preview utility redacts values instead of echoing raw payloads", () => {
    const content = readFileSync(BODY_PREVIEW_PATH, "utf8");
    expect(content).toMatch(/redactValue/);
    expect(content).toContain("[redacted");
  });
});
