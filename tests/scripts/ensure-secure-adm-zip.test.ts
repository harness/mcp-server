import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const scriptPath = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip.mjs postinstall", () => {
  it("exits 0 when HARNESS_MCP_SKIP_ADM_ZIP_PATCH suppresses patching", () => {
    const result = spawnSync("node", [scriptPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("verifies the linked adm-zip install without failing on a healthy workspace", () => {
    const result = spawnSync("node", [scriptPath], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).not.toMatch(/may remain vulnerable/);
  });
});
