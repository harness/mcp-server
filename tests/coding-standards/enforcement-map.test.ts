/**
 * Living index of docs/coding-standards.md → CI guardrail tests.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  AUTOMATED_STANDARDS,
  MANUAL_REVIEW_STANDARDS,
  type StandardsEnforcementEntry,
} from "./enforcement-map.js";

const TESTS_ROOT = join(import.meta.dirname, "..");

function assertEnforcementFilesExist(entries: readonly StandardsEnforcementEntry[]): void {
  const missing: string[] = [];

  for (const entry of entries) {
    for (const rel of entry.enforcedBy) {
      const full = join(TESTS_ROOT, rel);
      if (!existsSync(full)) {
        missing.push(`${entry.id}: missing ${rel}`);
      }
    }
  }

  expect(missing, `enforcement-map references missing test files:\n${missing.join("\n")}`).toEqual(
    [],
  );
}

describe("Coding standards — enforcement map", () => {
  it("documents at least one automated guardrail per major coding-standards section", () => {
    const automatedIds = new Set(AUTOMATED_STANDARDS.map((e) => e.id));
    expect(automatedIds.size).toBeGreaterThanOrEqual(10);
    expect(AUTOMATED_STANDARDS.every((e) => e.enforcedBy.length > 0)).toBe(true);
  });

  it("every automated standard references existing test files", () => {
    assertEnforcementFilesExist(AUTOMATED_STANDARDS);
  });

  it("manual-review standards are explicitly listed (not silently omitted)", () => {
    expect(MANUAL_REVIEW_STANDARDS.length).toBeGreaterThanOrEqual(2);
    for (const entry of MANUAL_REVIEW_STANDARDS) {
      expect(entry.note, `${entry.id} needs a reviewer note`).toBeTruthy();
    }
  });

  it("canonical docs warn against outdated 10-tool and Zod v3 snapshots", () => {
    assertEnforcementFilesExist([
      {
        id: "docs-consistency",
        docSection: "docs-consistency.test.ts",
        enforcedBy: ["coding-standards/docs-consistency.test.ts"],
      },
    ]);
  });
});
