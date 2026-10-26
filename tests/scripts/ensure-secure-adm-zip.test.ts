import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall", () => {
  it("ships patch scripts in the npm package and wires postinstall for global installs", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      files: string[];
      scripts: { postinstall?: string };
    };

    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });

  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH is set", () => {
    execFileSync(process.execPath, [postinstallScript], {
      cwd: root,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      stdio: "pipe",
    });
  });

  it("completes without error on a patched tree after pnpm install", () => {
    execFileSync(process.execPath, [postinstallScript], {
      cwd: root,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: undefined },
      stdio: "pipe",
    });
  });
});
