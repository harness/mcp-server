/**
 * Contract tests for pipeline_v1 example YAML.
 *
 * Agents copy these examples via harness_schema / harness_describe. PR #428 aligned
 * the starter examples with real Harness v1 converter output — these tests prevent
 * re-introducing v0 idioms or agent-pipeline-schema shapes into pipeline_v1 examples.
 */
import { describe, it, expect } from "vitest";
import * as YAML from "yaml";
import { getExample, getExamplesForResource } from "../../src/data/examples/index.js";
import "../../src/data/examples/load-all.js";

const V0_ANTI_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "v0 identifier field", pattern: /\bidentifier:/ },
  { label: "v0 type: run step", pattern: /^\s*type:\s*run\b/m },
  { label: "v0 type: agent step", pattern: /^\s*type:\s*agent\b/m },
  { label: "agent-pipeline schema mcp_servers", pattern: /\bmcp_servers:/ },
  { label: "v0 vm runtime pool", pattern: /^\s+vm:\s*$/m },
];

function parsePipelineYaml(yaml: string): Record<string, unknown> {
  const doc = YAML.parse(yaml) as Record<string, unknown>;
  expect(doc).toHaveProperty("pipeline");
  const pipeline = doc.pipeline;
  expect(pipeline).toBeTruthy();
  expect(typeof pipeline).toBe("object");
  return pipeline as Record<string, unknown>;
}

describe("pipeline_v1 example contracts", () => {
  const examples = getExamplesForResource("pipeline_v1");

  it("registers all pipeline_v1 examples", () => {
    expect(examples.length).toBeGreaterThanOrEqual(17);
    expect(examples.every((ex) => ex.resourceType === "pipeline_v1")).toBe(true);
  });

  it.each(examples.map((ex) => [ex.name, ex.yaml] as const))(
    "%s uses real v1 pipeline shape (not v0 or agent-pipeline schema idioms)",
    (_name, yaml) => {
      for (const { label, pattern } of V0_ANTI_PATTERNS) {
        expect(yaml, `found ${label}`).not.toMatch(pattern);
      }

      const pipeline = parsePipelineYaml(yaml);
      expect(pipeline.id, "pipeline must have id (not identifier)").toBeTruthy();
      expect(pipeline).not.toHaveProperty("identifier");
    },
  );

  it("minimal-v1 matches real converter output (shell runtime + run step)", () => {
    const ex = getExample("minimal-v1")!;
    const pipeline = parsePipelineYaml(ex.yaml);

    expect(pipeline.id).toBe("simple_build");
    expect(pipeline.clone).toEqual({ enabled: false });

    const stage = (pipeline.stages as unknown[])[0] as Record<string, unknown>;
    expect(stage.id).toBe("build");
    expect(stage.runtime).toEqual({ shell: true });

    const step = (stage.steps as unknown[])[0] as Record<string, unknown>;
    expect(step.id).toBe("build");
    expect(step.run).toMatchObject({ shell: "sh" });
    expect((step.run as Record<string, unknown>).script).toContain("npm test");
    expect(step).not.toHaveProperty("type");
    expect(step).not.toHaveProperty("spec");
  });

  it("agent-pipeline is a v1 CI pipeline with a container run step (not type: agent)", () => {
    const ex = getExample("agent-pipeline")!;
    const pipeline = parsePipelineYaml(ex.yaml);

    expect(pipeline.id).toBe("code_review_agent");
    expect(pipeline.inputs).toMatchObject({
      model: { type: "string", value: "claude-sonnet-4-6" },
    });

    const stage = (pipeline.stages as unknown[])[0] as Record<string, unknown>;
    expect(stage.runtime).toHaveProperty("kubernetes");

    const step = (stage.steps as unknown[])[0] as Record<string, unknown>;
    expect(step.id).toBe("code_review");
    expect(step.run).toMatchObject({
      shell: "sh",
      container: { image: "harness/agent-cli:latest" },
    });
    expect((step.run as Record<string, unknown>).script).toContain("agent review");
    expect(step).not.toHaveProperty("type");
    expect(step).not.toHaveProperty("mcp_servers");
  });

  it("ci-docker-build-v1 uses kubernetes runtime (not vm pool)", () => {
    const ex = getExample("ci-docker-build-v1")!;
    const pipeline = parsePipelineYaml(ex.yaml);

    expect(pipeline.id).toBe("backend_container_build");

    const stage = (pipeline.stages as unknown[])[0] as Record<string, unknown>;
    expect(stage.runtime).toHaveProperty("kubernetes");
    expect(stage.runtime).not.toHaveProperty("vm");
    expect((stage.runtime as Record<string, unknown>).kubernetes).toMatchObject({
      os: "Linux",
    });
  });
});
