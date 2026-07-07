/**
 * File organization rules — docs/coding-standards.md §11.
 *
 * src/tools/ is fixed to the 11 harness handler files plus shared schemas and
 * diagnose/entity-schema helpers. New Harness API domains belong in
 * src/registry/toolsets/, not as per-domain tool files.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ALLOWED_TOOLS_ROOT_FILES } from "./allowed-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLS_DIR = join(REPO_ROOT, "src/tools");

const ALLOWED_TOOLS_SUBDIRS = new Set(["diagnose", "entity-schema"]);

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

describe("Coding standards — file organization", () => {
  it("src/tools/ contains only the 11 harness handlers and shared helpers", () => {
    const violations: string[] = [];

    for (const entry of readdirSync(TOOLS_DIR)) {
      const full = join(TOOLS_DIR, entry);
      const stat = statSync(full);

      if (stat.isDirectory()) {
        if (!ALLOWED_TOOLS_SUBDIRS.has(entry)) {
          violations.push(`src/tools/${entry}/ — unexpected subdirectory (use src/registry/toolsets/)`);
        }
        continue;
      }

      if (!ALLOWED_TOOLS_ROOT_FILES.has(entry)) {
        violations.push(`src/tools/${entry} — unexpected file (new API domains go in src/registry/toolsets/)`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not add per-domain tool files (pipelines.ts, connectors.ts, etc.)", () => {
    const domainToolPattern =
      /^(pipelines|executions|connectors|services|environments|projects|secrets|triggers|delegates|feature-flags|logs)\.ts$/;
    const violations = readdirSync(TOOLS_DIR).filter((f) => domainToolPattern.test(f));

    expect(
      violations,
      `Legacy per-domain tool files found in src/tools/: ${violations.join(", ")}`,
    ).toEqual([]);
  });
});
