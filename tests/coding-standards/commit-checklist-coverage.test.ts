/**
 * Ensures every docs/coding-standards.md commit-checklist item has automated enforcement.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMMIT_CHECKLIST_ENFORCEMENT } from "./enforcement-map.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");

const CHECKLIST_BULLET = /^- \[ \] \*\*(.+)\*\*/;

function extractCommitChecklistBullets(markdown: string): string[] {
  const sectionStart = markdown.indexOf("## Commit Checklist");
  expect(sectionStart, "docs/coding-standards.md missing ## Commit Checklist").toBeGreaterThanOrEqual(0);
  const afterStart = markdown.slice(sectionStart);
  const sectionEnd = afterStart.search(/\n## [^#]/);
  const section = sectionEnd === -1 ? afterStart : afterStart.slice(0, sectionEnd);

  const bullets: string[] = [];
  for (const line of section.split("\n")) {
    const match = CHECKLIST_BULLET.exec(line.trim());
    if (match) {
      bullets.push(match[1]!);
    }
  }
  return bullets;
}

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
  it("maps every docs/coding-standards.md commit-checklist bullet to enforcement-map.ts", () => {
    const docBullets = extractCommitChecklistBullets(readFileSync(STANDARDS_DOC, "utf8"));
    expect(docBullets.length).toBe(COMMIT_CHECKLIST_ENFORCEMENT.length);

    const unmatchedBullets: string[] = [];
    for (const bullet of docBullets) {
      const hasGuard = COMMIT_CHECKLIST_ENFORCEMENT.some((entry) =>
        bullet.includes(entry.docBulletIncludes),
      );
      if (!hasGuard) {
        unmatchedBullets.push(bullet);
      }
    }

    expect(
      unmatchedBullets,
      `Add enforcement-map.ts entry (docBulletIncludes) for checklist bullets:\n${unmatchedBullets.join("\n")}`,
    ).toEqual([]);

    const orphanGuards = COMMIT_CHECKLIST_ENFORCEMENT.filter(
      (entry) => !docBullets.some((bullet) => bullet.includes(entry.docBulletIncludes)),
    );
    expect(
      orphanGuards.map((g) => g.id),
      "enforcement-map docBulletIncludes no longer matches any commit checklist bullet",
    ).toEqual([]);
  });

  it("documents every automated checklist guard in enforcement-map.ts", () => {
    expect(COMMIT_CHECKLIST_ENFORCEMENT.length).toBeGreaterThanOrEqual(16);
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
