/**
 * Security regression suites must exist and stay wired into standards:check where required.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FULL_TEST_SECURITY_PATHS,
  SECURITY_REGRESSION_SUITES,
  STANDARDS_CHECK_PATHS,
} from "./security-regression-map.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Security regression map", () => {
  it("every mapped security test file exists", () => {
    const missing: string[] = [];
    for (const suite of SECURITY_REGRESSION_SUITES) {
      for (const rel of suite.tests) {
        if (!existsSync(join(REPO_ROOT, rel))) {
          missing.push(rel);
        }
      }
    }
    expect(missing, `Missing security regression tests: ${missing.join(", ")}`).toEqual([]);
  });

  it("standards:check includes every STANDARDS_CHECK_PATHS entry", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: { "standards:check": string };
    };
    const script = packageJson.scripts["standards:check"];
    for (const path of STANDARDS_CHECK_PATHS) {
      expect(script, `standards:check must include ${path}`).toContain(path);
    }
  });

  it("full-test security paths are distinct from standards:check paths", () => {
    const standards = new Set(STANDARDS_CHECK_PATHS);
    for (const path of FULL_TEST_SECURITY_PATHS) {
      expect(standards.has(path as (typeof STANDARDS_CHECK_PATHS)[number])).toBe(false);
    }
  });

  it("maps at least Docker, CVE pins, adm-zip, and service account coverage", () => {
    const topics = SECURITY_REGRESSION_SUITES.map((s) => s.topic).join("\n");
    expect(topics).toMatch(/Docker/i);
    expect(topics).toMatch(/CVE/i);
    expect(topics).toMatch(/adm-zip/i);
    expect(topics).toMatch(/service account/i);
  });
});
