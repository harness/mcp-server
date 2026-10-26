import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("adm-zip supply chain (postinstall + npm publish surface)", () => {
  it("ships security scripts and runs ensure-secure-adm-zip on postinstall", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: { postinstall?: string };
      files: string[];
    };

    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toContain("scripts/adm-zip-security-lib.mjs");
    expect(packageJson.files).toContain("scripts/ensure-secure-adm-zip.mjs");
  });

  it("documents HARNESS_MCP_SKIP_ADM_ZIP_PATCH escape hatch in the postinstall script", () => {
    const script = readFileSync(join(root, "scripts/ensure-secure-adm-zip.mjs"), "utf8");
    expect(script).toContain("HARNESS_MCP_SKIP_ADM_ZIP_PATCH");
  });
});
