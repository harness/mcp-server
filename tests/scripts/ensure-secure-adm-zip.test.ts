import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADM_ZIP_ADVISORIES } from "../../scripts/adm-zip-security-lib.mjs";

const repoRoot = join(import.meta.dirname, "../..");
const postinstallScript = join(repoRoot, "scripts/ensure-secure-adm-zip.mjs");

function runPostinstall(env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [postinstallScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("ensure-secure-adm-zip postinstall", () => {
  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = runPostinstall({ HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("documents CVE identifiers used in patch warnings", () => {
    expect(ADM_ZIP_ADVISORIES).toMatch(/CVE-2026-39244/);
    expect(ADM_ZIP_ADVISORIES).toMatch(/CVE-2026-76845/);
    const script = readFileSync(postinstallScript, "utf8");
    expect(script).toContain("ADM_ZIP_ADVISORIES");
    expect(script).toContain("HARNESS_MCP_SKIP_ADM_ZIP_PATCH");
  });
});
