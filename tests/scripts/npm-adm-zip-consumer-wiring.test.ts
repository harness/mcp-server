/**
 * npm global installs use npm-shrinkwrap.json + postinstall fallback, not pnpm overrides.
 * These guards keep the published tarball path aligned with pnpm dev installs.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECURE_ADM_ZIP_VERSION } from "../../scripts/adm-zip-security-lib.mjs";

const root = process.cwd();
const CI_WORKFLOW_PATH = join(root, ".github/workflows/ci.yml");

describe("npm consumer adm-zip wiring", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    files: string[];
    scripts: Record<string, string>;
    overrides: Record<string, Record<string, string>>;
    pnpm: { overrides: Record<string, string> };
  };

  it("ships postinstall scripts in the published package and runs ensure-secure-adm-zip on install", () => {
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm npm-shrinkwrap:check");
  });

  it("pins adm-zip for both pnpm and npm-native onnxruntime-node trees", () => {
    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.overrides["onnxruntime-node"]).toEqual({
      "adm-zip": SECURE_ADM_ZIP_VERSION,
    });
  });

  it("documents adm-zip skip escape hatch for constrained installers", () => {
    const postinstallScript = readFileSync(join(root, "scripts/ensure-secure-adm-zip.mjs"), "utf8");
    expect(postinstallScript).toContain("HARNESS_MCP_SKIP_ADM_ZIP_PATCH");
    expect(postinstallScript).toContain('process.env.HARNESS_MCP_SKIP_ADM_ZIP_PATCH === "1"');
  });

  it("CI validates npm-shrinkwrap metadata before release artifacts ship", () => {
    const workflow = readFileSync(CI_WORKFLOW_PATH, "utf8");
    expect(workflow).toContain("run: pnpm npm-shrinkwrap:check");
  });

  it("generate-npm-shrinkwrap check mode rejects insecure adm-zip in shrinkwrap", () => {
    const generator = readFileSync(join(root, "scripts/generate-npm-shrinkwrap.mjs"), "utf8");
    expect(generator).toContain("isSecureAdmZipVersion");
    expect(generator).toContain("insecureAdmZipInstalls");
    expect(generator).toContain("--check");
  });
});
