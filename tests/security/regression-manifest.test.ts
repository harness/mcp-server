/**
 * Inventory of security regression tests added for dependency and container hardening.
 * Prevents removing or hollowing out guards without updating this manifest.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type SecurityRegressionGuard = {
  /** Relative path from repository root. */
  path: string;
  /** Distinct substring that must remain in the file (proves the guard still runs). */
  anchor: string;
  /** Short note for contributors — not asserted. */
  topic: string;
};

const SECURITY_REGRESSION_GUARDS: SecurityRegressionGuard[] = [
  {
    path: "tests/docker/production-dockerfile.test.ts",
    anchor: "DEBIAN_SECURITY_REFRESH",
    topic: "Debian apt cache bust + OpenSSL dpkg floor in production image",
  },
  {
    path: "tests/docker/production-dockerfile.test.ts",
    anchor: "ensure-secure-adm-zip.mjs",
    topic: "Dockerfile copies adm-zip postinstall scripts before pnpm install",
  },
  {
    path: "tests/scripts/adm-zip-security-lib.test.ts",
    anchor: "listInsecureAdmZipInstalls",
    topic: "adm-zip CVE postinstall patch + lockfile/shrinkwrap floors",
  },
  {
    path: "tests/scripts/cve-dependency-pins.test.ts",
    anchor: "SECURE_BODY_PARSER_VERSION",
    topic: "body-parser, zod, fast-uri, ip-address, express-rate-limit CVE pins",
  },
  {
    path: "tests/scripts/http-framework-security-pins.test.ts",
    anchor: "SECURE_HONO_VERSION",
    topic: "hono, @hono/node-server, vite minimum versions",
  },
  {
    path: "tests/scripts/ip-address-security-lib.test.ts",
    anchor: "findActiveIpAddressInstallDirs",
    topic: "ip-address NAT64/ReDoS floor and linked-install detection",
  },
  {
    path: "tests/scripts/pnpm-lock-package-versions.test.ts",
    anchor: "parsePnpmLockPackageVersions",
    topic: "lockfile parser used by CVE pin regressions",
  },
  {
    path: "tests/security/regression-manifest.test.ts",
    anchor: "SECURITY_REGRESSION_GUARDS",
    topic: "manifest of security regression tests (this file)",
  },
];

describe("Security regression manifest", () => {
  it("lists every on-disk security guard test with a live anchor assertion", () => {
    const violations: string[] = [];

    for (const guard of SECURITY_REGRESSION_GUARDS) {
      const absolute = join(REPO_ROOT, guard.path);
      if (!existsSync(absolute)) {
        violations.push(`missing ${guard.path} (${guard.topic})`);
        continue;
      }
      const source = readFileSync(absolute, "utf8");
      if (!source.includes(guard.anchor)) {
        violations.push(`${guard.path} no longer contains anchor "${guard.anchor}" (${guard.topic})`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("keeps postinstall wired to adm-zip hardening for npm consumers", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: { postinstall?: string };
      files: string[];
    };
    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });
});
