import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type WorkflowStep = {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, string>;
  "working-directory"?: string;
};

type ReleaseWorkflow = {
  on: {
    push: { tags: string[] };
    workflow_dispatch: {
      inputs: { release_tag: { required: boolean; type: string } };
    };
  };
  jobs: {
    release: {
      if: string;
      steps: WorkflowStep[];
    };
    mcpb: {
      if: string;
      needs: string;
      steps: WorkflowStep[];
    };
  };
};

const root = process.cwd();

function readReleaseWorkflow(): ReleaseWorkflow {
  return parse(readFileSync(join(root, ".github/workflows/release.yml"), "utf8")) as ReleaseWorkflow;
}

function runScriptForStep(
  workflow: ReleaseWorkflow,
  jobName: keyof ReleaseWorkflow["jobs"],
  stepName: string,
): string {
  const step = workflow.jobs[jobName].steps.find((candidate) => candidate.name === stepName);
  expect(step, `Expected release workflow to include step ${stepName}`).toBeDefined();
  expect(step?.run, `Expected release workflow step ${stepName} to run shell commands`).toBeDefined();
  return step?.run ?? "";
}

describe("release workflow", () => {
  it("does not fail when the package version is already published to npm", () => {
    const workflow = readReleaseWorkflow();
    const script = runScriptForStep(workflow, "release", "Publish to npm");

    expect(script).toContain("npm view \"$PKG_NAME@$PKG_VERSION\" version");
    expect(script).toContain("npm publish");
    expect(script).toContain("already published");
  });

  it("does not fail when the GitHub Release already exists", () => {
    const workflow = readReleaseWorkflow();
    const script = runScriptForStep(workflow, "release", "Create GitHub Release");

    expect(script).toContain("gh release view \"$GITHUB_REF_NAME\"");
    expect(script).toContain("gh release create \"$GITHUB_REF_NAME\"");
    expect(script).toContain("already exists");
  });

  it("publishes versioned MCPB assets for tags and exact-tag backfills", () => {
    const workflow = readReleaseWorkflow();
    const verifyTag = runScriptForStep(workflow, "mcpb", "Verify release tag");
    const verifyVersion = runScriptForStep(workflow, "mcpb", "Verify package version");
    const build = runScriptForStep(workflow, "mcpb", "Build and validate MCPB");
    const upload = runScriptForStep(workflow, "mcpb", "Upload MCPB to GitHub Release");
    const installDeps = workflow.jobs.mcpb.steps.find(
      (step) => step.name === "Install release dependencies",
    );
    const packagingCheckout = workflow.jobs.mcpb.steps.find(
      (step) => step.name === "Check out packaging tooling",
    );
    const sourceCheckout = workflow.jobs.mcpb.steps.find(
      (step) => step.name === "Check out release source",
    );

    expect(workflow.on.push.tags).toEqual(["v*.*.*"]);
    expect(workflow.on.workflow_dispatch.inputs.release_tag).toMatchObject({
      required: true,
      type: "string",
    });
    expect(workflow.jobs.release.if).toBe("github.event_name == 'push'");
    expect(workflow.jobs.mcpb.needs).toBe("release");
    expect(workflow.jobs.mcpb.if).toContain("always()");
    expect(workflow.jobs.mcpb.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow.jobs.mcpb.if).toContain("needs.release.result == 'success'");
    expect(verifyTag).toContain("^v[0-9]+");
    expect(verifyTag).toContain('gh release view "$RELEASE_TAG"');
    expect(packagingCheckout?.with?.path).toBe(".packaging-tools");
    expect(sourceCheckout?.with?.ref).toBe("${{ env.RELEASE_TAG }}");
    expect(sourceCheckout?.with?.path).toBe("release-source");
    expect(installDeps?.["working-directory"]).toBe("release-source");
    expect(verifyVersion).toContain('PACKAGE_VERSION=$(node -p');
    expect(verifyVersion).toContain('TAG_VERSION="${RELEASE_TAG#v}"');
    expect(build).toContain("--source-dir release-source");
    expect(build).toContain("--output-dir artifacts");
    expect(build).toContain("harness-mcp-server-${RELEASE_TAG#v}.mcpb");
    expect(upload).toContain('gh release upload "$RELEASE_TAG" "$MCPB_ASSET"');
    expect(upload).toContain("--clobber");
  });

  it("derives RELEASE_TAG from dispatch input or pushed tag", () => {
    const workflow = readReleaseWorkflow();
    const workflowYaml = readFileSync(join(root, ".github/workflows/release.yml"), "utf8");

    expect(workflowYaml).toContain(
      "RELEASE_TAG: ${{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name }}",
    );
    expect(workflow.jobs.mcpb.if).toContain("workflow_dispatch");
  });
});
