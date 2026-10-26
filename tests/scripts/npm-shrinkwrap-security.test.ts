import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";
import {
  isSecureIpAddressVersion,
  SECURE_IP_ADDRESS_VERSION,
} from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

function sortedEntries(value: Record<string, string> = {}): [string, string][] {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

describe("npm-shrinkwrap.json security (global npm install tree)", () => {
  const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>;
  };
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    name: string;
    version: string;
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };

  it("root metadata and dependency lists match package.json (npm-shrinkwrap:check guard)", () => {
    const rootPkg = shrinkwrap.packages?.[""];
    expect(rootPkg, "shrinkwrap root package metadata").toBeDefined();
    expect(rootPkg!.name).toBe(packageJson.name);
    expect(rootPkg!.version).toBe(packageJson.version);
    expect(sortedEntries(rootPkg!.dependencies)).toEqual(sortedEntries(packageJson.dependencies));
    expect(sortedEntries(rootPkg!.optionalDependencies)).toEqual(
      sortedEntries(packageJson.optionalDependencies),
    );
  });

  it("every adm-zip copy in the shrinkwrap tree meets the patched floor", () => {
    const admZipInstalls = Object.entries(shrinkwrap.packages ?? {}).filter(([path]) =>
      path.endsWith("node_modules/adm-zip"),
    );
    expect(admZipInstalls.length, "expected at least one adm-zip entry in shrinkwrap").toBeGreaterThan(
      0,
    );

    const insecure = admZipInstalls.filter(
      ([, metadata]) => !isSecureAdmZipVersion(metadata?.version, SECURE_ADM_ZIP_VERSION),
    );
    expect(
      insecure.map(([path, metadata]) => `${path}@${metadata?.version ?? "missing"}`),
    ).toEqual([]);
  });

  it("documents a patched ip-address release for transitive express consumers", () => {
    const version = shrinkwrap.packages?.["node_modules/ip-address"]?.version;
    expect(version, "expected ip-address in npm-shrinkwrap.json").toBeTruthy();
    expect(isSecureIpAddressVersion(version, SECURE_IP_ADDRESS_VERSION)).toBe(true);
  });
});
