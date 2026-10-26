import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

function runPostinstall(cwd: string, env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(process.execPath, [postinstallScript], {
    cwd,
    env,
    encoding: "utf8",
  });
}

function writeAdmZipPackage(admZipDir: string, version: string) {
  mkdirSync(admZipDir, { recursive: true });
  writeFileSync(
    join(admZipDir, "package.json"),
    JSON.stringify({ name: "adm-zip", version }),
  );
}

describe("ensure-secure-adm-zip postinstall entrypoint", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits 0 on a secure workspace without patching", () => {
    const result = runPostinstall(root);
    expect(result.status).toBe(0);
    expect(result.stderr ?? "").not.toMatch(/adm-zip patch warning/i);
  });

  it("exits 0 immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH is set", () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "adm-zip-postinstall-"));
    tempDirs.push(packageRoot);
    writeAdmZipPackage(join(packageRoot, "node_modules", "adm-zip"), "0.5.18");

    const result = runPostinstall(packageRoot, {
      ...process.env,
      HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1",
    });

    expect(result.status).toBe(0);
    expect(result.stderr ?? "").toBe("");
  });
});
