import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECURITY_REGRESSION_GUARDS } from "./security-regression-guards.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

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
