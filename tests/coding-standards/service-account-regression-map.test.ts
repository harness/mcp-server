/**
 * Guards regression tests for account/org-scoped service account list/get/create/delete (#1152).
 * Prevents removing scope or extractor coverage without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Vitest files that lock service account scope and response shaping behavior. */
export const SERVICE_ACCOUNT_REGRESSION_TEST_FILES = [
  "tests/registry/access-control-service-account.test.ts",
  "tests/registry/extractors-service-account.test.ts",
] as const;

/** Production modules that must keep aggregate flattening and multi-scope routing. */
const SERVICE_ACCOUNT_REGRESSION_SOURCE_FILES = [
  "src/registry/extractors.ts",
  "src/registry/toolsets/access-control.ts",
] as const;

describe("Service account scope — enforcement map", () => {
  it("every service account regression test file exists", () => {
    for (const rel of SERVICE_ACCOUNT_REGRESSION_TEST_FILES) {
      expect(existsSync(join(REPO_ROOT, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it("every mapped production module exists", () => {
    for (const rel of SERVICE_ACCOUNT_REGRESSION_SOURCE_FILES) {
      expect(existsSync(join(REPO_ROOT, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it("service_account list still uses the aggregate extractor and multi-scope supportedScopes", () => {
    const accessControl = readFileSync(join(REPO_ROOT, "src/registry/toolsets/access-control.ts"), "utf8");
    expect(accessControl).toContain("serviceAccountListExtract");
    expect(accessControl).toMatch(/supportedScopes:\s*\[[^\]]*"account"/);
    expect(accessControl).toContain("/ng/api/serviceaccount/aggregate");
  });

  it("extractors module exports service account list flattening helpers", () => {
    const extractors = readFileSync(join(REPO_ROOT, "src/registry/extractors.ts"), "utf8");
    expect(extractors).toContain("export function flattenServiceAccountAggregate");
    expect(extractors).toContain("export const serviceAccountListExtract");
  });
});
