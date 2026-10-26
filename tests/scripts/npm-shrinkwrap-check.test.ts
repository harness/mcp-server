import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { isSecureAdmZipVersion, SECURE_ADM_ZIP_VERSION } from "../../scripts/adm-zip-security-lib.mjs";

const root = process.cwd();
const scriptPath = join(root, "scripts/generate-npm-shrinkwrap.mjs");

function runCheck(): ReturnType<typeof spawnSync> {
  return spawnSync("node", [scriptPath, "--check"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
}

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes in CI when shrinkwrap metadata and adm-zip pins match package.json", () => {
    const result = runCheck();
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });

  it("mirrors only transitive pnpm overrides into the npm staging manifest", () => {
    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain("const directDeps = new Set");
    expect(script).toMatch(
      /Object\.entries\(pkg\.pnpm\?\.overrides \?\? \{\}\)\.filter\(\(\[name\]\) => !directDeps\.has\(name\)\)/,
    );
    expect(script).toContain("overrides: { ...transitiveOverrides, ...(pkg.overrides ?? {}) }");
  });

  it("documents every adm-zip install in shrinkwrap at the secure floor", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      name: string;
      version: string;
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const shrinkwrap = JSON.parse(readFileSync(join(root, "npm-shrinkwrap.json"), "utf8")) as {
      packages?: Record<string, { version?: string; name?: string; dependencies?: Record<string, string> }>;
    };

    const rootMeta = shrinkwrap.packages?.[""];
    expect(rootMeta?.name).toBe(pkg.name);
    expect(rootMeta?.version).toBe(pkg.version);

    const sortEntries = (value: Record<string, string> = {}) =>
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    expect(sortEntries(rootMeta?.dependencies)).toEqual(sortEntries(pkg.dependencies));
    expect(sortEntries(rootMeta?.optionalDependencies)).toEqual(
      sortEntries(pkg.optionalDependencies),
    );

    const admZipInstalls = Object.entries(shrinkwrap.packages ?? {}).filter(([path]) =>
      path.endsWith("node_modules/adm-zip"),
    );
    expect(admZipInstalls.length).toBeGreaterThan(0);
    for (const [, metadata] of admZipInstalls) {
      expect(
        isSecureAdmZipVersion(metadata?.version, SECURE_ADM_ZIP_VERSION),
        `insecure adm-zip@${metadata?.version ?? "missing"} in shrinkwrap`,
      ).toBe(true);
    }
  });
});
