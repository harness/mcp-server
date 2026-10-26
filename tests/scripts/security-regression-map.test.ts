/**
 * Maps Oct 2026 security remediations to Vitest guardrails.
 * Deleting a guard without updating this map should fail CI.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const REPO_ROOT = join(import.meta.dirname, "../..");

/** User-facing risk area → guard test files (repo-relative). */
const SECURITY_REGRESSION_MAP: Record<string, readonly string[]> = {
  "Production image: Debian apt cache bust + OpenSSL floor (Trivy / #1154)": [
    "tests/docker/production-dockerfile.test.ts",
  ],
  "Docker build: adm-zip security scripts before pnpm install": [
    "tests/docker/dockerfile-install-preflight.test.ts",
  ],
  "Transitive CVE pins: body-parser, zod, fast-uri, ip-address": [
    "tests/scripts/cve-dependency-pins.test.ts",
    "tests/scripts/ip-address-security-lib.test.ts",
  ],
  "HTTP framework CVE pins: Hono + Vite (#1144)": ["tests/scripts/http-framework-security-pins.test.ts"],
  "adm-zip path traversal + postinstall / shrinkwrap enforcement": [
    "tests/scripts/adm-zip-security-lib.test.ts",
    "tests/scripts/npm-shrinkwrap-adm-zip-guard.test.ts",
    "tests/package/npm-publish-security-manifest.test.ts",
  ],
  "Service account list flattening at account/org scope (#1152)": [
    "tests/registry/extractors-service-account.test.ts",
    "tests/registry/access-control-service-account.test.ts",
  ],
};

function assertGuardFilesExist(area: string, files: readonly string[]): void {
  const missing = files.filter((file) => !existsSync(join(REPO_ROOT, file)));
  expect(missing, `${area}: missing guard file(s):\n${missing.join("\n")}`).toEqual([]);
}

describe("Security regression map", () => {
  it("documents every mapped area with at least one guard test file", () => {
    for (const files of Object.values(SECURITY_REGRESSION_MAP)) {
      expect(files.length).toBeGreaterThan(0);
    }
    expect(Object.keys(SECURITY_REGRESSION_MAP).length).toBeGreaterThanOrEqual(6);
  });

  for (const [area, files] of Object.entries(SECURITY_REGRESSION_MAP)) {
    it(area, () => {
      assertGuardFilesExist(area, files);
    });
  }

  it("links shrinkwrap adm-zip checks to generate-npm-shrinkwrap.mjs --check", () => {
    const script = readFileSync(join(REPO_ROOT, "scripts/generate-npm-shrinkwrap.mjs"), "utf8");
    expect(script).toContain("isSecureAdmZipVersion");
    expect(script).toContain("--check");
    expect(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).toContain(
      '"npm-shrinkwrap:check": "node scripts/generate-npm-shrinkwrap.mjs --check"',
    );
  });

  it("keeps CI container job on Trivy critical/high with ignore-unfixed", () => {
    const workflow = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("aquasecurity/trivy-action");
    expect(workflow).toContain("severity: CRITICAL,HIGH");
    expect(workflow).toContain("ignore-unfixed: true");
  });
});
