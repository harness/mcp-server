/**
 * Toolset responseExtractor discipline from docs/coding-standards.md.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLSET_DIR = join(REPO_ROOT, "src/registry/toolsets");

const TOOLSET_HELPER_FILES = new Set([
  "src/registry/toolsets/chaos-descriptions.ts",
  "src/registry/toolsets/scopes.ts",
]);

/** Inline extractors grandfathered until promoted to extractors.ts. */
const ALLOWED_INLINE_EXTRACTOR_FILES = new Set([
  "src/registry/toolsets/ansible.ts",
  "src/registry/toolsets/ccm.ts",
  "src/registry/toolsets/chaos.ts",
  "src/registry/toolsets/governance.ts",
  "src/registry/toolsets/iacm.ts",
  "src/registry/toolsets/idp.ts",
  "src/registry/toolsets/knowledge-graph.ts",
  "src/registry/toolsets/sto.ts",
]);

const INLINE_EXTRACTOR_PATTERN = /responseExtractor:\s*\(/;

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

describe("Coding standards — toolset extractors", () => {
  it("does not add new inline responseExtractor functions outside the allowlist", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(TOOLSET_DIR)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const content = readFileSync(file, "utf8");
      if (!INLINE_EXTRACTOR_PATTERN.test(content)) continue;

      if (!ALLOWED_INLINE_EXTRACTOR_FILES.has(fileRel)) {
        violations.push(
          `${fileRel}: inline responseExtractor — add a shared extractor in extractors.ts or request allowlist entry`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("inline responseExtractor count stays at or below the grandfathered ceiling", () => {
    let count = 0;
    for (const file of walkTsFiles(TOOLSET_DIR)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;
      const content = readFileSync(file, "utf8");
      const matches = content.match(/responseExtractor:\s*\(/g);
      if (matches) count += matches.length;
    }

    // Ceiling prevents new inline extractors without updating extractors.ts.
    expect(count).toBeLessThanOrEqual(14);
  });
});
