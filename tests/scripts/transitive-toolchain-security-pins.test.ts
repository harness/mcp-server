import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import { parsePnpmLockPackageVersions } from "./pnpm-lock-package-versions.js";

const root = process.cwd();

const SECURE_PICOMATCH_VERSION = "4.0.4";
const SECURE_NANOID_VERSION = "3.3.18";
const SECURE_ESBUILD_VERSION = "0.28.1";
const SECURE_POSTCSS_VERSION = "8.5.18";
const SECURE_SOURCE_MAP_JS_VERSION = "1.2.2";
const SECURE_SHARP_VERSION = "0.35.5";
const SECURE_PROTOBUFJS_VERSION = "8.6.0";
const SECURE_OTEL_CORE_VERSION = "2.8.0";

function expectAtLeastFloor(version: string, floor: string, label: string): void {
  expect(isSecureIpAddressVersion(version, floor), `${label}: ${version} < ${floor}`).toBe(true);
}

describe("Transitive toolchain security pins (Vite/esbuild/OTEL/sharp)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides.picomatch).toBe(`>=${SECURE_PICOMATCH_VERSION}`);
    expect(packageJson.pnpm.overrides.nanoid).toBe(`^${SECURE_NANOID_VERSION}`);
    expect(packageJson.pnpm.overrides.esbuild).toBe(`>=${SECURE_ESBUILD_VERSION}`);
    expect(packageJson.pnpm.overrides.postcss).toBe(`>=${SECURE_POSTCSS_VERSION}`);
    expect(packageJson.pnpm.overrides["source-map-js"]).toBe(`>=${SECURE_SOURCE_MAP_JS_VERSION}`);
    expect(packageJson.pnpm.overrides.sharp).toBe(`>=${SECURE_SHARP_VERSION}`);
    expect(packageJson.pnpm.overrides.protobufjs).toBe(`>=${SECURE_PROTOBUFJS_VERSION}`);
    expect(packageJson.pnpm.overrides["@opentelemetry/core"]).toBe(`>=${SECURE_OTEL_CORE_VERSION}`);
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "picomatch", floor: SECURE_PICOMATCH_VERSION },
      { name: "nanoid", floor: SECURE_NANOID_VERSION },
      { name: "esbuild", floor: SECURE_ESBUILD_VERSION },
      { name: "postcss", floor: SECURE_POSTCSS_VERSION },
      { name: "source-map-js", floor: SECURE_SOURCE_MAP_JS_VERSION },
      { name: "sharp", floor: SECURE_SHARP_VERSION },
      { name: "protobufjs", floor: SECURE_PROTOBUFJS_VERSION },
      { name: "@opentelemetry/core", floor: SECURE_OTEL_CORE_VERSION },
    ];

    for (const { name, floor } of checks) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expectAtLeastFloor(version, floor, name);
      }
    }
  });
});
