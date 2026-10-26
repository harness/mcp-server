import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";
import {
  meetsVersionFloor,
  parseNpmShrinkwrapPackageVersions,
  parsePnpmLockPackageVersions,
} from "./security-version-floor.js";

const root = process.cwd();

const FAST_URI_FLOOR = "4.2.3";
const ADM_ZIP_FLOOR = "0.6.1";

describe("Additional CVE dependency pins — fast-uri and adm-zip (#1154)", () => {
  it("keeps pnpm overrides at patched floors", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const overrides = packageJson.pnpm?.overrides ?? {};
    expect(overrides["fast-uri"]).toBe(`>=${FAST_URI_FLOOR}`);
    expect(overrides["adm-zip"]).toBe(`>=${ADM_ZIP_FLOOR}`);
  });

  it("resolves fast-uri and adm-zip at or above the security floor in pnpm-lock.yaml", () => {
    const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const fastUriVersions = parsePnpmLockPackageVersions(lock, "fast-uri");
    const admZipVersions = parsePnpmLockPackageVersions(lock, "adm-zip");
    expect(fastUriVersions.length).toBeGreaterThan(0);
    expect(admZipVersions.length).toBeGreaterThan(0);
    for (const version of fastUriVersions) {
      expect(meetsVersionFloor(version, FAST_URI_FLOOR), `fast-uri@${version}`).toBe(true);
    }
    for (const version of admZipVersions) {
      expect(meetsVersionFloor(version, ADM_ZIP_FLOOR), `adm-zip@${version}`).toBe(true);
    }
  });

  it("pins npm overrides for nested onnxruntime-node adm-zip copies", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.overrides?.["onnxruntime-node"]).toEqual({ "adm-zip": ADM_ZIP_FLOOR });
  });

  it("runs adm-zip postinstall hardening after every pnpm install", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.scripts?.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
  });

  it("keeps npm-shrinkwrap adm-zip and fast-uri installs on patched releases", () => {
    const shrinkwrap = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const admZipVersions = parseNpmShrinkwrapPackageVersions(shrinkwrap, "adm-zip");
    const fastUriVersions = parseNpmShrinkwrapPackageVersions(shrinkwrap, "fast-uri");
    expect(admZipVersions.length).toBeGreaterThan(0);
    expect(fastUriVersions.length).toBeGreaterThan(0);
    for (const version of admZipVersions) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION), `adm-zip@${version}`).toBe(
        true,
      );
    }
    for (const version of fastUriVersions) {
      expect(meetsVersionFloor(version, FAST_URI_FLOOR), `fast-uri@${version}`).toBe(true);
    }
  });
});
