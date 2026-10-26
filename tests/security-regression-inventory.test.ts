/**
 * Inventory of security/CVE regression guardrails outside coding-standards/.
 * Fails when a listed file is removed or renamed without updating this map.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/** Human-readable labels — not executed at runtime. */
export const SECURITY_REGRESSION_TESTS: Record<string, string> = {
  "tests/docker/production-dockerfile.test.ts": "Debian OpenSSL refresh and adm-zip COPY order in Dockerfile",
  "tests/scripts/adm-zip-dependency-pins.test.ts": "adm-zip pnpm/npm overrides and lockfile floor",
  "tests/scripts/adm-zip-security-lib.test.ts": "adm-zip patch library behavior",
  "tests/scripts/cve-dependency-pins.test.ts": "zod, body-parser, qs, proxy-addr override floors",
  "tests/scripts/ensure-secure-adm-zip.test.ts": "postinstall entrypoint and skip env",
  "tests/scripts/http-framework-security-pins.test.ts": "hono, @hono/node-server, vite floors",
  "tests/scripts/ip-address-security-lib.test.ts": "ip-address override, lockfile, NAT64 classification",
  "tests/scripts/security-version-floor.test.ts": "lockfile semver helper unit tests",
  "tests/registry/extractors-service-account.test.ts": "service account list flattening (account-scope lists)",
  "tests/registry/access-control-service-account.test.ts": "service_account scope dispatch and aggregate API",
};

describe("Security regression guardrail inventory", () => {
  it("every documented guardrail test file exists on disk", () => {
    const missing: string[] = [];
    for (const rel of Object.keys(SECURITY_REGRESSION_TESTS)) {
      if (!existsSync(join(root, rel))) missing.push(rel);
    }
    expect(missing, `missing guardrail files:\n${missing.join("\n")}`).toEqual([]);
  });
});
