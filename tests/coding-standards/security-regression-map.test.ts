/**
 * Inventory of security regression guards — prevents silent removal of CVE/Docker
 * pin tests when dependency bumps land without updating coverage.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

const SECURITY_GUARD_MODULES = [
  "tests/docker/production-dockerfile.test.ts",
  "tests/scripts/cve-dependency-pins.test.ts",
  "tests/scripts/http-framework-security-pins.test.ts",
  "tests/scripts/adm-zip-security-lib.test.ts",
  "tests/scripts/ip-address-security-lib.test.ts",
  "tests/scripts/transitive-toolchain-security-pins.test.ts",
] as const;

/** Keys in pnpm.overrides that must be asserted in at least one guard module source. */
const OVERRIDE_KEYS_COVERED_BY_GUARDS = [
  "adm-zip",
  "body-parser",
  "zod",
  "fast-uri",
  "ip-address",
  "express-rate-limit",
  "qs",
  "proxy-addr",
  "hono",
  "@hono/node-server",
  "vite",
  "picomatch",
  "nanoid",
  "esbuild",
  "postcss",
  "source-map-js",
  "path-to-regexp",
  "sharp",
  "protobufjs",
] as const;

const SECURITY_SCRIPTS = [
  "scripts/adm-zip-security-lib.mjs",
  "scripts/ensure-secure-adm-zip.mjs",
  "scripts/ip-address-security-lib.mjs",
] as const;

/** Published npm tarball includes adm-zip postinstall helpers only (ip-address lib is repo-local). */
const NPM_PACKAGED_SECURITY_SCRIPTS = [
  "scripts/adm-zip-security-lib.mjs",
  "scripts/ensure-secure-adm-zip.mjs",
] as const;

describe("Coding standards — security regression guard map", () => {
  it("keeps Dockerfile and dependency guard test modules on disk", () => {
    const missing = SECURITY_GUARD_MODULES.filter((rel) => !existsSync(join(REPO_ROOT, rel)));
    expect(missing, `missing guard modules:\n${missing.join("\n")}`).toEqual([]);
  });

  it("keeps postinstall security scripts referenced by package.json", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      files: string[];
      scripts: { postinstall?: string };
    };
    expect(packageJson.scripts.postinstall).toContain("ensure-secure-adm-zip.mjs");
    for (const rel of SECURITY_SCRIPTS) {
      expect(existsSync(join(REPO_ROOT, rel)), rel).toBe(true);
    }
    for (const rel of NPM_PACKAGED_SECURITY_SCRIPTS) {
      expect(packageJson.files, rel).toContain(rel);
    }
  });

  it("documents every security-critical pnpm override in a guard module", () => {
    const guardSources = SECURITY_GUARD_MODULES.map((rel) =>
      readFileSync(join(REPO_ROOT, rel), "utf8"),
    ).join("\n");

    const missing: string[] = [];
    for (const key of OVERRIDE_KEYS_COVERED_BY_GUARDS) {
      const needle = key.includes("/") ? `"${key}"` : key;
      if (!guardSources.includes(needle)) {
        missing.push(key);
      }
    }
    expect(missing, `override keys not referenced in guard tests:\n${missing.join("\n")}`).toEqual([]);
  });
});
