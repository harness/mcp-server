import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECURE_ADM_ZIP_VERSION } from "../../scripts/adm-zip-security-lib.mjs";
import {
  meetsVersionFloor,
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./security-version-floor.js";

const root = process.cwd();

describe("adm-zip dependency pins (onnxruntime-node transitive + postinstall)", () => {
  it("keeps pnpm and npm overrides at the patched floor", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.pnpm?.overrides?.["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.overrides?.["onnxruntime-node"]?.["adm-zip"]).toBe(SECURE_ADM_ZIP_VERSION);
  });

  it("runs ensure-secure-adm-zip on postinstall", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.scripts?.postinstall).toContain("ensure-secure-adm-zip.mjs");
  });

  it("resolves adm-zip at or above the floor in pnpm-lock.yaml", () => {
    const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lock, "adm-zip");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(meetsVersionFloor(version, SECURE_ADM_ZIP_VERSION), `adm-zip@${version}`).toBe(true);
    }
  });

  it("pins adm-zip in npm-shrinkwrap for MCPB / npm consumers", () => {
    const shrinkwrap = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrap, "adm-zip");
    expect(version).not.toBeNull();
    expect(meetsVersionFloor(version!, SECURE_ADM_ZIP_VERSION)).toBe(true);
  });
});
