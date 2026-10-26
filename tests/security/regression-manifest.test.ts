/**
 * Cross-links production security anchors to the Vitest files that guard them.
 * Fails when a CVE/container fix is removed from source without updating tests.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

type RegressionAnchor = {
  description: string;
  productionPath: string;
  mustInclude: string | RegExp;
  guardedBy: string;
};

const REGRESSION_ANCHORS: RegressionAnchor[] = [
  {
    description: "production image OpenSSL/libssl apt floor",
    productionPath: "Dockerfile",
    mustInclude: "3.0.22-1~deb12u2",
    guardedBy: "tests/scripts/dockerfile-production-security.test.ts",
  },
  {
    description: "Debian security refresh busts stale apt layer cache",
    productionPath: "Dockerfile",
    mustInclude: /ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/,
    guardedBy: "tests/scripts/dockerfile-production-security.test.ts",
  },
  {
    description: "adm-zip scripts staged before pnpm install in image build",
    productionPath: "Dockerfile",
    mustInclude: "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/",
    guardedBy: "tests/scripts/dockerfile-production-security.test.ts",
  },
  {
    description: "postinstall enforces adm-zip before onnxruntime consumers load",
    productionPath: "package.json",
    mustInclude: "node scripts/ensure-secure-adm-zip.mjs",
    guardedBy: "tests/coding-standards/security-regression-map.test.ts",
  },
  {
    description: "ip-address transitive floor in pnpm overrides",
    productionPath: "package.json",
    mustInclude: '"ip-address": ">=10.7.4"',
    guardedBy: "tests/scripts/ip-address-security-lib.test.ts",
  },
  {
    description: "Hono HTTP framework security override (#1144)",
    productionPath: "package.json",
    mustInclude: '"hono": ">=4.13.11"',
    guardedBy: "tests/scripts/http-framework-security-pins.test.ts",
  },
  {
    description: "express-rate-limit floor for MCP SDK transitive dependency",
    productionPath: "package.json",
    mustInclude: '"express-rate-limit": ">=8.2.2"',
    guardedBy: "tests/scripts/cve-dependency-pins.test.ts",
  },
  {
    description: "npm publish ships adm-zip hardening scripts for global installs",
    productionPath: "package.json",
    mustInclude: "scripts/ensure-secure-adm-zip.mjs",
    guardedBy: "tests/scripts/npm-shrinkwrap-security.test.ts",
  },
];

describe("Security regression — production anchor manifest", () => {
  it("every anchor is present in production sources and has a living guard test", () => {
    const violations: string[] = [];

    for (const anchor of REGRESSION_ANCHORS) {
      const prodPath = join(REPO_ROOT, anchor.productionPath);
      const testPath = join(REPO_ROOT, anchor.guardedBy);

      if (!existsSync(testPath)) {
        violations.push(`${anchor.description}: missing guard ${anchor.guardedBy}`);
        continue;
      }
      if (!existsSync(prodPath)) {
        violations.push(`${anchor.description}: missing production file ${anchor.productionPath}`);
        continue;
      }

      const content = readFileSync(prodPath, "utf8");
      const matches =
        typeof anchor.mustInclude === "string"
          ? content.includes(anchor.mustInclude)
          : anchor.mustInclude.test(content);

      if (!matches) {
        violations.push(
          `${anchor.description}: ${anchor.productionPath} no longer contains expected anchor`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("package.json files array publishes adm-zip hardening scripts with the tarball", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      files: string[];
    };
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
        "npm-shrinkwrap.json",
      ]),
    );
  });
});
