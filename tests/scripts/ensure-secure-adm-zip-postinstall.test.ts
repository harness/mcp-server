/**
 * Postinstall entrypoint wiring — skip guard and safe completion on a patched tree.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall", () => {
  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: root,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("completes on the repo tree without skip (patched adm-zip copies)", () => {
    const env = { ...process.env };
    delete env.HARNESS_MCP_SKIP_ADM_ZIP_PATCH;
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: root,
      env,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
  });
});
