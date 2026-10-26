/**
 * Regression guards for npm consumer supply chain: postinstall patch wiring,
 * published file manifest, and opt-out env for CI or --ignore-scripts flows.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const postinstallScript = join(repoRoot, "scripts/ensure-secure-adm-zip.mjs");

describe("adm-zip supply chain — npm consumer guards", () => {
  it("ships postinstall patch scripts and shrinkwrap in the published tarball", () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    expect(pkg.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(pkg.scripts.prepublishOnly).toContain("npm-shrinkwrap:check");
    expect(pkg.files).toEqual(
      expect.arrayContaining([
        "npm-shrinkwrap.json",
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });

  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: repoRoot,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });
    expect(result.status, [result.stderr, result.stdout].filter(Boolean).join("\n")).toBe(0);
  });

  it("runs postinstall patch without error on a secure workspace install", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: repoRoot,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: undefined },
      encoding: "utf8",
    });
    expect(result.status, [result.stderr, result.stdout].filter(Boolean).join("\n")).toBe(0);
  });
});
