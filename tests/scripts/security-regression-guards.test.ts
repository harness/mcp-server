/**
 * Inventory of automated guards for security pins, container hardening, and
 * service-account response shaping. Prevents accidental deletion during refactors.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

type SecurityGuard = {
  area: string;
  tests: string[];
};

const SECURITY_REGRESSION_GUARDS: SecurityGuard[] = [
  {
    area: "CVE dependency pins (lockfile, shrinkwrap, overrides)",
    tests: ["tests/scripts/cve-dependency-pins.test.ts"],
  },
  {
    area: "HTTP framework pins (hono, vite)",
    tests: ["tests/scripts/http-framework-security-pins.test.ts"],
  },
  {
    area: "Transitive HTTP stack pins (express-rate-limit, proxy-addr)",
    tests: ["tests/scripts/transitive-security-pins.test.ts"],
  },
  {
    area: "ip-address install discovery and semver floor",
    tests: ["tests/scripts/ip-address-security-lib.test.ts"],
  },
  {
    area: "adm-zip postinstall repair and symlink extraction guard",
    tests: ["tests/scripts/adm-zip-security-lib.test.ts"],
  },
  {
    area: "Production Debian/OpenSSL Trivy gates",
    tests: ["tests/docker/production-dockerfile.test.ts", "tests/docker/dockerfile-adm-zip-postinstall.test.ts"],
  },
  {
    area: "Service account aggregate flattening and list totals",
    tests: [
      "tests/registry/extractors-service-account.test.ts",
      "tests/registry/access-control-service-account.test.ts",
    ],
  },
];

describe("security regression guard inventory", () => {
  it("lists every guard test file on disk", () => {
    const allTests = [...new Set(SECURITY_REGRESSION_GUARDS.flatMap((g) => g.tests))];
    const missing = allTests.filter((path) => !existsSync(join(REPO_ROOT, path)));
    expect(missing, `Missing security guard tests:\n${missing.join("\n")}`).toEqual([]);
  });

  it("each guard file contains at least one vitest describe block", () => {
    for (const path of SECURITY_REGRESSION_GUARDS.flatMap((g) => g.tests)) {
      const source = readFileSync(join(REPO_ROOT, path), "utf8");
      expect(source, `${path} should define vitest suites`).toMatch(/\bdescribe\s*\(/);
    }
  });

  it("package.json wires adm-zip postinstall and ships security scripts in the npm tarball", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      files: string[];
      scripts: Record<string, string>;
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
