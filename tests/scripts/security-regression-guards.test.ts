import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/** Security-sensitive artifacts and the vitest modules that guard them from regressions. */
const SECURITY_REGRESSION_GUARDS: ReadonlyArray<{
  artifact: string;
  testFile: string;
}> = [
  {
    artifact: "package.json pnpm.overrides (body-parser, zod, fast-uri, ip-address)",
    testFile: "tests/scripts/cve-dependency-pins.test.ts",
  },
  {
    artifact: "package.json pnpm.overrides (hono, @hono/node-server, vite)",
    testFile: "tests/scripts/http-framework-security-pins.test.ts",
  },
  {
    artifact: "package.json pnpm.overrides (proxy-addr, path-to-regexp via Express)",
    testFile: "tests/scripts/express-transitive-security-pins.test.ts",
  },
  {
    artifact: "package.json pnpm.overrides (qs, express-rate-limit on Express stack)",
    testFile: "tests/scripts/express-stack-security-pins.test.ts",
  },
  {
    artifact: "scripts/ip-address-security-lib.mjs (SECURE_IP_ADDRESS_VERSION floor)",
    testFile: "tests/scripts/ip-address-security-lib.test.ts",
  },
  {
    artifact: "scripts/adm-zip-security-lib.mjs and ensure-secure-adm-zip.mjs",
    testFile: "tests/scripts/adm-zip-security-lib.test.ts",
  },
  {
    artifact: "package.json adm-zip pins and npm publish files list",
    testFile: "tests/scripts/adm-zip-dependency-pins.test.ts",
  },
  {
    artifact: "npm global install postinstall wiring for adm-zip patch",
    testFile: "tests/scripts/npm-adm-zip-consumer-wiring.test.ts",
  },
  {
    artifact: "Dockerfile Debian OpenSSL floor and adm-zip COPY-before-install ordering",
    testFile: "tests/docker/production-dockerfile.test.ts",
  },
];

describe("security regression guard traceability", () => {
  it("every mapped guard test file exists on disk", () => {
    const missing: string[] = [];

    for (const { artifact, testFile } of SECURITY_REGRESSION_GUARDS) {
      const full = join(root, testFile);
      if (!existsSync(full)) {
        missing.push(`${artifact}: ${testFile}`);
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("runs every security guard in pnpm standards:check (CI architecture suite)", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const standardsCheck = packageJson.scripts["standards:check"];
    expect(standardsCheck, "expected scripts.standards:check").toBeTruthy();

    const notWired: string[] = [];
    for (const { artifact, testFile } of SECURITY_REGRESSION_GUARDS) {
      if (!standardsCheck.includes(testFile)) {
        notWired.push(`${artifact}: missing ${testFile}`);
      }
    }

    expect(notWired, notWired.join("\n")).toEqual([]);
  });
});
