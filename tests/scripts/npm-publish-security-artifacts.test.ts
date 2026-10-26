import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("npm publish security artifacts", () => {
  it("blocks publish when shrinkwrap drifts and ships patch scripts in the tarball", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: { prepublishOnly?: string; postinstall?: string };
      files?: string[];
      overrides?: Record<string, Record<string, string>>;
    };

    expect(pkg.scripts.prepublishOnly).toContain("pnpm build");
    expect(pkg.scripts.prepublishOnly).toContain("npm-shrinkwrap:check");
    expect(pkg.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");

    expect(pkg.files).toEqual(
      expect.arrayContaining([
        "build/",
        "npm-shrinkwrap.json",
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
    expect(pkg.overrides?.["onnxruntime-node"]?.["adm-zip"]).toBeDefined();
  });

  it("documents the global npm consumer verification script", () => {
    const verifyScript = readFileSync(join(root, "scripts/verify-npm-adm-zip.mjs"), "utf8");
    expect(verifyScript).toContain("npm pack");
    expect(verifyScript).toContain("listInsecureAdmZipInstalls");
    expect(verifyScript).toContain("SECURE_ADM_ZIP_VERSION");
  });

  it("generate-npm-shrinkwrap runs ensureSecureAdmZip after materializing the tree", () => {
    const generator = readFileSync(join(root, "scripts/generate-npm-shrinkwrap.mjs"), "utf8");
    expect(generator).toContain("ensureSecureAdmZip");
    expect(generator).toContain("SECURE_ADM_ZIP_VERSION");
    expect(generator).toContain("isSecureAdmZipVersion");
  });
});
