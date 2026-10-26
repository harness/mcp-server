import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall", () => {
  it("wires postinstall to the adm-zip security script and ships it in the npm package", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: { postinstall?: string };
      files: string[];
    };

    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });

  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1 (no upgrade stderr)", () => {
    const result = spawnSync("node", [postinstallScript], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1",
      },
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).not.toMatch(/upgraded adm-zip/i);
  });
});
