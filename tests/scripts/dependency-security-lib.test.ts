import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isAtLeastSemver,
  listInstallsBelowVersion,
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
  pnpmLockContainsPackage,
  SECURE_FAST_URI_VERSION,
  SECURE_PROXY_ADDR_VERSION,
  SECURE_SOURCE_MAP_JS_VERSION,
  SECURE_TRANSFORMERS_VERSION,
} from "../../scripts/dependency-security-lib.mjs";

const root = process.cwd();

describe("dependency-security-lib (alerts 94–97)", () => {
  it("compares semver patch levels for security floors", () => {
    expect(isAtLeastSemver("4.1.4", SECURE_FAST_URI_VERSION)).toBe(false);
    expect(isAtLeastSemver("4.1.5", SECURE_FAST_URI_VERSION)).toBe(true);
    expect(isAtLeastSemver("4.2.1", SECURE_FAST_URI_VERSION)).toBe(true);

    expect(isAtLeastSemver("1.2.1", SECURE_SOURCE_MAP_JS_VERSION)).toBe(false);
    expect(isAtLeastSemver("1.2.2", SECURE_SOURCE_MAP_JS_VERSION)).toBe(true);

    expect(isAtLeastSemver("4.2.0", SECURE_TRANSFORMERS_VERSION)).toBe(false);
    expect(isAtLeastSemver("4.3.0", SECURE_TRANSFORMERS_VERSION)).toBe(true);

    expect(isAtLeastSemver("2.0.7", SECURE_PROXY_ADDR_VERSION)).toBe(false);
    expect(isAtLeastSemver("2.0.8", SECURE_PROXY_ADDR_VERSION)).toBe(true);
  });

  it("treats missing or invalid versions as below the floor", () => {
    expect(isAtLeastSemver(null, SECURE_FAST_URI_VERSION)).toBe(false);
    expect(isAtLeastSemver("", SECURE_FAST_URI_VERSION)).toBe(false);
    expect(isAtLeastSemver("not-a-version", SECURE_FAST_URI_VERSION)).toBe(false);
  });

  it("keeps pnpm overrides and lockfile on patched fast-uri, source-map-js, and proxy-addr", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.pnpm.overrides["fast-uri"]).toBe(`>=${SECURE_FAST_URI_VERSION}`);
    expect(packageJson.pnpm.overrides["source-map-js"]).toBe(`>=${SECURE_SOURCE_MAP_JS_VERSION}`);
    expect(packageJson.pnpm.overrides["proxy-addr"]).toBe(`>=${SECURE_PROXY_ADDR_VERSION}`);

    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    for (const version of parsePnpmLockPackageVersions(lockText, "fast-uri")) {
      expect(isAtLeastSemver(version, SECURE_FAST_URI_VERSION)).toBe(true);
    }
    for (const version of parsePnpmLockPackageVersions(lockText, "source-map-js")) {
      expect(isAtLeastSemver(version, SECURE_SOURCE_MAP_JS_VERSION)).toBe(true);
    }
    for (const version of parsePnpmLockPackageVersions(lockText, "proxy-addr")) {
      expect(isAtLeastSemver(version, SECURE_PROXY_ADDR_VERSION)).toBe(true);
    }
  });

  it("pins optional @huggingface/transformers at or above the sprintf-js fix", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.optionalDependencies["@huggingface/transformers"]).toBe(
      `^${SECURE_TRANSFORMERS_VERSION}`,
    );

    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lockText, "@huggingface/transformers");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(isAtLeastSemver(version, SECURE_TRANSFORMERS_VERSION)).toBe(true);
    }
  });

  it("does not pull sprintf-js into the pnpm lockfile", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    expect(pnpmLockContainsPackage(lockText, "sprintf-js")).toBe(false);
  });

  it("keeps npm-shrinkwrap on patched fast-uri and transformers releases", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const fastUri = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "fast-uri");
    expect(fastUri).not.toBeNull();
    expect(isAtLeastSemver(fastUri, SECURE_FAST_URI_VERSION)).toBe(true);

    const transformers = parseNpmShrinkwrapPackageVersion(
      shrinkwrapText,
      "@huggingface/transformers",
    );
    expect(transformers).not.toBeNull();
    expect(isAtLeastSemver(transformers, SECURE_TRANSFORMERS_VERSION)).toBe(true);
  });

  it("flags vulnerable fast-uri, source-map-js, and proxy-addr installs under node_modules", () => {
    expect(listInstallsBelowVersion(root, "fast-uri", SECURE_FAST_URI_VERSION)).toEqual([]);
    expect(listInstallsBelowVersion(root, "source-map-js", SECURE_SOURCE_MAP_JS_VERSION)).toEqual(
      [],
    );
    expect(listInstallsBelowVersion(root, "proxy-addr", SECURE_PROXY_ADDR_VERSION)).toEqual([]);
  });
});
