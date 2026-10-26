import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

/** Semantic-search / OTEL transitive floors from the Oct 2026 security refresh. */
const SECURE_SHARP_VERSION = "0.35.5";
const SECURE_PROTOBUFJS_VERSION = "8.6.0";
const SECURE_OPENTELEMETRY_CORE_VERSION = "2.8.0";

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const unscopedPattern = new RegExp(`^\\s+${packageName}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  for (const match of lockfileText.matchAll(unscopedPattern)) {
    versions.add(match[1]);
  }

  if (packageName.includes("/")) {
    const scopedPattern = new RegExp(
      `'${packageName.replace("/", "\\/")}@([0-9]+\\.[0-9]+\\.[0-9]+)':`,
      "g",
    );
    for (const match of lockfileText.matchAll(scopedPattern)) {
      versions.add(match[1]);
    }
  }

  return [...versions];
}

function assertAllAtLeastFloor(versions: string[], floor: string, label: string): void {
  expect(versions.length, `expected ${label} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
  for (const version of versions) {
    expect(isSecureIpAddressVersion(version, floor)).toBe(true);
  }
}

describe("Transitive media and telemetry security pins (sharp, protobufjs, @opentelemetry/core)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides.sharp).toBe(`>=${SECURE_SHARP_VERSION}`);
    expect(packageJson.pnpm.overrides.protobufjs).toBe(`>=${SECURE_PROTOBUFJS_VERSION}`);
    expect(packageJson.pnpm.overrides["@opentelemetry/core"]).toBe(`>=${SECURE_OPENTELEMETRY_CORE_VERSION}`);
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "sharp", floor: SECURE_SHARP_VERSION },
      { name: "protobufjs", floor: SECURE_PROTOBUFJS_VERSION },
      { name: "@opentelemetry/core", floor: SECURE_OPENTELEMETRY_CORE_VERSION },
    ];

    for (const { name, floor } of checks) {
      assertAllAtLeastFloor(parsePnpmLockPackageVersions(lockText, name), floor, name);
    }
  });
});
