import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

type PinSpec = {
  name: string;
  /** Value in package.json `pnpm.overrides` */
  override: string;
  /** Minimum resolved semver (major.minor.patch) */
  floor: string;
};

const TRANSITIVE_TOOLCHAIN_PINS: PinSpec[] = [
  { name: "picomatch", override: ">=4.0.4", floor: "4.0.4" },
  { name: "path-to-regexp", override: ">=8.4.0", floor: "8.4.0" },
  { name: "express-rate-limit", override: ">=8.2.2", floor: "8.2.2" },
  { name: "nanoid", override: "^3.3.18", floor: "3.3.18" },
  { name: "esbuild", override: ">=0.28.1", floor: "0.28.1" },
  { name: "postcss", override: ">=8.5.18", floor: "8.5.18" },
  { name: "source-map-js", override: ">=1.2.2", floor: "1.2.2" },
  { name: "sharp", override: ">=0.35.5", floor: "0.35.5" },
  { name: "protobufjs", override: ">=8.6.0", floor: "8.6.0" },
  { name: "qs", override: ">=6.16.0", floor: "6.16.0" },
  { name: "proxy-addr", override: ">=2.0.8", floor: "2.0.8" },
  { name: "@opentelemetry/core", override: ">=2.8.0", floor: "2.8.0" },
];

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

type ConsumerPin = {
  /** Path under node_modules/ to a consumer package.json */
  consumer: string;
  dep: string;
  floor: string;
};

/** Runtime paths that must load patched transitive releases (pnpm does not hoist these to the root). */
const CONSUMER_LOADED_PINS: ConsumerPin[] = [
  { consumer: "express/package.json", dep: "qs", floor: "6.16.0" },
  { consumer: "express/package.json", dep: "proxy-addr", floor: "2.0.8" },
  { consumer: "express/package.json", dep: "path-to-regexp", floor: "8.4.0" },
  { consumer: "vite/package.json", dep: "picomatch", floor: "4.0.4" },
  { consumer: "vite/package.json", dep: "esbuild", floor: "0.28.1" },
  { consumer: "vite/package.json", dep: "postcss", floor: "8.5.18" },
  { consumer: "vite/package.json", dep: "source-map-js", floor: "1.2.2" },
  { consumer: "vite/package.json", dep: "nanoid", floor: "3.3.18" },
  {
    consumer: "@modelcontextprotocol/sdk/package.json",
    dep: "express-rate-limit",
    floor: "8.2.2",
  },
  {
    consumer: "@opentelemetry/sdk-trace-node/package.json",
    dep: "@opentelemetry/core",
    floor: "2.8.0",
  },
  { consumer: "@huggingface/transformers/package.json", dep: "sharp", floor: "0.35.5" },
  { consumer: "@huggingface/transformers/package.json", dep: "protobufjs", floor: "8.6.0" },
];

function readPackageVersionFromResolvedEntry(resolvedEntry: string): string {
  let dir = dirname(resolvedEntry);
  while (dir !== dirname(dir)) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      const manifest = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (manifest.name && typeof manifest.version === "string") {
        return manifest.version;
      }
    }
    dir = dirname(dir);
  }
  throw new Error(`could not locate package.json for ${resolvedEntry}`);
}

function readConsumerDependencyVersion(consumer: string, dep: string): string {
  const consumerPath = join(root, "node_modules", consumer);
  const req = createRequire(consumerPath);
  const resolved = req.resolve(dep);
  return readPackageVersionFromResolvedEntry(resolved);
}

function assertAllAtLeastFloor(versions: string[], floor: string, label: string): void {
  expect(versions.length, `expected ${label} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
  for (const version of versions) {
    expect(isSecureIpAddressVersion(version, floor)).toBe(true);
  }
}

describe("Transitive toolchain security pins (build + Express stack)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, override } of TRANSITIVE_TOOLCHAIN_PINS) {
      expect(packageJson.pnpm.overrides[name], `pnpm.overrides.${name}`).toBe(override);
    }
  });

  it("resolves only patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of TRANSITIVE_TOOLCHAIN_PINS) {
      assertAllAtLeastFloor(parsePnpmLockPackageVersions(lockText, name), floor, name);
    }
  });

  it("loads patched transitive copies on representative runtime dependency paths", () => {
    for (const { consumer, dep, floor } of CONSUMER_LOADED_PINS) {
      const version = readConsumerDependencyVersion(consumer, dep);
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });
});
