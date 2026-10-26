/**
 * Indexes security-focused regression suites so new guard tests are not added in isolation.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..");

/** Human label → test paths relative to tests/ */
const SECURITY_REGRESSION_SUITES: Record<string, readonly string[]> = {
  "CVE dependency pins (body-parser, zod, fast-uri, express-rate-limit)": [
    "scripts/cve-dependency-pins.test.ts",
  ],
  "HTTP framework pins (hono, vite)": ["scripts/http-framework-security-pins.test.ts"],
  "Transitive toolchain pins": ["scripts/transitive-security-pins.test.ts"],
  "ip-address CVE floor and linked-install detection": ["scripts/ip-address-security-lib.test.ts"],
  "adm-zip extraction and nested install repair": ["scripts/adm-zip-security-lib.test.ts"],
  "adm-zip postinstall wiring and skip guard": ["scripts/ensure-secure-adm-zip-postinstall.test.ts"],
  "Production Dockerfile Debian/OpenSSL floors": ["docker/production-dockerfile.test.ts"],
  "Service account aggregate extractors": ["registry/extractors-service-account.test.ts"],
  "Service account scope dispatch (account/org/project)": [
    "registry/access-control-service-account.test.ts",
  ],
  "Access-control audit prompt — account-scope service accounts": ["prompts/access-control-audit.test.ts"],
};

const EXEMPT_RELATIVE_PATHS = new Set<string>();

function securityScriptAndDockerTests(): string[] {
  const files: string[] = [];
  const scriptsDir = join(REPO_ROOT, "tests/scripts");
  for (const name of readdirSync(scriptsDir)) {
    if (!name.endsWith(".test.ts")) continue;
    if (/security|cve|adm-zip|pin/i.test(name)) {
      files.push(`scripts/${name}`);
    }
  }
  for (const name of readdirSync(join(REPO_ROOT, "tests/docker"))) {
    if (name.endsWith(".test.ts")) {
      files.push(`docker/${name}`);
    }
  }
  return files.sort();
}

describe("Security regression test map", () => {
  it("every mapped suite file exists on disk", () => {
    const missing: string[] = [];
    for (const files of Object.values(SECURITY_REGRESSION_SUITES)) {
      for (const rel of files) {
        if (!existsSync(join(REPO_ROOT, "tests", rel))) {
          missing.push(rel);
        }
      }
    }
    expect(missing, `Missing security regression files: ${missing.join(", ")}`).toEqual([]);
  });

  it("every security script/docker test file is listed in SECURITY_REGRESSION_SUITES", () => {
    const indexed = new Set<string>();
    for (const files of Object.values(SECURITY_REGRESSION_SUITES)) {
      for (const rel of files) {
        indexed.add(rel);
      }
    }

    const unmapped = securityScriptAndDockerTests().filter(
      (rel) => !indexed.has(rel) && !EXEMPT_RELATIVE_PATHS.has(rel),
    );
    expect(
      unmapped,
      `Add ${unmapped.join(", ")} to SECURITY_REGRESSION_SUITES in security-regression-map.test.ts`,
    ).toEqual([]);
  });
});
