import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";

const root = process.cwd();
const shrinkwrapPath = join(root, "npm-shrinkwrap.json");
const generateScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

function sortedEntries(value: Record<string, string> = {}): [string, string][] {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

describe("npm-shrinkwrap.json (global npm consumer tree)", () => {
  it("passes generate-npm-shrinkwrap.mjs --check (CI npm-shrinkwrap:check)", () => {
    const result = spawnSync(process.execPath, [generateScript, "--check"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr ?? "").toMatch(/npm-shrinkwrap\.json metadata is up to date/);
  });

  it("keeps root metadata aligned with package.json", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      name: string;
      version: string;
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const shrinkwrap = JSON.parse(readFileSync(shrinkwrapPath, "utf8")) as {
      packages?: Record<
        string,
        {
          name?: string;
          version?: string;
          dependencies?: Record<string, string>;
          optionalDependencies?: Record<string, string>;
        }
      >;
    };

    const rootEntry = shrinkwrap.packages?.[""];
    expect(rootEntry, "shrinkwrap root package metadata").toBeDefined();
    expect(rootEntry?.name).toBe(pkg.name);
    expect(rootEntry?.version).toBe(pkg.version);
    expect(sortedEntries(rootEntry?.dependencies ?? {})).toEqual(sortedEntries(pkg.dependencies ?? {}));
    expect(sortedEntries(rootEntry?.optionalDependencies ?? {})).toEqual(
      sortedEntries(pkg.optionalDependencies ?? {}),
    );
  });

  it("pins every adm-zip copy in the shrinkwrap tree at or above the security floor", () => {
    const shrinkwrap = JSON.parse(readFileSync(shrinkwrapPath, "utf8")) as {
      packages?: Record<string, { version?: string }>;
    };

    const admZipInstalls = Object.entries(shrinkwrap.packages ?? {}).filter(([path]) =>
      path.endsWith("node_modules/adm-zip"),
    );
    expect(admZipInstalls.length, "expected at least one adm-zip entry in npm-shrinkwrap.json").toBeGreaterThan(
      0,
    );

    for (const [path, metadata] of admZipInstalls) {
      expect(
        isSecureAdmZipVersion(metadata?.version, SECURE_ADM_ZIP_VERSION),
        `${path}@${metadata?.version ?? "missing"} must be >= ${SECURE_ADM_ZIP_VERSION}`,
      ).toBe(true);
    }
  });
});
