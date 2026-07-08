/**
 * Safety and security guardrails from docs/coding-standards.md §9.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const SRC = join(REPO_ROOT, "src");

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

describe("Coding standards — safety and security", () => {
  it("HarnessClient uses RateLimiter for client-side throttling", () => {
    const content = readFileSync(join(SRC, "client/harness-client.ts"), "utf8");
    expect(content).toMatch(/import\s*\{[^}]*RateLimiter[^}]*\}\s*from\s*["'][^"']*rate-limiter/);
    expect(content).toMatch(/new\s+RateLimiter\s*\(/);
    expect(content).toMatch(/this\.rateLimiter/);
  });

  it("secrets toolset documents metadata-only access (no secret value endpoints)", () => {
    const content = readFileSync(join(SRC, "registry/toolsets/secrets.ts"), "utf8");
    expect(content.toLowerCase()).toMatch(/values?\s+(are\s+)?never\s+(returned|exposed)/);
    expect(content).not.toMatch(/\/decrypt|secretValue|secret_value|getSecretValue/i);
  });

  it("src/ does not log API keys or bearer tokens", () => {
    const violations: string[] = [];
    const sensitiveLogPatterns = [
      /\blog\.(info|debug|warn|error)\([^)]*HARNESS_API_KEY/,
      /\blog\.(info|debug|warn|error)\([^)]*api[_-]?key/i,
      /\blog\.(info|debug|warn|error)\([^)]*bearer\s/i,
      /\bconsole\.error\([^)]*HARNESS_API_KEY/,
    ];

    for (const file of walkTsFiles(SRC)) {
      const content = readFileSync(file, "utf8");
      for (const pattern of sensitiveLogPatterns) {
        if (pattern.test(content)) {
          violations.push(`${rel(file)}: possible credential logging`);
          break;
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("error utilities do not embed raw Authorization headers in messages", () => {
    const content = readFileSync(join(SRC, "utils/errors.ts"), "utf8");
    expect(content).not.toMatch(/Authorization:\s*Bearer/);
    expect(content).not.toMatch(/HARNESS_API_KEY/);
  });
});
