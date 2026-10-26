/**
 * §9 safety — never expose secrets; sanitize unsafe error surfaces before MCP clients see them.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toMcpError, HarnessApiError } from "../../src/utils/errors.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Coding standards — error sanitization and secret surfaces", () => {
  it("toMcpError strips HTML login pages and JS redirect payloads from HarnessApiError messages", () => {
    const html = toMcpError(new HarnessApiError("<html><body>sign in</body></html>", 401));
    expect(html.message).not.toContain("<html>");
    expect(html.message).toContain("HTML error page");

    const js = toMcpError(
      new HarnessApiError('function redirectPage() { const signInPath = "auth/#/signin"; }', 401),
    );
    expect(js.message).not.toContain("redirectPage");
    expect(js.message).toContain("login redirect");
  });

  it("HarnessClient logs use redactJsonString for request/response bodies by default", () => {
    const clientSource = readFileSync(join(REPO_ROOT, "src/client/harness-client.ts"), "utf8");
    expect(clientSource).toContain("redactJsonString");
    expect(clientSource).toMatch(/logUnsafeBodies\s*\?\s*body/);
  });

  it("shared redact helper exists for sensitive field keys", () => {
    const redactSource = readFileSync(join(REPO_ROOT, "src/utils/redact.ts"), "utf8");
    expect(redactSource).toContain("redactSensitiveFields");
    expect(redactSource).toMatch(/password|secret|token/i);
  });
});
