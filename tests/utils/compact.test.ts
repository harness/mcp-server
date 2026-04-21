import { describe, it, expect } from "vitest";
import { compactItems } from "../../src/utils/compact.js";

describe("compactItems", () => {
  it("keeps identity fields", () => {
    const items = [{ identifier: "p1", name: "Pipeline 1", description: "A pipeline", slug: "p1" }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0]).toEqual({ identifier: "p1", name: "Pipeline 1", description: "A pipeline", slug: "p1" });
  });

  it("keeps status fields", () => {
    const items = [{ status: "Running", enabled: true, health: "good" }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0]).toEqual({ status: "Running", enabled: true, health: "good" });
  });

  it("keeps type fields", () => {
    const items = [{ type: "DockerRegistry", kind: "Connector", category: "cloud", module: "CD" }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0]).toEqual({ type: "DockerRegistry", kind: "Connector", category: "cloud", module: "CD" });
  });

  it("keeps ownership fields", () => {
    const items = [{ tags: ["prod"], labels: { env: "prod" }, owner: "alice", author: "bob" }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0]).toEqual({ tags: ["prod"], labels: { env: "prod" }, owner: "alice", author: "bob" });
  });

  it("keeps cost fields", () => {
    const items = [{
      cost: 150.50,
      costTrend: 5.2,
      idleCost: 20.0,
      unallocatedCost: 10.5,
      utilizedCost: 120.0,
      forecastCost: 180.0,
      actualCost: 145.0,
      budgetAmount: 200.0,
      totalMonthlyCost: 4500.0,
      totalMonthlySaving: 300.0,
    }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0]).toEqual({
      cost: 150.50,
      costTrend: 5.2,
      idleCost: 20.0,
      unallocatedCost: 10.5,
      utilizedCost: 120.0,
      forecastCost: 180.0,
      actualCost: 145.0,
      budgetAmount: 200.0,
      totalMonthlyCost: 4500.0,
      totalMonthlySaving: 300.0,
    });
  });

  it("keeps timestamp fields matching pattern", () => {
    const items = [{ createdAt: 1000, lastModifiedTs: 2000, startTime: 3000, updatedDate: "2025-01-01" }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0]).toEqual({ createdAt: 1000, lastModifiedTs: 2000, startTime: 3000, updatedDate: "2025-01-01" });
  });

  it("keeps identifier-like fields matching pattern", () => {
    const items = [{ pipelineIdentifier: "p1", projectId: "proj", env_id: "env1" }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0]).toEqual({ pipelineIdentifier: "p1", projectId: "proj", env_id: "env1" });
  });

  it("strips verbose metadata fields", () => {
    const items = [{
      identifier: "p1",
      name: "Pipeline",
      yaml: "pipeline:\n  ...",
      executionSummaryInfo: { deployments: [] },
      governanceMetadata: { rules: [] },
      gitDetails: { repoName: "repo" },
      storeType: "INLINE",
      connectorRef: "ref",
      entityValidityDetails: {},
    }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0]).toEqual({ identifier: "p1", name: "Pipeline" });
  });

  it("merges openInHarness into name as markdown link", () => {
    const items = [{ name: "My Pipeline", openInHarness: "https://app.harness.io/ng/pipelines/p1" }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0].name).toBe("[My Pipeline](https://app.harness.io/ng/pipelines/p1)");
    expect(result[0].openInHarness).toBeUndefined();
  });

  it("keeps openInHarness if name is absent", () => {
    const items = [{ identifier: "p1", openInHarness: "https://app.harness.io/ng/pipelines/p1" }];
    const result = compactItems(items) as Record<string, unknown>[];
    expect(result[0].openInHarness).toBe("https://app.harness.io/ng/pipelines/p1");
  });

  it("passes through non-object items unchanged", () => {
    const items = ["string", 42, null];
    expect(compactItems(items)).toEqual(["string", 42, null]);
  });

  it("handles empty array", () => {
    expect(compactItems([])).toEqual([]);
  });
});
