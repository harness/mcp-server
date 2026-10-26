import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

function readInstalledPackageVersion(packageName: string): string {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const pattern = new RegExp(`^\\s+${packageName}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]);
  }
  return [...versions];
}

function parseNpmShrinkwrapPackageVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

function listShrinkwrapAdmZipVersions(shrinkwrapText: string): string[] {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const versions: string[] = [];
  for (const [path, entry] of Object.entries(shrinkwrap.packages ?? {})) {
    if (!path.endsWith("/adm-zip") && path !== "node_modules/adm-zip") continue;
    if (typeof entry.version === "string") {
      versions.push(entry.version);
    }
  }
  return versions;
}

describe("adm-zip dependency pins (CVE-2026-39244 / CVE-2026-76845)", () => {
  it("declares patched floors in pnpm overrides, npm parent override, and postinstall", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
      dependencies: Record<string, string>;
      overrides: Record<string, Record<string, string>>;
      scripts: Record<string, string>;
      files: string[];
    };

    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.dependencies["adm-zip"]).toBe(`^${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.overrides["onnxruntime-node"]).toEqual({
      "adm-zip": SECURE_ADM_ZIP_VERSION,
    });
    expect(packageJson.scripts.postinstall).toContain("ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });

  it("includes adm-zip postinstall scripts in the npm pack manifest", () => {
    const pack = spawnSync("npm", ["pack", "--dry-run", "--json", "--silent"], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });
    expect(pack.status, pack.stderr || pack.stdout).toBe(0);

    const manifest = JSON.parse(pack.stdout) as Array<{ files: Array<{ path: string }> }>;
    const paths = manifest[0]?.files.map((entry) => entry.path) ?? [];
    expect(paths).toContain("scripts/adm-zip-security-lib.mjs");
    expect(paths).toContain("scripts/ensure-secure-adm-zip.mjs");
  });

  it("allows skipping postinstall remediation via HARNESS_MCP_SKIP_ADM_ZIP_PATCH", () => {
    const result = spawnSync(process.execPath, [join(root, "scripts/ensure-secure-adm-zip.mjs")], {
      cwd: root,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
    });
    expect(result.status).toBe(0);
  });

  it("resolves patched adm-zip releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lockText, "adm-zip");
    expect(versions.length, "expected adm-zip entries in pnpm-lock.yaml").toBeGreaterThan(0);
    for (const version of versions) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
    }
  });

  it("documents patched adm-zip copies in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const hoisted = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "adm-zip");
    expect(hoisted, "expected hoisted adm-zip in npm-shrinkwrap.json").not.toBeNull();
    expect(isSecureAdmZipVersion(hoisted, SECURE_ADM_ZIP_VERSION)).toBe(true);

    const allAdmZipVersions = listShrinkwrapAdmZipVersions(shrinkwrapText);
    expect(allAdmZipVersions.length, "expected at least one adm-zip entry in shrinkwrap").toBeGreaterThan(
      0,
    );
    for (const version of allAdmZipVersions) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
    }
  });

  it("links patched adm-zip under node_modules after install", () => {
    const version = readInstalledPackageVersion("adm-zip");
    expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
  });
});
