/**
 * Regression guard for PR #861 — scope field copy must not imply defaults exist
 * when HARNESS_ORG / HARNESS_PROJECT are unset (common in hosted/multi-user HTTP).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Multi-scope project toolsets updated to steer agents toward explicit org/project. */
const MULTI_SCOPE_PROJECT_TOOLSETS = [
  "src/registry/toolsets/connectors.ts",
  "src/registry/toolsets/environments.ts",
  "src/registry/toolsets/infrastructure.ts",
  "src/registry/toolsets/secrets.ts",
  "src/registry/toolsets/services.ts",
];

const LEGACY_ACCOUNT_SCOPE_COPY = /Use resource_scope='account' to list or get account-level/;

describe("Coding standards — scope description copy", () => {
  it.each(MULTI_SCOPE_PROJECT_TOOLSETS)(
    "%s directs agents to pass org/project on first call",
    (file) => {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      expect(content).toContain("Default list/get");
      expect(content).toContain("pass org_id and project_id");
      expect(content).toContain("only when the user asked for account-level");
      expect(content).not.toMatch(LEGACY_ACCOUNT_SCOPE_COPY);
    },
  );

  it("server instructions warn against false org/project defaults", () => {
    const content = readFileSync(join(REPO_ROOT, "src/index.ts"), "utf8");
    expect(content).toContain(
      "Do not omit them expecting a default unless the field description names a configured default",
    );
    expect(content).toContain(
      "Do not switch to resource_scope='account' just because a project-scoped lookup failed",
    );
  });

  it("shared scope helpers live in input-schemas.ts", () => {
    const content = readFileSync(join(REPO_ROOT, "src/tools/input-schemas.ts"), "utf8");
    expect(content).toContain("export function orgIdDescription");
    expect(content).toContain("export function describeScopeHint");
    expect(content).toContain("do not use account to skip a known org/project");
  });
});
