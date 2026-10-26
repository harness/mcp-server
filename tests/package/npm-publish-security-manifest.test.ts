import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("npm publish security manifest", () => {
  it("ships adm-zip guard scripts and wires postinstall before onnx consumers load", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      files: string[];
      scripts: { postinstall?: string };
    };

    expect(pkg.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
        "npm-shrinkwrap.json",
      ]),
    );
    expect(pkg.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
  });

  it("pins adm-zip in pnpm overrides for repo installs", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
      dependencies: Record<string, string>;
    };
    expect(pkg.pnpm.overrides["adm-zip"]).toBe(">=0.6.1");
    expect(pkg.dependencies["adm-zip"]).toMatch(/^[\^~]?0\.6\./);
  });
});
