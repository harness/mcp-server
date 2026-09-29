import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findIpAddressInstallDirs,
  isSecureIpAddressVersion,
  listInsecureIpAddressInstalls,
  parseNpmShrinkwrapIpAddressVersion,
  parsePnpmLockIpAddressVersions,
  SECURE_IP_ADDRESS_VERSION,
} from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadInstalledAddress6() {
  const installs = findIpAddressInstallDirs(root);
  expect(installs.length, "expected ip-address under node_modules").toBeGreaterThan(0);

  return require(installs[0]) as {
    Address6: new (address: string) => {
      isPrivate(): boolean;
      isGlobal(): boolean;
      isLoopback(): boolean;
    };
  };
}

describe("ip-address-security-lib", () => {
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
