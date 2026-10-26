import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("npm publish security artifacts", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    files?: string[];
    scripts?: Record<string, string>;
  };

  it("ships adm-zip patch scripts and shrinkwrap for global npm installs", () => {
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "npm-shrinkwrap.json",
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );

    for (const relativePath of [
      "npm-shrinkwrap.json",
      "scripts/adm-zip-security-lib.mjs",
      "scripts/ensure-secure-adm-zip.mjs",
    ]) {
      expect(existsSync(join(root, relativePath)), `missing ${relativePath}`).toBe(true);
    }
  });

  it("runs adm-zip postinstall unless HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1", () => {
    expect(packageJson.scripts?.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");

    const skipped = spawnSync("node", ["scripts/ensure-secure-adm-zip.mjs"], {
      cwd: root,
      env: { ...process.env, HARNESS_MCP_SKIP_ADM_ZIP_PATCH: "1" },
      encoding: "utf8",
    });
    expect(skipped.status).toBe(0);
    expect(skipped.stderr ?? "").not.toMatch(/adm-zip patch warning/i);
  });
});
