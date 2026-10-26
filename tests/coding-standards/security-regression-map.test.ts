/**
 * Guards security-focused regression tests added for dependency and container CVE fixes.
 * Prevents deleting pin/Dockerfile guardrails without updating this map.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Vitest files that lock patched dependency floors and production image hardening. */
const SECURITY_REGRESSION_TEST_FILES = [
  "tests/docker/production-dockerfile.test.ts",
  "tests/scripts/adm-zip-security-lib.test.ts",
  "tests/scripts/cve-dependency-pins.test.ts",
  "tests/scripts/http-framework-security-pins.test.ts",
  "tests/scripts/ip-address-security-lib.test.ts",
  "tests/scripts/npm-shrinkwrap-security.test.ts",
  "tests/scripts/security-version-floor.test.ts",
] as const;

/** pnpm override keys that must stay at or above documented security floors. */
const REQUIRED_PNPM_OVERRIDE_FLOORS: Record<string, string> = {
  "body-parser": "2.4.0",
  zod: "4.6.6",
  "fast-uri": "4.2.3",
  "ip-address": "10.7.4",
  hono: "4.13.11",
  "@hono/node-server": "2.0.10",
  "adm-zip": "0.6.1",
};

describe("Security regression — enforcement map", () => {
  it("lists every required security regression test file on disk", () => {
    const missing = SECURITY_REGRESSION_TEST_FILES.filter(
      (rel) => !existsSync(join(REPO_ROOT, rel)),
    );
    expect(missing, `missing security tests:\n${missing.join("\n")}`).toEqual([]);
  });

  it("package.json pnpm overrides keep documented security floors", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const [name, floor] of Object.entries(REQUIRED_PNPM_OVERRIDE_FLOORS)) {
      const override = packageJson.pnpm.overrides[name];
      expect(override, `expected pnpm override for ${name}`).toBeTruthy();
      expect(override).toMatch(new RegExp(`>=${floor.replace(".", "\\.")}|\\^${floor}`));
    }
  });
});
