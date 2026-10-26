/**
 * npm global-install supply chain: postinstall fallback, published files, and opt-out.
 * Complements adm-zip-security-lib unit tests and npm-shrinkwrap --check.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECURE_ADM_ZIP_VERSION } from "../../scripts/adm-zip-security-lib.mjs";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("adm-zip npm consumer supply chain", () => {

  it("ships shrinkwrap and postinstall scripts in the published package manifest", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      files: string[];
      scripts: Record<string, string>;
      pnpm: { overrides: Record<string, string> };
    };

    expect(pkg.files).toEqual(
      expect.arrayContaining([
        "npm-shrinkwrap.json",
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
    expect(pkg.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(pkg.scripts.prepublishOnly).toContain("npm-shrinkwrap:check");
    expect(pkg.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
  });

  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1 without running the patcher", () => {
    const result = spawnSync("node", ["scripts/ensure-secure-adm-zip.mjs"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toMatch(/upgraded adm-zip/);
    expect(result.stderr).not.toMatch(/adm-zip patch warning/);
  });
});
