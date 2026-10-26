/**
 * Guards supply-chain and release checks that live outside tests/coding-standards/
 * but must not be dropped from CI or publish workflows.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type CiWorkflow = {
  jobs: {
    "build-and-test": {
      steps: Array<{ run?: string }>;
    };
  };
};

describe("Coding standards — security regression guards", () => {
  it("CI runs npm-shrinkwrap:check after build and before the Vitest suite", () => {
    const workflow = parse(
      readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8"),
    ) as CiWorkflow;

    const runs = workflow.jobs["build-and-test"].steps
      .map((step) => step.run)
      .filter((run): run is string => typeof run === "string");

    const buildIdx = runs.findIndex((run) => run.includes("pnpm build"));
    const shrinkwrapIdx = runs.findIndex((run) => run.includes("pnpm npm-shrinkwrap:check"));
    const testIdx = runs.findIndex((run) => run.includes("pnpm test"));

    expect(buildIdx, "expected pnpm build in CI").toBeGreaterThanOrEqual(0);
    expect(shrinkwrapIdx, "expected pnpm npm-shrinkwrap:check in CI").toBeGreaterThanOrEqual(0);
    expect(testIdx, "expected pnpm test in CI").toBeGreaterThanOrEqual(0);
    expect(buildIdx).toBeLessThan(shrinkwrapIdx);
    expect(shrinkwrapIdx).toBeLessThan(testIdx);
  });

  it("prepublishOnly blocks npm publish when shrinkwrap metadata is stale", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: { prepublishOnly?: string };
    };

    expect(packageJson.scripts.prepublishOnly).toContain("pnpm build");
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm npm-shrinkwrap:check");
  });

  it("documents shrinkwrap drift checks in the enforcement map", () => {
    const mapSource = readFileSync(
      join(REPO_ROOT, "tests/coding-standards/enforcement-map.test.ts"),
      "utf8",
    );

    expect(mapSource).toContain("tests/scripts/npm-shrinkwrap-check.test.ts");
  });
});
