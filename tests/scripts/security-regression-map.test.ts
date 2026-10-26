/**
 * Maps security-hardening guardrails to on-disk regression tests.
 * Prevents accidental removal of CVE / supply-chain checks without updating this map.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Risk area → test files that enforce it (paths repo-relative). */
export const SECURITY_REGRESSION_MAP: Record<string, readonly string[]> = {
  "Direct CVE dependency pins (body-parser, zod, fast-uri, ip-address)": [
    "tests/scripts/cve-dependency-pins.test.ts",
  ],
  "Transitive pnpm overrides (Express, OTel, Vite, media, toolchain)": [
    "tests/scripts/transitive-security-pins.test.ts",
  ],
  "HTTP framework pins (hono, @hono/node-server, vite)": ["tests/scripts/http-framework-security-pins.test.ts"],
  "ip-address install graph and NAT64 runtime behavior": ["tests/scripts/ip-address-security-lib.test.ts"],
  "adm-zip postinstall hardening and symlink extraction": ["tests/scripts/adm-zip-security-lib.test.ts"],
  "npm-shrinkwrap --check (global npm install contract)": ["tests/scripts/npm-shrinkwrap-check.test.ts"],
  "Production Dockerfile Debian/OpenSSL floors": ["tests/docker/production-dockerfile.test.ts"],
  "Dockerfile adm-zip script COPY ordering before pnpm install": ["tests/docker/dockerfile-adm-zip-stages.test.ts"],
  "Published npm bundle documents secure adm-zip": ["tests/release-metadata.test.ts"],
};

function assertGuardFilesExist(area: string, files: readonly string[]): void {
  const missing = files.filter((f) => !existsSync(join(REPO_ROOT, f)));
  expect(missing, `${area}: missing guard file(s):\n${missing.join("\n")}`).toEqual([]);
}

describe("Security regression — enforcement map", () => {
  it("documents every mapped area with at least one guard test file", () => {
    for (const files of Object.values(SECURITY_REGRESSION_MAP)) {
      expect(files.length).toBeGreaterThan(0);
    }
    expect(Object.keys(SECURITY_REGRESSION_MAP).length).toBeGreaterThanOrEqual(8);
  });

  for (const [area, files] of Object.entries(SECURITY_REGRESSION_MAP)) {
    it(area, () => {
      assertGuardFilesExist(area, files);
    });
  }
});
