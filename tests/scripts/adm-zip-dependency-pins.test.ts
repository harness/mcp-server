/**
 * Regression guards for adm-zip CVE mitigations (direct dep, onnxruntime nested copy, shrinkwrap).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";

const root = process.cwd();

function readPackageJson() {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    files?: string[];
    overrides?: Record<string, unknown>;
    pnpm?: { overrides?: Record<string, string> };
  };
}

describe("adm-zip dependency pins", () => {
  it("pins direct adm-zip and pnpm override at or above the secure floor", () => {
    const pkg = readPackageJson();
    expect(pkg.dependencies?.["adm-zip"]).toMatch(/0\.6\.[1-9]/);
    expect(pkg.pnpm?.overrides?.["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
  });

  it("pins onnxruntime-node nested adm-zip via npm overrides", () => {
    const pkg = readPackageJson();
    expect(pkg.overrides?.["onnxruntime-node"]).toEqual({ "adm-zip": SECURE_ADM_ZIP_VERSION });
  });

  it("runs ensure-secure-adm-zip on postinstall and ships security scripts in the npm package", () => {
    const pkg = readPackageJson();
    expect(pkg.scripts?.postinstall).toContain("ensure-secure-adm-zip.mjs");
    expect(pkg.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });

  it("keeps npm-shrinkwrap adm-zip installs on the patched release", () => {
    const shrinkwrap = JSON.parse(readFileSync(join(root, "npm-shrinkwrap.json"), "utf8")) as {
      packages?: Record<string, { version?: string }>;
    };
    const installs = Object.entries(shrinkwrap.packages ?? {}).filter(([path]) =>
      path.endsWith("node_modules/adm-zip"),
    );
    expect(installs.length).toBeGreaterThan(0);
    for (const [, metadata] of installs) {
      expect(isSecureAdmZipVersion(metadata?.version, SECURE_ADM_ZIP_VERSION)).toBe(true);
    }
  });

  it("Docker build stages copy adm-zip security scripts before pnpm install", () => {
    const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs");
    expect(dockerfile.match(/COPY scripts\/ensure-secure-adm-zip\.mjs/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
