/**
 * Inventory of security regression guard tests — prevents deleting pin checks without review.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

const SECURITY_GUARD_TEST_FILES = [
  "tests/scripts/adm-zip-security-lib.test.ts",
  "tests/scripts/adm-zip-dependency-pins.test.ts",
  "tests/scripts/cve-dependency-pins.test.ts",
  "tests/scripts/docker-production-security.test.ts",
  "tests/scripts/ensure-secure-adm-zip-postinstall.test.ts",
  "tests/scripts/fast-uri-security-pins.test.ts",
  "tests/scripts/ip-address-security-lib.test.ts",
  "tests/scripts/npm-shrinkwrap-check.test.ts",
] as const;

describe("Security regression guard inventory", () => {
  it("keeps every documented security guard test on disk", () => {
    for (const rel of SECURITY_GUARD_TEST_FILES) {
      expect(existsSync(join(REPO_ROOT, rel)), `missing ${rel}`).toBe(true);
    }
  });
});
