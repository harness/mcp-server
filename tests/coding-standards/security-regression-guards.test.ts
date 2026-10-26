/**
 * Maps recent security-sensitive changes to guardrail tests so removals are caught in review.
 * Complements docs/coding-standards enforcement-map.test.ts (architecture rules).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Security fix or supply-chain control → vitest files that enforce it. */
export const SECURITY_REGRESSION_GUARDS: Record<string, readonly string[]> = {
  "Production image: Debian apt refresh and OpenSSL floor (#1154)": [
    "tests/docker/production-dockerfile.test.ts",
  ],
  "Docker build: adm-zip scripts before pnpm install (postinstall)": [
    "tests/docker/dockerfile-build-security.test.ts",
    "tests/scripts/adm-zip-security-lib.test.ts",
  ],
  "Transitive CVE pins: body-parser, zod, fast-uri, ip-address": [
    "tests/scripts/cve-dependency-pins.test.ts",
    "tests/scripts/ip-address-security-lib.test.ts",
  ],
  "HTTP stack CVE pins: hono, @hono/node-server, vite (#1144)": [
    "tests/scripts/http-framework-security-pins.test.ts",
  ],
  "Service account list at account/org scope (#1152)": [
    "tests/registry/access-control-service-account.test.ts",
    "tests/registry/extractors-service-account.test.ts",
  ],
  "npm-shrinkwrap gate for global npm installs": [
    "tests/scripts/npm-shrinkwrap-check.test.ts",
  ],
};

function assertGuardFilesExist(rule: string, files: readonly string[]): void {
  const missing = files.filter((f) => !existsSync(join(REPO_ROOT, f)));
  expect(
    missing,
    `${rule}: missing guard file(s):\n${missing.join("\n")}`,
  ).toEqual([]);
}

describe("Security regression — enforcement map", () => {
  for (const [rule, files] of Object.entries(SECURITY_REGRESSION_GUARDS)) {
    it(rule, () => {
      assertGuardFilesExist(rule, files);
    });
  }

  it("CI and publish pipeline run npm-shrinkwrap:check", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm npm-shrinkwrap:check");

    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("pnpm npm-shrinkwrap:check");
    expect(ci).toContain("pnpm test");
  });
});
