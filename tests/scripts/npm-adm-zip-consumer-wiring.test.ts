import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("npm consumer wiring for adm-zip postinstall", () => {
  it("ships postinstall scripts and shrinkwrap in the published tarball manifest", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      files: string[];
      scripts: Record<string, string>;
    };

    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "npm-shrinkwrap.json",
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.scripts.prepublishOnly).toContain("npm-shrinkwrap:check");
  });

  it("runs shrinkwrap drift check in CI before tests", () => {
    const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("pnpm npm-shrinkwrap:check");
  });
});
