import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const scriptPath = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall entrypoint", () => {
  it("is wired through package.json postinstall for npm consumers", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.scripts?.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });

  it("documents npm install --ignore-scripts as an unsupported bypass", () => {
    const source = readFileSync(scriptPath, "utf8");
    expect(source).toContain("HARNESS_MCP_SKIP_ADM_ZIP_PATCH");
    expect(source).toMatch(/ignore-scripts/i);
  });

  it("exits 0 immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr ?? "").not.toContain("adm-zip patch warning");
  });

  it("runs ensureSecureAdmZip on the package root when not skipped", () => {
    const env = { ...process.env };
    delete env.HARNESS_MCP_SKIP_ADM_ZIP_PATCH;
    const result = spawnSync(process.execPath, [scriptPath], {
      env,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
  });
});
