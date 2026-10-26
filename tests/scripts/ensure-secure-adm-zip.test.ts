import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const scriptPath = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall entrypoint", () => {
  it("exits 0 when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1 without scanning node_modules", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr ?? "").not.toContain("adm-zip patch warning");
  });

  it("exits 0 on a tree that already resolves secure adm-zip", () => {
    const env = { ...process.env };
    delete env.HARNESS_MCP_SKIP_ADM_ZIP_PATCH;

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      env,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr ?? "").not.toMatch(/may remain vulnerable/);
  });
});
