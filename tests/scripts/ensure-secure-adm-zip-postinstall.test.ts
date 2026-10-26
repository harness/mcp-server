import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

function runPostinstall(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [postinstallScript], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

describe("ensure-secure-adm-zip postinstall entrypoint", () => {
  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = runPostinstall({
      ...process.env,
      HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("verifies adm-zip installs without failing on a patched workspace tree", () => {
    const env = { ...process.env };
    delete env.HARNESS_MCP_SKIP_ADM_ZIP_PATCH;

    const result = runPostinstall(env);

    expect(result.status).toBe(0);
    expect(result.stderr).not.toMatch(/adm-zip patch warning:/);
  });
});
