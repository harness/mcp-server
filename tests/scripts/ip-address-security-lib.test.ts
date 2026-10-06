import { createRequire } from "node:module";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findActiveIpAddressInstallDirs,
  findIpAddressInstallDirs,
  isSecureIpAddressVersion,
  listInsecureIpAddressInstalls,
  parseNpmShrinkwrapIpAddressVersion,
  parsePnpmLockIpAddressVersions,
  readIpAddressVersion,
  resolveActiveIpAddressDir,
  SECURE_IP_ADDRESS_VERSION,
} from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadInstalledAddress6() {
  const dir = resolveActiveIpAddressDir(root);
  expect(dir, "expected a linked ip-address install under node_modules").toBeTruthy();

  const version = readIpAddressVersion(dir!);
  const loaded = require(dir!) as {
    Address6: new (address: string) => {
      isPrivate(): boolean;
      isGlobal(): boolean;
      isLoopback(): boolean;
    };
  };
  const probe = new loaded.Address6("::1");
  expect(
    typeof probe.isGlobal,
    `ip-address@${version ?? "unknown"} has no isGlobal(); run pnpm install so the lockfile's ${SECURE_IP_ADDRESS_VERSION}+ copy is linked`,
  ).toBe("function");
  return loaded;
}

function writeIpAddressPackage(dir: string, version: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "ip-address", version }));
}

