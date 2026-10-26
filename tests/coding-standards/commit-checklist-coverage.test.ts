/**
 * Ensures every docs/coding-standards.md commit-checklist item has automated enforcement.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMMIT_CHECKLIST_ENFORCEMENT } from "./enforcement-map.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

const IT_OR_TEST = /\b(?:it|test)\s*\(\s*["'`]([^"'`]+)["'`]/g;

function collectTestNames(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(IT_OR_TEST.source, IT_OR_TEST.flags);
  while ((match = re.exec(content)) !== null) {
    names.push(match[1]!);
  }
  return names;
}

describe("Coding standards — commit checklist enforcement map", () => {
  it("documents every automated checklist guard in enforcement-map.ts", () => {
    expect(COMMIT_CHECKLIST_ENFORCEMENT.length).toBeGreaterThanOrEqual(12);
  });

  for (const entry of COMMIT_CHECKLIST_ENFORCEMENT) {
    it(`[${entry.id}] ${entry.summary}`, () => {
      const allNames: string[] = [];

      for (const file of entry.testFiles) {
        const abs = join(REPO_ROOT, file);
        expect(existsSync(abs), `missing enforcement file ${file} for ${entry.id}`).toBe(true);
        allNames.push(...collectTestNames(abs));
        if (file.endsWith(".yml") || file.endsWith(".yaml")) {
          const workflow = readFileSync(abs, "utf8");
          if (entry.testNamePattern.test(workflow)) {
            return;
          }
        }
      }

      const matched = allNames.some((name) => entry.testNamePattern.test(name));
      expect(
        matched,
        `${entry.id}: no test name matching ${entry.testNamePattern} in:\n${entry.testFiles.join("\n")}\n` +
          `Found tests: ${allNames.slice(0, 8).join(" | ")}${allNames.length > 8 ? " …" : ""}`,
      ).toBe(true);
    });
  }
});
