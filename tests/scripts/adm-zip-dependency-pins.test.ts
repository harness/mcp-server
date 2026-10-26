import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECURE_ADM_ZIP_VERSION } from "../../scripts/adm-zip-security-lib.mjs";
import {
  meetsVersionFloor,
  parsePnpmLockPackageVersions,
} from "./security-version-floor.js";

const root = process.cwd();

describe("CVE dependency pins — adm-zip (onnxruntime transitive)", () => {
  it("keeps pnpm overrides and npm overrides on the patched adm-zip floor", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const pnpmOverrides = packageJson.pnpm?.overrides ?? {};
    const npmOverrides = packageJson.overrides ?? {};
    expect(pnpmOverrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(npmOverrides["onnxruntime-node"]?.["adm-zip"]).toBe(SECURE_ADM_ZIP_VERSION);
  });

  it("resolves adm-zip at or above the security floor in pnpm-lock.yaml", () => {
    const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lock, "adm-zip");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(meetsVersionFloor(version, SECURE_ADM_ZIP_VERSION), `adm-zip@${version}`).toBe(true);
    }
  });

  it("documents a patched adm-zip in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrap = JSON.parse(readFileSync(join(root, "npm-shrinkwrap.json"), "utf8"));
    const version =
      shrinkwrap?.packages?.["node_modules/adm-zip"]?.version
      ?? shrinkwrap?.dependencies?.["adm-zip"]?.version;
    expect(typeof version).toBe("string");
    expect(meetsVersionFloor(version as string, SECURE_ADM_ZIP_VERSION)).toBe(true);
  });
});
