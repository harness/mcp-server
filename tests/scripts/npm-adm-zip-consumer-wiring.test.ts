import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("npm consumer wiring for adm-zip postinstall security patch", () => {
  it("ships postinstall scripts in the published package files list", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      files: string[];
      scripts: Record<string, string>;
    };

    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
  });

  it("keeps postinstall script sources on disk and wired to adm-zip-security-lib", () => {
    const ensureScript = join(root, "scripts/ensure-secure-adm-zip.mjs");
    const libScript = join(root, "scripts/adm-zip-security-lib.mjs");

    expect(existsSync(ensureScript)).toBe(true);
    expect(existsSync(libScript)).toBe(true);

    const ensureSource = readFileSync(ensureScript, "utf8");
    expect(ensureSource).toContain('from "./adm-zip-security-lib.mjs"');
    expect(ensureSource).toContain("HARNESS_MCP_SKIP_ADM_ZIP_PATCH");
    expect(ensureSource).toContain("ensureSecureAdmZip");
  });

  it("validates npm-shrinkwrap before publish so global installs keep security pins", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts.prepublishOnly).toContain("npm-shrinkwrap:check");
    expect(packageJson.scripts["npm-shrinkwrap:check"]).toContain("generate-npm-shrinkwrap.mjs");
  });
});
