/**
 * Traceability for security / supply-chain regression guardrails added on
 * fix/security-alerts-oct26. When adding a new CVE pin or Docker hardening test,
 * register it here so it cannot be deleted without updating this map.
 */
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECURE_ADM_ZIP_VERSION } from "../../scripts/adm-zip-security-lib.mjs";
import { SECURE_IP_ADDRESS_VERSION } from "../../scripts/ip-address-security-lib.mjs";

const ROOT = process.cwd();

/** Vitest modules that pin dependency, script, or image security floors. */
export const SECURITY_REGRESSION_TEST_FILES = [
  "tests/scripts/cve-dependency-pins.test.ts",
  "tests/scripts/http-framework-security-pins.test.ts",
  "tests/scripts/adm-zip-dependency-pins.test.ts",
  "tests/scripts/adm-zip-security-lib.test.ts",
  "tests/scripts/ip-address-security-lib.test.ts",
  "tests/docker/production-dockerfile.test.ts",
  "tests/scripts/npm-adm-zip-consumer-wiring.test.ts",
] as const;

const PNPM_OVERRIDE_FLOORS: Readonly<Record<string, string>> = {
  "body-parser": ">=2.4.0",
  zod: ">=4.6.6",
  "fast-uri": ">=4.2.3",
  "ip-address": `>=${SECURE_IP_ADDRESS_VERSION}`,
  hono: ">=4.13.11",
  "@hono/node-server": ">=2.0.10",
  vite: "^7.3.7",
  "adm-zip": `>=${SECURE_ADM_ZIP_VERSION}`,
  "proxy-addr": ">=2.0.8",
  "path-to-regexp": ">=8.4.0",
};

describe("Security regression map", () => {
  it("every registered security guardrail test file exists", () => {
    const missing = SECURITY_REGRESSION_TEST_FILES.filter((rel) => !existsSync(join(ROOT, rel)));
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("keeps pnpm override floors for patched transitive dependencies", () => {
    const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const [name, floor] of Object.entries(PNPM_OVERRIDE_FLOORS)) {
      expect(packageJson.pnpm.overrides[name], `pnpm.overrides["${name}"]`).toBe(floor);
    }
  });

  it("documents postinstall adm-zip enforcement in package scripts", () => {
    const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts.postinstall).toContain("ensure-secure-adm-zip.mjs");
  });
});
