/**
 * Mirrors scripts/generate-npm-shrinkwrap.mjs --check adm-zip assertions so
 * shrinkwrap regressions fail in Vitest (not only when npm-shrinkwrap:check runs).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureAdmZipVersion, SECURE_ADM_ZIP_VERSION } from "../../scripts/adm-zip-security-lib.mjs";

const shrinkwrapPath = join(process.cwd(), "npm-shrinkwrap.json");

describe("npm-shrinkwrap adm-zip guard", () => {
  it("lists only secure adm-zip installs under packages", () => {
    const shrinkwrap = JSON.parse(readFileSync(shrinkwrapPath, "utf8")) as {
      packages?: Record<string, { version?: string }>;
    };

    const admZipInstalls = Object.entries(shrinkwrap.packages ?? {}).filter(([path]) =>
      path.endsWith("node_modules/adm-zip"),
    );
    expect(admZipInstalls.length).toBeGreaterThan(0);

    const insecure = admZipInstalls.filter(
      ([, metadata]) => !isSecureAdmZipVersion(metadata?.version, SECURE_ADM_ZIP_VERSION),
    );
    expect(
      insecure.map(([path, metadata]) => `${path}@${metadata?.version ?? "missing"}`),
      "regenerate shrinkwrap or bump adm-zip overrides",
    ).toEqual([]);
  });
});
