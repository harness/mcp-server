import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./pnpm-lock-package-versions.js";

const root = process.cwd();

const SECURE_PICOMATCH_VERSION = "4.0.4";
const SECURE_NANOID_VERSION = "3.3.18";
const SECURE_ESBUILD_VERSION = "0.28.1";
const SECURE_POSTCSS_VERSION = "8.5.18";
const SECURE_SOURCE_MAP_JS_VERSION = "1.2.2";
const SECURE_SHARP_VERSION = "0.35.5";
const SECURE_PROTOBUFJS_VERSION = "8.6.0";
const SECURE_OTEL_CORE_VERSION = "2.8.0";
const SECURE_VITEST_VERSION = "4.1.12";

const LOCKFILE_PINNED_PACKAGES: Array<{ name: string; floor: string }> = [
  { name: "picomatch", floor: SECURE_PICOMATCH_VERSION },
  { name: "nanoid", floor: SECURE_NANOID_VERSION },
  { name: "esbuild", floor: SECURE_ESBUILD_VERSION },
  { name: "postcss", floor: SECURE_POSTCSS_VERSION },
  { name: "source-map-js", floor: SECURE_SOURCE_MAP_JS_VERSION },
  { name: "sharp", floor: SECURE_SHARP_VERSION },
  { name: "protobufjs", floor: SECURE_PROTOBUFJS_VERSION },
  { name: "@opentelemetry/core", floor: SECURE_OTEL_CORE_VERSION },
  { name: "vitest", floor: SECURE_VITEST_VERSION },
];

/** Top-level shrinkwrap entries for runtime/toolchain packages published via npm install -g. */
const SHRINKWRAP_PINNED_PACKAGES: Array<{ name: string; floor: string }> = [
  { name: "sharp", floor: SECURE_SHARP_VERSION },
  { name: "protobufjs", floor: SECURE_PROTOBUFJS_VERSION },
];

describe("Transitive toolchain security pins (build + optional native deps)", () => {
  it("declares patched floors in pnpm overrides and vitest devDependency", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
      devDependencies: Record<string, string>;
    };

    for (const { name, floor } of LOCKFILE_PINNED_PACKAGES) {
      if (name === "vitest") {
        expect(packageJson.devDependencies.vitest).toBe(`^${floor}`);
        continue;
      }
      const override = packageJson.pnpm.overrides[name];
      expect(override, `pnpm override for ${name}`).toBe(
        name === "nanoid" ? `^${floor}` : `>=${floor}`,
      );
    }
  });

  it("resolves patched dependency releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of LOCKFILE_PINNED_PACKAGES) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("documents patched shrinkwrap runtime deps for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");

    for (const { name, floor } of SHRINKWRAP_PINNED_PACKAGES) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expect(isSecureIpAddressVersion(version!, floor)).toBe(true);
    }
  });
});
