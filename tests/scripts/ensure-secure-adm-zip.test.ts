import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall", () => {
  it("exits successfully on a clean install tree", () => {
    const env = { ...process.env };
    delete env.HARNESS_MCP_SKIP_ADM_ZIP_PATCH;
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env,
    });
    expect(result.status).toBe(0);
  });

  it("honors HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1 without running the patcher", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
