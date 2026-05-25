import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type WorkflowStep = {
  name?: string;
  run?: string;
};

type ReleaseWorkflow = {
  jobs: {
    release: {
      steps: WorkflowStep[];
    };
  };
};

const root = process.cwd();

function readReleaseWorkflow(): ReleaseWorkflow {
  return parse(readFileSync(join(root, ".github/workflows/release.yml"), "utf8")) as ReleaseWorkflow;
}

function runScriptForStep(workflow: ReleaseWorkflow, stepName: string): string {
  const step = workflow.jobs.release.steps.find((candidate) => candidate.name === stepName);
  expect(step, `Expected release workflow to include step ${stepName}`).toBeDefined();
  expect(step?.run, `Expected release workflow step ${stepName} to run shell commands`).toBeDefined();
  return step?.run ?? "";
}

describe("release workflow", () => {
  it("does not fail when the package version is already published to npm", () => {
    const workflow = readReleaseWorkflow();
    const script = runScriptForStep(workflow, "Publish to npm");

    expect(script).toContain("npm view \"$PKG_NAME@$PKG_VERSION\" version");
    expect(script).toContain("npm publish");
    expect(script).toContain("already published");
  });

  it("does not fail when the GitHub Release already exists", () => {
    const workflow = readReleaseWorkflow();
    const script = runScriptForStep(workflow, "Create GitHub Release");

    expect(script).toContain("gh release view \"$GITHUB_REF_NAME\"");
    expect(script).toContain("gh release create \"$GITHUB_REF_NAME\"");
    expect(script).toContain("already exists");
  });
});
