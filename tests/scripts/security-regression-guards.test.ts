/**
 * Maps security-sensitive artifacts to automated guard tests.
 * If you change Dockerfile pins, postinstall wiring, or CVE overrides, update this map.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type GuardRow = {
  artifact: string;
  tests: string[];
};

const SECURITY_REGRESSION_GUARDS: GuardRow[] = [
  {
    artifact: "Production Dockerfile (Debian/OpenSSL/adm-zip install order)",
    tests: ["tests/docker/production-dockerfile.test.ts"],
  },
  {
    artifact: "adm-zip postinstall patch library and symlink traversal guard",
    tests: ["tests/scripts/adm-zip-security-lib.test.ts"],
  },
  {
    artifact: "ip-address NAT64 / semver security floor",
    tests: ["tests/scripts/ip-address-security-lib.test.ts"],
  },
  {
    artifact: "Runtime CVE dependency overrides (body-parser, zod, fast-uri, ip-address)",
    tests: ["tests/scripts/cve-dependency-pins.test.ts"],
  },
  {
    artifact: "HTTP framework pins (hono, @hono/node-server, vite)",
    tests: ["tests/scripts/http-framework-security-pins.test.ts"],
  },
  {
    artifact: "Transitive build/parser toolchain pins",
    tests: ["tests/scripts/transitive-security-pins.test.ts"],
  },
  {
    artifact: "Service account list flattening (account/org scope)",
    tests: [
      "tests/registry/extractors-service-account.test.ts",
      "tests/registry/access-control-service-account.test.ts",
    ],
  },
  {
    artifact: "npm consumer adm-zip wiring (postinstall, shrinkwrap, packaged files)",
    tests: ["tests/scripts/npm-adm-zip-consumer-wiring.test.ts"],
  },
];

describe("security regression guards — artifact map", () => {
  it("every mapped artifact points at existing guard test files", () => {
    const missing: string[] = [];
    for (const row of SECURITY_REGRESSION_GUARDS) {
      for (const testFile of row.tests) {
        const full = join(REPO_ROOT, testFile);
        if (!existsSync(full)) {
          missing.push(`${row.artifact} → missing ${testFile}`);
        }
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("covers container, npm consumer, and dependency-pin surfaces", () => {
    const artifacts = SECURITY_REGRESSION_GUARDS.map((row) => row.artifact).join("\n");
    expect(artifacts).toMatch(/Dockerfile/);
    expect(artifacts).toMatch(/npm consumer/);
    expect(artifacts).toMatch(/CVE dependency/);
  });
});
