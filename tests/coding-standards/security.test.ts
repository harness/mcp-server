/**
 * Safety and security rules from docs/coding-standards.md §9.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Registry } from "../../src/registry/index.js";
import { idpToolset } from "../../src/registry/toolsets/idp.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const SRC = join(REPO_ROOT, "src");
const TOOLSET_DIR = join(SRC, "registry/toolsets");

const MINIMAL_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
} as const;

/** Patterns that must not appear in toolset response shaping (secret value leakage). */
const FORBIDDEN_SECRET_LEAK_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bsecretValue\b/, reason: "secretValue field must not be mapped in toolsets" },
  { pattern: /\bencryptedSecret\b/, reason: "encryptedSecret must not be mapped in toolsets" },
  { pattern: /\bdecryptedValue\b/, reason: "decryptedValue must not be mapped in toolsets" },
];

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

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

describe("Coding standards — security", () => {
  it("secret resource descriptions state values are never exposed", () => {
    const registry = new Registry(MINIMAL_CONFIG);
    const secret = registry.getResource("secret");
    expect(secret.description.toLowerCase()).toMatch(/never/);
    expect(secret.operations.get?.description.toLowerCase()).toMatch(/never/);
    expect(secret.operations.list?.description.toLowerCase()).toMatch(/never/);
  });

  it("toolset files do not map secret value fields in response extractors", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(TOOLSET_DIR)) {
      const content = readFileSync(file, "utf8");
      for (const { pattern, reason } of FORBIDDEN_SECRET_LEAK_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${rel(file)}: ${reason}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("idp workflow execute bodyBuilder does not echo api_key_secret in the API request body", () => {
    const workflow = idpToolset.resources.find((r) => r.resourceType === "idp_workflow");
    const execute = workflow?.executeActions?.execute;
    expect(execute?.bodyBuilder).toBeDefined();

    const body = execute!.bodyBuilder!({
      body: {
        identifier: "wf-1",
        workflow_details: {
          identifier: "wf-1",
          yaml: "spec:\n  steps: []\n",
        },
        api_key_secret: "should-not-leak",
        values: { foo: "bar" },
      },
    });

    expect(body).toEqual({ identifier: "wf-1", values: { foo: "bar" } });
    expect(body).not.toHaveProperty("api_key_secret");
  });

  it("HarnessClient enforces client-side rate limiting via RateLimiter", () => {
    const content = readFileSync(join(SRC, "client/harness-client.ts"), "utf8");
    expect(content).toContain("RateLimiter");
    expect(content).toContain("rateLimiter.acquire()");
  });
});
