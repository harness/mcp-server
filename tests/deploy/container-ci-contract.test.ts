/**
 * CI workflow contract tests for the container-build job.
 *
 * Guards the vulnerability gate and production-image smoke checks added when
 * hardening the container runtime — these only run in CI today, so unit tests
 * keep the shell/YAML contract from drifting silently.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type WorkflowStep = {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, string>;
};

type CiWorkflow = {
  jobs: {
    "container-build": {
      steps: WorkflowStep[];
    };
  };
};

const REPO_ROOT = join(import.meta.dirname, "../..");

function readCiWorkflow(): CiWorkflow {
  const content = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
  return parse(content) as CiWorkflow;
}

function stepByName(workflow: CiWorkflow, name: string): WorkflowStep {
  const step = workflow.jobs["container-build"].steps.find((candidate) => candidate.name === name);
  expect(step, `Expected container-build step "${name}"`).toBeDefined();
  return step!;
}

describe("CI container-build job contract", () => {
  const workflow = readCiWorkflow();

  it("pulls base images before building to avoid stale layer caches", () => {
    const buildStep = stepByName(workflow, "Build container image without publishing");
    expect(buildStep.with?.pull).toBe(true);
  });

  it("blocks fixable critical and high vulnerabilities with Trivy", () => {
    const trivy = stepByName(workflow, "Block fixable critical and high vulnerabilities");
    expect(trivy.uses).toBe("aquasecurity/trivy-action@0.36.0");
    expect(trivy.with).toMatchObject({
      "image-ref": "harness-mcp-server:ci",
      "exit-code": "1",
      "ignore-unfixed": true,
      severity: "CRITICAL,HIGH",
    });
    expect(trivy.with?.["vuln-type"]).toBe("os,library");
  });

  it("rejects production images that still ship package managers", () => {
    const script = stepByName(workflow, "Verify production image excludes package managers").run ?? "";
    for (const command of ["npm", "npx", "corepack", "pnpm", "yarn", "yarnpkg"]) {
      expect(script).toContain(command);
    }
    expect(script).toContain('docker run --rm --entrypoint "$command"');
    expect(script).toContain("Production image unexpectedly contains");
  });

  it("smoke-tests published HTTP health and unauthenticated MCP rejection", () => {
    const script = stepByName(workflow, "Smoke test HTTP reachability and auth").run ?? "";
    expect(script).toContain("--publish 3000:3000");
    expect(script).toContain("HARNESS_MCP_AUTH_TOKEN=ci-smoke-token");
    expect(script).toContain("http://127.0.0.1:3000/health");
    expect(script).toContain("--request POST http://127.0.0.1:3000/mcp");
    expect(script).toContain('test "$status" = "401"');
  });
});
