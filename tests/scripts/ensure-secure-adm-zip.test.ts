import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const postinstallScript = join(repoRoot, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall entrypoint", () => {
  it("exits successfully on a patched workspace install", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: repoRoot,
      env: process.env,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr ?? "").not.toMatch(/adm-zip patch warning/);
  });

  it("no-ops when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: repoRoot,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr ?? "").not.toContain("[harness-mcp-v2]");
  });
});
