/**
 * Inventory of security-focused regression tests under tests/scripts/.
 * Adding a new guard file requires updating this map so CI cannot silently drop coverage.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPTS_TEST_DIR = join(import.meta.dirname);

const SECURITY_REGRESSION_TEST_FILES = [
  "adm-zip-security-lib.test.ts",
  "dockerfile-security-guards.test.ts",
  "ip-address-security-lib.test.ts",
  "security-dependency-pins.test.ts",
  "security-regression-map.test.ts",
] as const;

describe("security regression test map", () => {
  it("lists every security guard test file under tests/scripts/", () => {
    const onDisk = readdirSync(SCRIPTS_TEST_DIR)
      .filter((name) => name.endsWith(".test.ts") && name.includes("security"))
      .sort();
    expect(onDisk).toEqual([...SECURITY_REGRESSION_TEST_FILES].sort());
  });

  it("every mapped security regression test exists on disk", () => {
    for (const file of SECURITY_REGRESSION_TEST_FILES) {
      expect(existsSync(join(SCRIPTS_TEST_DIR, file)), `missing ${file}`).toBe(true);
    }
  });
});
