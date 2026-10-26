import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./lockfile-parsers.js";

const root = process.cwd();

const TRANSITIVE_PIN_FLOORS: Array<{ name: string; floor: string; override: string }> = [
  { name: "picomatch", floor: "4.0.4", override: ">=4.0.4" },
  { name: "nanoid", floor: "3.3.18", override: "^3.3.18" },
  { name: "esbuild", floor: "0.28.1", override: ">=0.28.1" },
  { name: "postcss", floor: "8.5.18", override: ">=8.5.18" },
  { name: "source-map-js", floor: "1.2.2", override: ">=1.2.2" },
  { name: "sharp", floor: "0.35.5", override: ">=0.35.5" },
  { name: "protobufjs", floor: "8.6.0", override: ">=8.6.0" },
  { name: "@opentelemetry/core", floor: "2.8.0", override: ">=2.8.0" },
];

function expectAtLeastFloor(version: string, floor: string, label: string): void {
  expect(isSecureIpAddressVersion(version, floor), `${label}: ${version} < ${floor}`).toBe(true);
}

describe("Transitive security pins (build chain, telemetry, image tooling)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, override } of TRANSITIVE_PIN_FLOORS) {
      expect(packageJson.pnpm.overrides[name], `missing override for ${name}`).toBe(override);
    }
  });

  it("resolves patched transitive deps in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of TRANSITIVE_PIN_FLOORS) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expectAtLeastFloor(version, floor, name);
      }
    }
  });

  it("documents production runtime floors in npm-shrinkwrap.json when the package is bundled", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const shrinkwrapChecks = TRANSITIVE_PIN_FLOORS.filter(({ name }) =>
      ["sharp", "protobufjs"].includes(name),
    );

    for (const { name, floor } of shrinkwrapChecks) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expectAtLeastFloor(version!, floor, name);
    }
  });
});
