/**
 * Inventory of security / supply-chain regression guards.
 * Fails CI if a guard file is removed or stripped of its anchor assertions.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

type SecurityGuard = {
  /** Human-readable area (shown in failure output) */
  area: string;
  testPath: string;
  /** Substrings that must remain in the guard module */
  anchors: string[];
};

const SECURITY_GUARDS: SecurityGuard[] = [
  {
    area: "Production Docker image (Debian apt + OpenSSL floor)",
    testPath: "tests/docker/production-dockerfile.test.ts",
    anchors: ["DEBIAN_SECURITY_REFRESH", "libssl3", "3.0.22-1~deb12u2", "ensure-secure-adm-zip.mjs"],
  },
  {
    area: "adm-zip postinstall and nested onnxruntime copies",
    testPath: "tests/scripts/adm-zip-security-lib.test.ts",
    anchors: ["SECURE_ADM_ZIP_VERSION", "listInsecureAdmZipInstalls", "pnpm.overrides"],
  },
  {
    area: "Transitive CVE dependency pins (body-parser, zod, fast-uri, qs, proxy-addr)",
    testPath: "tests/scripts/cve-dependency-pins.test.ts",
    anchors: ["SECURE_ZOD_VERSION", "SECURE_FAST_URI_VERSION", "npm-shrinkwrap.json"],
  },
  {
    area: "HTTP framework pins (hono, @hono/node-server, vite)",
    testPath: "tests/scripts/http-framework-security-pins.test.ts",
    anchors: ["SECURE_HONO_VERSION", "SECURE_VITE_VERSION", "readInstalledPackageVersion"],
  },
  {
    area: "ip-address NAT64 / ReDoS floor and active install detection",
    testPath: "tests/scripts/ip-address-security-lib.test.ts",
    anchors: ["SECURE_IP_ADDRESS_VERSION", "listInsecureIpAddressInstalls", "64:ff9b:1::1"],
  },
  {
    area: "Service account multi-scope registry dispatch",
    testPath: "tests/registry/access-control-service-account.test.ts",
    anchors: ['resource_scope: "account"', "INCLUDE_CHILD_SCOPE_SERVICE_ACCOUNTS", "/ng/api/serviceaccount/aggregate"],
  },
  {
    area: "Service account list extractor flattening",
    testPath: "tests/registry/extractors-service-account.test.ts",
    anchors: ["flattenServiceAccountAggregate", "serviceAccountListExtract"],
  },
  {
    area: "Additional transitive pnpm security overrides",
    testPath: "tests/scripts/pnpm-transitive-security-overrides.test.ts",
    anchors: ["TRANSITIVE_SECURITY_OVERRIDES", "parsePnpmLockPackageVersions"],
  },
  {
    area: "npm-shrinkwrap metadata check (global npm install tree)",
    testPath: "tests/scripts/npm-shrinkwrap-check.test.ts",
    anchors: ["generate-npm-shrinkwrap.mjs", "--check", "npm-shrinkwrap.json metadata is up to date"],
  },
];

function parseOverrideFloor(specifier: string): string {
  const match = specifier.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
  expect(match, `expected numeric floor in override ${specifier}`).not.toBeNull();
  return match![1]!;
}

describe("security regression guard inventory", () => {
  it("every mapped guard module exists and keeps its anchor assertions", () => {
    const failures: string[] = [];

    for (const { area, testPath, anchors } of SECURITY_GUARDS) {
      const absolute = join(root, testPath);
      if (!existsSync(absolute)) {
        failures.push(`${area}: missing ${testPath}`);
        continue;
      }
      const content = readFileSync(absolute, "utf8");
      for (const anchor of anchors) {
        if (!content.includes(anchor)) {
          failures.push(`${area}: ${testPath} no longer contains anchor "${anchor}"`);
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("npm publish bundle runs adm-zip postinstall and ships security scripts", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
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

  it("documents every pnpm override floor in at least one guard module", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    const guardCorpus = SECURITY_GUARDS
      .map((guard) => readFileSync(join(root, guard.testPath), "utf8"))
      .join("\n");

    const missing: string[] = [];
    for (const [name, specifier] of Object.entries(packageJson.pnpm.overrides)) {
      const floor = parseOverrideFloor(specifier);
      const tokens = [name, floor, `"${name}"`, `'${name}'`];
      if (!tokens.some((token) => guardCorpus.includes(token))) {
        missing.push(`${name} (floor ${floor})`);
      }
    }

    expect(
      missing,
      `Add or extend a security guard test for:\n${missing.join("\n")}`,
    ).toEqual([]);
  });
});
