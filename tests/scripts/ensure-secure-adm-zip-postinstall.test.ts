import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const postinstallScript = join(root, "scripts/ensure-secure-adm-zip.mjs");

describe("ensure-secure-adm-zip postinstall entrypoint", () => {
  it("is wired in package.json postinstall", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: { postinstall?: string };
    };
    expect(pkg.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
  });

  it("exits immediately when HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1 (no npm repair spawn)", () => {
    const result = spawnSync(process.execPath, [postinstallScript], {
      cwd: root,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("Dockerfile copies adm-zip scripts before pnpm install in dependency stages", () => {
    const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
    const stages = ["FROM toolchain AS build", "FROM toolchain AS production-dependencies"];

    for (const marker of stages) {
      const start = dockerfile.indexOf(marker);
      expect(start, `expected ${marker} in Dockerfile`).toBeGreaterThan(-1);
      const chunk = dockerfile.slice(start, start + 700);
      expect(chunk).toContain(
        "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/",
      );
      expect(chunk.indexOf("COPY scripts")).toBeLessThan(chunk.indexOf("pnpm install"));
    }
  });
});
