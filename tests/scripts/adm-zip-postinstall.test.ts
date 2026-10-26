import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall", () => {
  it("wires postinstall and ships adm-zip security scripts in the npm package", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      files: string[];
    };

    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toContain("scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toContain("scripts/adm-zip-security-lib.mjs");
  });

  it("exits successfully when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
