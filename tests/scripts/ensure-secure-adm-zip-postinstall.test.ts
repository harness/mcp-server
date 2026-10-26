/**
 * Regression guards for package.json postinstall → ensure-secure-adm-zip.mjs wiring.
 * Complements adm-zip-security-lib unit tests and Dockerfile COPY ordering checks.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const POSTINSTALL_SCRIPT = join(REPO_ROOT, "scripts/ensure-secure-adm-zip.mjs");

function runPostinstall(env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, [POSTINSTALL_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", ...env },
  });
}

describe("ensure-secure-adm-zip.mjs postinstall", () => {
  it("package.json postinstall invokes the security patch script", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts?: { postinstall?: string };
    };
    expect(pkg.scripts?.postinstall).toMatch(/ensure-secure-adm-zip\.mjs/);
  });

  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    const result = runPostinstall({ HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" });
    const output = [result.stderr, result.stdout].filter(Boolean).join("\n");
    expect(result.status, output || "postinstall failed").toBe(0);
    expect(output).not.toMatch(/upgraded adm-zip/i);
  });

  it("completes on a patched workspace install without upgrading adm-zip", () => {
    const result = runPostinstall();
    const output = [result.stderr, result.stdout].filter(Boolean).join("\n");
    expect(result.status, output || "postinstall failed").toBe(0);
    expect(output).not.toMatch(/may remain vulnerable/i);
  });
});
