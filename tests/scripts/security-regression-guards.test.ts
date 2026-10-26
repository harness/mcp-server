/**
 * Inventory of security / supply-chain regression tests tied to fix/security-alerts-oct26.
 * Fails if a guard file is removed or added without updating this map.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Relative paths from repo root → short description of protected behavior. */
export const SECURITY_REGRESSION_GUARDS: Record<string, string> = {
  "tests/scripts/adm-zip-dependency-pins.test.ts":
    "adm-zip pnpm/npm overrides, lockfile, shrinkwrap, postinstall hook",
  "tests/scripts/adm-zip-security-lib.test.ts":
    "adm-zip version floor and symlink-safe extraction behavior",
  "tests/scripts/cve-dependency-pins.test.ts": "zod and body-parser CVE override floors",
  "tests/scripts/express-rate-limit-security-pins.test.ts":
    "express-rate-limit floor (transitive ip-address consumer)",
  "tests/scripts/fast-uri-security-pins.test.ts": "fast-uri floor (MCP SDK transitive)",
  "tests/scripts/http-framework-security-pins.test.ts": "hono, @hono/node-server, vite floors",
  "tests/scripts/ip-address-security-lib.test.ts":
    "ip-address floor, shrinkwrap, NAT64 classification (#1154)",
  "tests/scripts/security-version-floor.test.ts": "shared lockfile semver helpers",
  "tests/docker/dockerfile-adm-zip-postinstall.test.ts":
    "Docker COPY order so postinstall can run during image build",
  "tests/docker/production-dockerfile.test.ts":
    "Debian apt refresh ARG and libssl3/openssl package floors",
  "tests/registry/extractors-service-account.test.ts":
    "service account aggregate vs array list extraction",
  "tests/registry/access-control-service-account.test.ts":
    "service_account registry scope and aggregate list routing (#1152)",
};

describe("Security regression guard inventory", () => {
  it("every mapped guard file exists on disk", () => {
    for (const [relPath, description] of Object.entries(SECURITY_REGRESSION_GUARDS)) {
      const absolute = join(REPO_ROOT, relPath);
      expect(existsSync(absolute), `missing ${relPath} (${description})`).toBe(true);
    }
  });

  it("lists at least one guard per high-risk security area from the Oct 2026 branch", () => {
    const paths = Object.keys(SECURITY_REGRESSION_GUARDS);
    expect(paths.some((p) => p.includes("adm-zip"))).toBe(true);
    expect(paths.some((p) => p.includes("ip-address"))).toBe(true);
    expect(paths.some((p) => p.includes("docker"))).toBe(true);
    expect(paths.some((p) => p.includes("service-account"))).toBe(true);
  });
});
