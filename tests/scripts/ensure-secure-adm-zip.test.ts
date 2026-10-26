import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall", () => {
  it("exits without patching when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr ?? "").not.toContain("upgraded adm-zip");
  });

  it("completes successfully on a tree that already satisfies the adm-zip floor", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: root,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: undefined },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
  });
});
