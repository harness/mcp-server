/**
 * docs/coding-standards.md §6 — never expose API tokens in error messages.
 *
 * Static checks on error-surface code paths: no interpolating API keys, bearer
 * tokens, or client secrets into user-facing errors or MCP tool results.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const SRC = join(REPO_ROOT, "src");

/** Code paths that construct user-facing or MCP-visible error text. */
const ERROR_SURFACE_FILES = [
  "src/client/harness-client.ts",
  "src/utils/errors.ts",
  "src/utils/response-formatter.ts",
  ...readdirSync(join(SRC, "tools"))
    .filter((f) => f.startsWith("harness-") && f.endsWith(".ts"))
    .map((f) => `src/tools/${f}`),
];

/** Interpolations that must never appear outside Authorization header assignment. */
const FORBIDDEN_OUTSIDE_AUTH_HEADER: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\$\{this\.token\}/, label: "this.token" },
  { pattern: /\$\{config\.HARNESS_API_KEY\}/, label: "config.HARNESS_API_KEY" },
  { pattern: /\$\{.*\.fmeApiKey\}/, label: "fmeApiKey" },
  { pattern: /\$\{.*HARNESS_API_KEY\}/, label: "HARNESS_API_KEY variable" },
];

function isAuthorizationHeaderLine(line: string): boolean {
  return /Authorization/.test(line) || /headers\[["']Authorization["']\]/i.test(line);
}

describe("Coding standards — error message security", () => {
  it("does not interpolate API keys or bearer tokens outside Authorization headers", () => {
    const violations: string[] = [];

    for (const file of ERROR_SURFACE_FILES) {
      const fileRel = file;
      const lines = readFileSync(join(REPO_ROOT, file), "utf8").split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (isAuthorizationHeaderLine(line)) continue;

        for (const { pattern, label } of FORBIDDEN_OUTSIDE_AUTH_HEADER) {
          if (pattern.test(line)) {
            violations.push(`${fileRel}:${i + 1}: interpolates ${label} outside auth headers`);
          }
        }

        if (/Bearer \$\{/.test(line) && !isAuthorizationHeaderLine(line)) {
          violations.push(`${fileRel}:${i + 1}: Bearer interpolation outside Authorization header`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("errors.ts does not interpolate secrets into MCP error messages", () => {
    const content = readFileSync(join(SRC, "utils/errors.ts"), "utf8");
    expect(content).not.toMatch(/\$\{[^}]*(?:API_KEY|apiKey|token|secret)/i);
  });

  it("harness-client 401 guidance names the env var without echoing key values", () => {
    const content = readFileSync(join(SRC, "client/harness-client.ts"), "utf8");
    expect(content).toMatch(/Verify HARNESS_API_KEY/);
    expect(content).not.toMatch(/`\$\{this\.token\}/);
  });
});
