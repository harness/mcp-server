import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import { parsePnpmLockPackageVersions } from "./lockfile-parsers.js";

const root = process.cwd();

/** Vite / bundler transitive floors — regressions here re-open upstream CVE advisories. */
const SECURE_PICOMATCH_VERSION = "4.0.4";
const SECURE_NANOID_VERSION = "3.3.18";
const SECURE_ESBUILD_VERSION = "0.28.1";
const SECURE_POSTCSS_VERSION = "8.5.18";
const SECURE_SOURCE_MAP_JS_VERSION = "1.2.2";

const SECURE_SHARP_VERSION = "0.35.5";
const SECURE_PROTOBUFJS_VERSION = "8.6.0";
const SECURE_OTEL_CORE_VERSION = "2.8.0";

function assertAllAtLeastFloor(versions: string[], floor: string, label: string): void {
  expect(versions.length, `expected ${label} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
  for (const version of versions) {
    expect(isSecureIpAddressVersion(version, floor), `${label}: ${version} < ${floor}`).toBe(true);
  }
}

describe("Transitive toolchain security pins (picomatch, nanoid, esbuild, postcss, source-map-js)", () => {
  const toolchainPackages: Array<{ name: string; floor: string; override: string }> = [
    { name: "picomatch", floor: SECURE_PICOMATCH_VERSION, override: `>=${SECURE_PICOMATCH_VERSION}` },
    { name: "nanoid", floor: SECURE_NANOID_VERSION, override: `^${SECURE_NANOID_VERSION}` },
    { name: "esbuild", floor: SECURE_ESBUILD_VERSION, override: `>=${SECURE_ESBUILD_VERSION}` },
    { name: "postcss", floor: SECURE_POSTCSS_VERSION, override: `>=${SECURE_POSTCSS_VERSION}` },
    {
      name: "source-map-js",
      floor: SECURE_SOURCE_MAP_JS_VERSION,
      override: `>=${SECURE_SOURCE_MAP_JS_VERSION}`,
    },
  ];

  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, override } of toolchainPackages) {
      expect(packageJson.pnpm.overrides[name]).toBe(override);
    }
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of toolchainPackages) {
      assertAllAtLeastFloor(parsePnpmLockPackageVersions(lockText, name), floor, name);
    }
  });
});

describe("Optional and telemetry security pins (sharp, protobufjs, @opentelemetry/core)", () => {
  const nativePackages: Array<{ name: string; floor: string; override: string }> = [
    { name: "sharp", floor: SECURE_SHARP_VERSION, override: `>=${SECURE_SHARP_VERSION}` },
    { name: "protobufjs", floor: SECURE_PROTOBUFJS_VERSION, override: `>=${SECURE_PROTOBUFJS_VERSION}` },
    {
      name: "@opentelemetry/core",
      floor: SECURE_OTEL_CORE_VERSION,
      override: `>=${SECURE_OTEL_CORE_VERSION}`,
    },
  ];

  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, override } of nativePackages) {
      expect(packageJson.pnpm.overrides[name]).toBe(override);
    }
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of nativePackages) {
      assertAllAtLeastFloor(parsePnpmLockPackageVersions(lockText, name), floor, name);
    }
  });
});
