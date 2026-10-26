import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { listInsecureAdmZipInstalls } from "../../scripts/adm-zip-security-lib.mjs";

const repoRoot = process.cwd();
const repoScripts = join(repoRoot, "scripts");

function writeAdmZipPackage(root: string, version: string) {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "adm-zip", version }));
}

function scaffoldConsumerTree(vulnerableVersion: string) {
  const packageRoot = mkdtempSync(join(tmpdir(), "adm-zip-postinstall-"));
  mkdirSync(join(packageRoot, "scripts"), { recursive: true });
  for (const file of ["ensure-secure-adm-zip.mjs", "adm-zip-security-lib.mjs"]) {
    copyFileSync(join(repoScripts, file), join(packageRoot, "scripts", file));
  }
  writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: "fixture-consumer", version: "0.0.0" }));
  writeAdmZipPackage(join(packageRoot, "node_modules", "adm-zip"), vulnerableVersion);
  return packageRoot;
}

function runPostinstall(packageRoot: string, env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, [join(packageRoot, "scripts", "ensure-secure-adm-zip.mjs")], {
    cwd: packageRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("ensure-secure-adm-zip postinstall entrypoint", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("documents HARNESS_MCP_SKIP_ADM_ZIP_PATCH for npm --ignore-scripts consumers", () => {
    const source = readFileSync(join(repoScripts, "ensure-secure-adm-zip.mjs"), "utf8");
    expect(source).toContain("HARNESS_MCP_SKIP_ADM_ZIP_PATCH");
    expect(source).toContain("npm install --ignore-scripts");
  });

  it("exits without mutating node_modules when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const packageRoot = scaffoldConsumerTree("0.5.18");
    tempRoots.push(packageRoot);

    const result = runPostinstall(packageRoot, { HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" });
    expect(result.status, [result.stdout, result.stderr].filter(Boolean).join("\n")).toBe(0);
    expect(listInsecureAdmZipInstalls(packageRoot)).toHaveLength(1);
  });
});
