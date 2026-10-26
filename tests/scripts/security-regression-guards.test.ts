/**
 * Inventory of automated guards for recent security/CVE regressions on fix/security-alerts-oct26.
 * Each file must exist and stay wired in tests/coding-standards/enforcement-map.test.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Guardrail vitest modules that must not be deleted without updating the enforcement map. */
export const SECURITY_REGRESSION_GUARD_FILES = [
  "tests/scripts/cve-dependency-pins.test.ts",
  "tests/scripts/http-framework-security-pins.test.ts",
  "tests/scripts/ip-address-security-lib.test.ts",
  "tests/scripts/adm-zip-dependency-pins.test.ts",
  "tests/scripts/adm-zip-security-lib.test.ts",
  "tests/docker/production-dockerfile.test.ts",
  "tests/registry/access-control-service-account.test.ts",
  "tests/registry/extractors-service-account.test.ts",
] as const;

describe("security regression guard inventory", () => {
  it("every listed guard file exists on disk", () => {
    const missing = SECURITY_REGRESSION_GUARD_FILES.filter((rel) => !existsSync(join(REPO_ROOT, rel)));
    expect(missing, `Missing security guard files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("enforcement-map.test.ts references each security guard", () => {
    const enforcementMapSource = readFileSync(
      join(REPO_ROOT, "tests/coding-standards/enforcement-map.test.ts"),
      "utf8",
    );
    const unmapped = SECURITY_REGRESSION_GUARD_FILES.filter((rel) => !enforcementMapSource.includes(rel));
    expect(
      unmapped,
      `Add these to CHECKLIST_ENFORCEMENT in enforcement-map.test.ts:\n${unmapped.join("\n")}`,
    ).toEqual([]);
  });
});
