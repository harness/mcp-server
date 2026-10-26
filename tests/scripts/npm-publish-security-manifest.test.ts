import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECURE_ADM_ZIP_VERSION } from "../../scripts/adm-zip-security-lib.mjs";

const root = process.cwd();

describe("npm publish security manifest (adm-zip postinstall)", () => {
  it("ships postinstall helpers and wires postinstall for global npm consumers", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      files: string[];
      scripts: { postinstall?: string };
      overrides: Record<string, Record<string, string>>;
      pnpm: { overrides: Record<string, string | Record<string, string>> };
    };

    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.overrides["onnxruntime-node"]).toEqual({
      "adm-zip": SECURE_ADM_ZIP_VERSION,
    });
  });

  it("documents the skip flag in the postinstall entry script", () => {
    const script = readFileSync(join(root, "scripts/ensure-secure-adm-zip.mjs"), "utf8");
    expect(script).toContain("HARNESS_MCP_SKIP_ADM_ZIP_PATCH");
    expect(script).toContain('import { ensureSecureAdmZip');
  });
});
