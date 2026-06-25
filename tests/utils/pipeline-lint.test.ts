import { describe, it, expect } from "vitest";
import { lintPipelineYaml, extractPipelineYaml, V1_STEP_TYPES } from "../../src/utils/pipeline-lint.js";
import v1PipelineSchema from "../../src/data/schemas/v1/pipeline.js";

// ---------------------------------------------------------------------------
// v0: trigger expression in codebase branch
// ---------------------------------------------------------------------------

describe("v0 — trigger expression in codebase branch", () => {
  it("warns (not errors) when branch uses <+trigger.branch>", () => {
    const yaml = `
pipeline:
  properties:
    ci:
      codebase:
        repoName: my-app
        build:
          type: branch
          spec:
            branch: <+trigger.branch>
  stages: []
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("<+trigger.branch>");
    expect(result.warnings[0]).toContain("null on manual runs");
  });

  it("warns when branch uses <+trigger.sourceBranch>", () => {
    const yaml = `
pipeline:
  properties:
    ci:
      codebase:
        repoName: my-app
        build:
          type: branch
          spec:
            branch: <+trigger.sourceBranch>
  stages: []
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("<+trigger.sourceBranch>");
  });

  it("does not warn when branch is a static value", () => {
    const yaml = `
pipeline:
  properties:
    ci:
      codebase:
        repoName: my-app
        build:
          type: branch
          spec:
            branch: main
  stages: []
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("does not warn when branch uses <+input>", () => {
    const yaml = `
pipeline:
  properties:
    ci:
      codebase:
        repoName: my-app
        build:
          type: branch
          spec:
            branch: <+input>
  stages: []
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("does not warn when there is no codebase section", () => {
    const yaml = `
pipeline:
  stages:
    - stage:
        identifier: deploy
        type: Deployment
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// v0: HAR field confusion (connectorRef vs registryRef)
// ---------------------------------------------------------------------------

describe("v0 — HAR field confusion", () => {
  it("errors when BuildAndPushDockerRegistry has both connectorRef and registryRef", () => {
    const yaml = `
pipeline:
  stages:
    - stage:
        type: CI
        spec:
          execution:
            steps:
              - step:
                  identifier: push
                  name: Push Image
                  type: BuildAndPushDockerRegistry
                  spec:
                    connectorRef: dockerhub
                    registryRef: my-registry
                    repo: my-app
                    tags:
                      - latest
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("both");
    expect(result.errors[0]).toContain("connectorRef");
    expect(result.errors[0]).toContain("registryRef");
    expect(result.warnings).toHaveLength(0);
  });

  it("does not warn when only registryRef is used (HAR)", () => {
    const yaml = `
pipeline:
  stages:
    - stage:
        type: CI
        spec:
          execution:
            steps:
              - step:
                  identifier: push
                  name: Push Image
                  type: BuildAndPushDockerRegistry
                  spec:
                    registryRef: my-registry
                    repo: my-app
                    tags:
                      - latest
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns (not errors) when only connectorRef is used (may be valid third-party)", () => {
    const yaml = `
pipeline:
  stages:
    - stage:
        type: CI
        spec:
          execution:
            steps:
              - step:
                  identifier: push
                  name: Push Image
                  type: BuildAndPushDockerRegistry
                  spec:
                    connectorRef: dockerhub
                    repo: myorg/my-app
                    tags:
                      - latest
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("connectorRef");
    expect(result.warnings[0]).toContain("registryRef");
    expect(result.warnings[0]).toContain("Harness Artifact Registry");
  });
});

// ---------------------------------------------------------------------------
// v0: codebase connector check (Harness Code vs third-party Git)
// ---------------------------------------------------------------------------

describe("v0 — codebase connector check", () => {
  it("errors when codebase has both connectorRef and repoName", () => {
    const yaml = `
pipeline:
  properties:
    ci:
      codebase:
        connectorRef: account.harnessCode
        repoName: my-app
        build:
          type: branch
          spec:
            branch: main
  stages: []
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors.some(e => e.includes("connectorRef") && e.includes("repoName"))).toBe(true);
    expect(result.errors.some(e => e.includes("mutually exclusive"))).toBe(true);
  });

  it("does not error when codebase has only repoName (Harness Code)", () => {
    const yaml = `
pipeline:
  properties:
    ci:
      codebase:
        repoName: my-app
        build:
          type: branch
          spec:
            branch: main
  stages: []
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toHaveLength(0);
  });

  it("does not error when codebase has only connectorRef (third-party Git)", () => {
    const yaml = `
pipeline:
  properties:
    ci:
      codebase:
        connectorRef: github_connector
        build:
          type: branch
          spec:
            branch: main
  stages: []
`;
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// v1: v0 step types in v1 pipeline
// ---------------------------------------------------------------------------

describe("v1 — v0 step types", () => {
  it("errors when K8sRollingDeploy is used in a v1 pipeline", () => {
    const yaml = `
pipeline:
  stages:
    - name: deploy
      service: my-svc
      environment: dev
      steps:
        - step:
            type: K8sRollingDeploy
            spec:
              skipDryRun: false
`;
    const result = lintPipelineYaml(yaml, "v1");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("K8sRollingDeploy");
    expect(result.errors[0]).toContain("v0 step type");
  });

  it("errors when BuildAndPushDockerRegistry is used in a v1 pipeline", () => {
    const yaml = `
pipeline:
  stages:
    - name: build
      steps:
        - step:
            type: BuildAndPushDockerRegistry
            spec:
              connectorRef: dockerhub
              repo: myorg/app
`;
    const result = lintPipelineYaml(yaml, "v1");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("BuildAndPushDockerRegistry");
  });

  it("reports multiple v0 step types in one error", () => {
    const yaml = `
pipeline:
  stages:
    - name: build-and-deploy
      steps:
        - step:
            type: BuildAndPushDockerRegistry
            spec:
              connectorRef: dockerhub
        - step:
            type: K8sRollingDeploy
            spec:
              skipDryRun: false
`;
    const result = lintPipelineYaml(yaml, "v1");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("BuildAndPushDockerRegistry");
    expect(result.errors[0]).toContain("K8sRollingDeploy");
  });

  it("does not error for valid v1 step types", () => {
    const yaml = `
pipeline:
  stages:
    - name: deploy
      service: my-svc
      environment: dev
      steps:
        - action:
            uses: kubernetes-rolling-deploy
            with:
              dry-run: false
`;
    const result = lintPipelineYaml(yaml, "v1");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Graceful failure
// ---------------------------------------------------------------------------

describe("graceful failure on unparseable YAML", () => {
  it("returns empty errors and warnings for v0 with broken YAML", () => {
    const yaml = "this: is: not: valid: yaml: [[[";
    const result = lintPipelineYaml(yaml, "v0");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("returns empty errors and warnings for v1 with empty string", () => {
    const result = lintPipelineYaml("", "v1");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractPipelineYaml helper
// ---------------------------------------------------------------------------

describe("extractPipelineYaml", () => {
  it("returns raw string body as-is", () => {
    expect(extractPipelineYaml("pipeline:\n  name: test")).toBe("pipeline:\n  name: test");
  });

  it("extracts yamlPipeline from object", () => {
    expect(extractPipelineYaml({ yamlPipeline: "pipeline:\n  name: test" })).toBe("pipeline:\n  name: test");
  });

  it("extracts pipeline_yaml from object", () => {
    expect(extractPipelineYaml({ pipeline_yaml: "pipeline:\n  name: test" })).toBe("pipeline:\n  name: test");
  });

  it("returns undefined for non-pipeline objects", () => {
    expect(extractPipelineYaml({ name: "test" })).toBeUndefined();
  });

  it("returns undefined for null/undefined", () => {
    expect(extractPipelineYaml(null)).toBeUndefined();
    expect(extractPipelineYaml(undefined)).toBeUndefined();
  });

  it("prefers yamlPipeline over pipeline_yaml", () => {
    expect(extractPipelineYaml({ yamlPipeline: "a", pipeline_yaml: "b" })).toBe("a");
  });
});

// ---------------------------------------------------------------------------
// V1_STEP_TYPES drift guard — keep the canonical list locked to the schema
// ---------------------------------------------------------------------------

/**
 * Pull the authoritative step keys out of the bundled v1 schema's StepItems
 * discriminator (definitions.pipeline_v1.steps.unified.StepItems.if.anyOf[].required[0]).
 * This is the single source the UI/converter validate against, so V1_STEP_TYPES
 * must match it exactly.
 */
function schemaStepKeys(): string[] {
  const stepItems =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (v1PipelineSchema as any).definitions.pipeline_v1.steps.unified.StepItems;
  const anyOf = stepItems.if.anyOf as Array<{ required?: string[] }>;
  return anyOf.map((e) => e.required?.[0]).filter((k): k is string => Boolean(k));
}

describe("V1_STEP_TYPES matches the bundled v1 schema", () => {
  it("contains exactly the schema's StepItems keys (no drift)", () => {
    expect([...V1_STEP_TYPES].sort()).toEqual(schemaStepKeys().sort());
  });

  it("does not include invalid step keys that misled v1 generation", () => {
    // Regression: createHint previously claimed `plugin`/`bitrise` were valid v1
    // step keys, and the resource description listed `agent` — none exist in v1.
    for (const bogus of ["plugin", "bitrise", "agent"]) {
      expect(V1_STEP_TYPES).not.toContain(bogus);
    }
  });
});
