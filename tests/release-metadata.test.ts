import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readJson(path: string): { version: string } {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as { version: string };
}

describe("release metadata", () => {
  it("keeps package and bundle manifest versions in sync for the next patch release", () => {
    const packageJson = readJson("package.json");
    const rootManifest = readJson("manifest.json");
    const directoryManifest = readJson("mcp-directory/manifest.json");

    expect(packageJson.version).toBe("3.0.6");
    expect(rootManifest.version).toBe(packageJson.version);
    expect(directoryManifest.version).toBe(packageJson.version);
  });
});
