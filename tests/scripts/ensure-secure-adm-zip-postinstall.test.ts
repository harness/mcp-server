import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall entrypoint", () => {
  it("is wired in package.json postinstall and published files", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: { postinstall?: string };
      files?: string[];
    };
    expect(manifest.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(manifest.files).toContain("scripts/ensure-secure-adm-zip.mjs");
    expect(manifest.files).toContain("scripts/adm-zip-security-lib.mjs");
  });

  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr ?? "").not.toMatch(/upgraded adm-zip/i);
  });
});
