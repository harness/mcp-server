import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ciWorkflowPath = join(root, ".github/workflows/ci.yml");

type CiWorkflow = {
  jobs: Record<
    string,
    {
      steps?: Array<{ run?: string; name?: string; uses?: string }>;
      needs?: string | string[];
    }
  >;
};

function readCiWorkflow(): CiWorkflow {
  return parse(readFileSync(ciWorkflowPath, "utf8")) as CiWorkflow;
}

function shellRuns(workflow: CiWorkflow, jobName: string): string[] {
  const job = workflow.jobs[jobName];
  expect(job, `expected CI job ${jobName}`).toBeDefined();
  return (job.steps ?? [])
    .map((step) => step.run)
    .filter((run): run is string => typeof run === "string");
}

describe("CI workflow guardrails", () => {
  const workflow = readCiWorkflow();

  it("runs security and architecture checks in build-and-test after install and build", () => {
    const runs = shellRuns(workflow, "build-and-test");
    const installIndex = runs.findIndex((run) => run.includes("pnpm install"));
    const buildIndex = runs.findIndex((run) => run === "pnpm build");
    const shrinkwrapIndex = runs.findIndex((run) => run === "pnpm npm-shrinkwrap:check");
    const testIndex = runs.findIndex((run) => run === "pnpm test");
    const standardsIndex = runs.findIndex((run) => run === "pnpm standards:check");

    expect(installIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(installIndex);
    expect(shrinkwrapIndex).toBeGreaterThan(buildIndex);
    expect(testIndex).toBeGreaterThan(shrinkwrapIndex);
    expect(standardsIndex).toBeGreaterThan(testIndex);
    expect(runs).toContain("pnpm typecheck");
    expect(runs).toContain("pnpm docs:check");
  });

  it("builds the production container image on every CI run", () => {
    const job = workflow.jobs["container-build"];
    expect(job).toBeDefined();
    const buildStep = job.steps?.find((step) => step.name?.includes("Build container"));
    expect(buildStep?.uses).toBe("docker/build-push-action@v7");
  });

  it("smoke-tests MCP stdio startup after the main test job", () => {
    const job = workflow.jobs["smoke-test"];
    expect(job?.needs).toBe("build-and-test");
    const runs = shellRuns(workflow, "smoke-test");
    expect(runs.some((run) => run.includes("scripts/smoke-test.js"))).toBe(true);
  });
});
