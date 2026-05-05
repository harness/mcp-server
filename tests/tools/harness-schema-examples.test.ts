import { describe, it, expect } from "vitest";
import { getExample, searchExamples, getExamplesForResource } from "../../src/data/examples/index.js";
import "../../src/data/examples/pipeline.js";
import "../../src/data/examples/pipeline-v1.js";

describe("example registry", () => {
  it("getExample returns undefined for non-existent example", () => {
    expect(getExample("nonexistent")).toBeUndefined();
  });

  it("searchExamples returns empty array for no matches", () => {
    expect(searchExamples("zzz_no_match_zzz")).toEqual([]);
  });

  it("getExamplesForResource returns empty array for unknown resource type", () => {
    expect(getExamplesForResource("unknown_type")).toEqual([]);
  });
});

describe("pipeline v0 examples", () => {
  it("getExample('minimal-ci') returns a valid example", () => {
    const ex = getExample("minimal-ci");
    expect(ex).toBeDefined();
    expect(ex!.resourceType).toBe("pipeline");
    expect(ex!.yaml).toContain("pipeline:");
  });

  it("searchExamples('docker') finds docker-build example", () => {
    const results = searchExamples("docker");
    expect(results.some((r) => r.name === "docker-build")).toBe(true);
  });

  it("getExamplesForResource('pipeline') returns all v0 examples", () => {
    const results = getExamplesForResource("pipeline");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every((r) => r.resourceType === "pipeline")).toBe(true);
  });
});

describe("pipeline v1 examples", () => {
  it("getExample('minimal-v1') returns a valid v1 example", () => {
    const ex = getExample("minimal-v1");
    expect(ex).toBeDefined();
    expect(ex!.resourceType).toBe("pipeline_v1");
    expect(ex!.yaml).toContain("pipeline:");
  });

  it("getExample('agent-pipeline') returns an agent pipeline example", () => {
    const ex = getExample("agent-pipeline");
    expect(ex).toBeDefined();
    expect(ex!.resourceType).toBe("pipeline_v1");
    expect(ex!.tags).toContain("agent");
  });

  it("searchExamples('agent') finds agent-pipeline", () => {
    const results = searchExamples("agent");
    expect(results.some((r) => r.name === "agent-pipeline")).toBe(true);
  });

  it("getExamplesForResource('pipeline_v1') returns only v1 examples", () => {
    const results = getExamplesForResource("pipeline_v1");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every((r) => r.resourceType === "pipeline_v1")).toBe(true);
  });
});
