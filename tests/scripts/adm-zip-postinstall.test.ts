import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall", () => {
  it("is wired as package.json postinstall and ships patch scripts in the npm tarball", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: { postinstall?: string };
      files?: string[];
    };

    expect(pkg.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(pkg.files).toContain("scripts/ensure-secure-adm-zip.mjs");
    expect(pkg.files).toContain("scripts/adm-zip-security-lib.mjs");
    expect(pkg.files).toContain("npm-shrinkwrap.json");
  });

  it("documents bypass paths for npm --ignore-scripts and HARNESS_MCP_SKIP_ADM_ZIP_PATCH", () => {
    const script = readFileSync(postinstallScript, "utf8");
    expect(script).toContain("--ignore-scripts");
    expect(script).toContain("HARNESS_MCP_SKIP_ADM_ZIP_PATCH");
    expect(script).toContain("adm-zip-security-lib.mjs");
  });

  it("exits successfully when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: root,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr ?? "").not.toMatch(/adm-zip patch warning/i);
  });
});
