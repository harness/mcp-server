/**
 * Maps security-sensitive artifacts to vitest guard files.
 * Fails if a guard is removed or renamed without updating this map.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

const SECURITY_GUARDS: Array<{ artifact: string; guards: string[] }> = [
  {
    artifact: "Production Dockerfile (Debian apt / OpenSSL Trivy fixes)",
    guards: ["docker/production-dockerfile.test.ts"],
  },
  {
    artifact: "Transitive CVE floors (body-parser, zod, fast-uri, ip-address, adm-zip)",
    guards: ["scripts/cve-dependency-pins.test.ts"],
  },
  {
    artifact: "HTTP framework pins (hono, vite, @hono/node-server)",
    guards: ["scripts/http-framework-security-pins.test.ts"],
  },
  {
    artifact: "adm-zip postinstall patch library and symlink traversal guard",
    guards: ["scripts/adm-zip-security-lib.test.ts"],
  },
  {
    artifact: "ip-address semver floor for SSRF-related CVEs",
    guards: ["scripts/ip-address-security-lib.test.ts"],
  },
  {
    artifact: "Published npm tarball includes shrinkwrap + adm-zip postinstall",
    guards: ["scripts/npm-publish-security-artifacts.test.ts"],
  },
  {
    artifact: "Service account aggregate list extractors (account/org scope)",
    guards: ["registry/extractors-service-account.test.ts", "registry/access-control-service-account.test.ts"],
  },
];

describe("Security regression guard map", () => {
  it("every mapped guard test file exists", () => {
    const missing: string[] = [];
    const seen = new Set<string>();

    for (const { guards } of SECURITY_GUARDS) {
      for (const guard of guards) {
        if (seen.has(guard)) continue;
        seen.add(guard);
        const path = join(REPO_ROOT, "tests", guard);
        if (!existsSync(path)) {
          missing.push(`tests/${guard}`);
        }
      }
    }

    expect(missing, `Missing security guard files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("covers each security artifact with at least one guard", () => {
    expect(SECURITY_GUARDS.length).toBeGreaterThanOrEqual(6);
    for (const { artifact, guards } of SECURITY_GUARDS) {
      expect(guards.length, `${artifact} has no guards`).toBeGreaterThan(0);
    }
  });
});