describe("ip-address-security-lib", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("compares semver patch levels for the NAT64 security floor", () => {
    expect(isSecureIpAddressVersion("10.4.0", SECURE_IP_ADDRESS_VERSION)).toBe(false);
    expect(isSecureIpAddressVersion("10.5.0", SECURE_IP_ADDRESS_VERSION)).toBe(false);
    expect(isSecureIpAddressVersion("10.5.1", SECURE_IP_ADDRESS_VERSION)).toBe(true);
    expect(isSecureIpAddressVersion("10.7.2", SECURE_IP_ADDRESS_VERSION)).toBe(true);
  });

  it("treats missing or invalid versions as insecure", () => {
    expect(isSecureIpAddressVersion(null, SECURE_IP_ADDRESS_VERSION)).toBe(false);
    expect(isSecureIpAddressVersion("", SECURE_IP_ADDRESS_VERSION)).toBe(false);
    expect(isSecureIpAddressVersion("not-a-version", SECURE_IP_ADDRESS_VERSION)).toBe(false);
  });

  it("keeps pnpm overrides and lockfile on a patched ip-address release", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.pnpm.overrides["ip-address"]).toBe(`>=${SECURE_IP_ADDRESS_VERSION}`);

    const lockVersions = parsePnpmLockIpAddressVersions(readFileSync(join(root, "pnpm-lock.yaml"), "utf8"));
    expect(lockVersions.length).toBeGreaterThan(0);
    for (const version of lockVersions) {
      expect(isSecureIpAddressVersion(version, SECURE_IP_ADDRESS_VERSION)).toBe(true);
    }
  });

  it("keeps npm-shrinkwrap on a patched ip-address release", () => {
    const shrinkwrapVersion = parseNpmShrinkwrapIpAddressVersion(
      readFileSync(join(root, "npm-shrinkwrap.json"), "utf8"),
    );
    expect(shrinkwrapVersion).not.toBeNull();
    expect(isSecureIpAddressVersion(shrinkwrapVersion, SECURE_IP_ADDRESS_VERSION)).toBe(true);
  });

  it("flags vulnerable ip-address installs under node_modules", () => {
    expect(listInsecureIpAddressInstalls(root)).toEqual([]);
  });

  it("ignores an unlinked pnpm virtual-store leftover", () => {
    if (process.platform === "win32") {
      return;
    }

    const packageRoot = mkdtempSync(join(tmpdir(), "ip-address-orphan-"));
    tempDirs.push(packageRoot);
    writeIpAddressPackage(
      join(packageRoot, "node_modules/.pnpm/ip-address@10.4.0/node_modules/ip-address"),
      "10.4.0",
    );
    const current = join(packageRoot, "node_modules/.pnpm/ip-address@10.7.2/node_modules/ip-address");
    writeIpAddressPackage(current, "10.7.2");
    const linkDir = join(packageRoot, "node_modules/.pnpm/express-rate-limit@8.3.2/node_modules");
    mkdirSync(linkDir, { recursive: true });
    symlinkSync("../../ip-address@10.7.2/node_modules/ip-address", join(linkDir, "ip-address"), "dir");

    expect(findIpAddressInstallDirs(packageRoot)).toHaveLength(2);
    expect(findActiveIpAddressInstallDirs(packageRoot)).toEqual([current]);
    expect(listInsecureIpAddressInstalls(packageRoot)).toEqual([]);
    expect(resolveActiveIpAddressDir(packageRoot)).toBe(current);
  });

  it("still flags a linked vulnerable ip-address install", () => {
    if (process.platform === "win32") {
      return;
    }

    const packageRoot = mkdtempSync(join(tmpdir(), "ip-address-linked-"));
    tempDirs.push(packageRoot);
    const vulnerable = join(packageRoot, "node_modules/.pnpm/ip-address@10.4.0/node_modules/ip-address");
    writeIpAddressPackage(vulnerable, "10.4.0");
    const linkDir = join(packageRoot, "node_modules/.pnpm/express-rate-limit@8.3.2/node_modules");
    mkdirSync(linkDir, { recursive: true });
    symlinkSync("../../ip-address@10.4.0/node_modules/ip-address", join(linkDir, "ip-address"), "dir");

    expect(listInsecureIpAddressInstalls(packageRoot)).toEqual([
      { dir: vulnerable, version: "10.4.0" },
    ]);
    expect(resolveActiveIpAddressDir(packageRoot)).toBe(vulnerable);
  });

  it("still flags a real nested install outside the pnpm virtual store", () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "ip-address-nested-"));
    tempDirs.push(packageRoot);
    const nested = join(packageRoot, "node_modules/some-pkg/node_modules/ip-address");
    writeIpAddressPackage(nested, "10.4.0");

    expect(listInsecureIpAddressInstalls(packageRoot)).toEqual([
      { dir: nested, version: "10.4.0" },
    ]);
  });

  it("returns null when no ip-address install exists", () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "ip-address-empty-"));
    tempDirs.push(packageRoot);
    mkdirSync(join(packageRoot, "node_modules"), { recursive: true });

    expect(findActiveIpAddressInstallDirs(packageRoot)).toEqual([]);
    expect(resolveActiveIpAddressDir(packageRoot)).toBeNull();
    expect(listInsecureIpAddressInstalls(packageRoot)).toEqual([]);
  });

  it("prefers a secure active install when express-rate-limit does not link ip-address", () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "ip-address-secure-fallback-"));
    tempDirs.push(packageRoot);
    const vulnerable = join(packageRoot, "node_modules/pkg-a/node_modules/ip-address");
    const patched = join(packageRoot, "node_modules/pkg-b/node_modules/ip-address");
    writeIpAddressPackage(vulnerable, "10.4.0");
    writeIpAddressPackage(patched, "10.7.2");

    expect(findActiveIpAddressInstallDirs(packageRoot).sort()).toEqual([vulnerable, patched].sort());
    expect(listInsecureIpAddressInstalls(packageRoot)).toEqual([{ dir: vulnerable, version: "10.4.0" }]);
    expect(resolveActiveIpAddressDir(packageRoot)).toBe(patched);
  });

  it("prefers the express-rate-limit linked copy over another secure install", () => {
    if (process.platform === "win32") {
      return;
    }

    const packageRoot = mkdtempSync(join(tmpdir(), "ip-address-erl-pref-"));
    tempDirs.push(packageRoot);
    const erlLinked = join(packageRoot, "node_modules/.pnpm/ip-address@10.5.1/node_modules/ip-address");
    const otherSecure = join(packageRoot, "node_modules/.pnpm/ip-address@10.7.2/node_modules/ip-address");
    writeIpAddressPackage(erlLinked, "10.5.1");
    writeIpAddressPackage(otherSecure, "10.7.2");

    const erlModules = join(packageRoot, "node_modules/.pnpm/express-rate-limit@8.3.2/node_modules");
    const otherModules = join(packageRoot, "node_modules/.pnpm/other-pkg@1.0.0/node_modules");
    mkdirSync(erlModules, { recursive: true });
    mkdirSync(otherModules, { recursive: true });
    symlinkSync("../../ip-address@10.5.1/node_modules/ip-address", join(erlModules, "ip-address"), "dir");
    symlinkSync("../../ip-address@10.7.2/node_modules/ip-address", join(otherModules, "ip-address"), "dir");

    expect(listInsecureIpAddressInstalls(packageRoot)).toEqual([]);
    expect(resolveActiveIpAddressDir(packageRoot)).toBe(erlLinked);
  });

  it("classifies RFC 8215 NAT64 local-use addresses as non-global private space", () => {
    const { Address6 } = loadInstalledAddress6();

    const localUse = new Address6("64:ff9b:1::1");
    expect(localUse.isPrivate()).toBe(true);
    expect(localUse.isGlobal()).toBe(false);

    const outsideLocalUse = new Address6("64:ff9b:2::1");
    expect(outsideLocalUse.isPrivate()).toBe(false);
  });

  it("still classifies embedded loopback in the well-known NAT64 prefix", () => {
    const { Address6 } = loadInstalledAddress6();

    const nat64Loopback = new Address6("64:ff9b::7f00:1");
    expect(nat64Loopback.isLoopback()).toBe(true);
    expect(nat64Loopback.isGlobal()).toBe(false);
  });

  it("keeps public IPv6 controls non-private", () => {
    const { Address6 } = loadInstalledAddress6();

    const documentation = new Address6("2001:db8::1");
    expect(documentation.isPrivate()).toBe(false);
    expect(documentation.isGlobal()).toBe(false);
  });
});
