/**
 * Pagination defaults from docs/coding-standards.md §8.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Coding standards — pagination defaults", () => {
  it("harness_list uses page=0, size=20, max size=100", () => {
    const content = readFileSync(join(REPO_ROOT, "src/tools/harness-list.ts"), "utf8");

    expect(content).toMatch(/page:\s*z\.number\(\)\.default\(0\)/);
    expect(content).toMatch(/size:\s*z\.number\(\)\.min\(1\)\.max\(100\)\.default\(20\)/);
  });
});
