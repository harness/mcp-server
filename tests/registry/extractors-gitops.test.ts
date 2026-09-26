import { describe, expect, it } from "vitest";
import {
  appProjMapExtract,
  argoProjectListExtract,
  autoCreateLogExtract,
  importReconcileExtract,
} from "../../src/registry/extractors.js";

describe("appProjMapExtract", () => {
  it("flattens appProjMap into list rows with argoproject key", () => {
    const raw = {
      appProjMap: {
        "team-a": {
          orgIdentifier: "default",
          projectIdentifier: "proj-a",
          autoCreateServiceEnv: true,
        },
        "team-b": {
          orgIdentifier: "default",
          projectIdentifier: "proj-b",
        },
      },
    };
    expect(appProjMapExtract(raw)).toEqual({
      items: [
        {
          argoproject: "team-a",
          orgIdentifier: "default",
          projectIdentifier: "proj-a",
          autoCreateServiceEnv: true,
        },
        {
          argoproject: "team-b",
          orgIdentifier: "default",
          projectIdentifier: "proj-b",
          autoCreateServiceEnv: false,
        },
      ],
      total: 2,
    });
  });

  it("returns empty list when appProjMap is missing or not an object", () => {
    expect(appProjMapExtract({})).toEqual({ items: [], total: 0 });
    expect(appProjMapExtract({ appProjMap: null })).toEqual({ items: [], total: 0 });
    expect(appProjMapExtract(null)).toEqual({ items: [], total: 0 });
  });
});

describe("argoProjectListExtract", () => {
  it("maps a bare array of AppProject protos to discovery rows", () => {
    const raw = [
      {
        metadata: { name: "team-a", creationTimestamp: "2024-01-02T00:00:00Z" },
        spec: { description: "Team A apps" },
      },
      { metadata: { name: "team-b" } },
    ];
    expect(argoProjectListExtract(raw)).toEqual({
      items: [
        { name: "team-a", description: "Team A apps", createdAt: "2024-01-02T00:00:00Z" },
        { name: "team-b" },
      ],
      total: 2,
    });
  });

  it("unwraps items[] envelope and synthesizes total when API omits it", () => {
    const raw = {
      items: [{ metadata: { name: "only-one" } }],
    };
    expect(argoProjectListExtract(raw)).toEqual({
      items: [{ name: "only-one" }],
      total: 1,
    });
  });

  it("preserves metadata when present on list responses", () => {
    const raw = {
      items: [],
      total: 0,
      metadata: { agentIdentifier: "account.agent1" },
    };
    expect(argoProjectListExtract(raw)).toEqual({
      items: [],
      total: 0,
      metadata: { agentIdentifier: "account.agent1" },
    });
  });
});

describe("importReconcileExtract", () => {
  it("hoists importRequestId and autoCreateCounts and drops nested reconcileAppResponse", () => {
    const raw = {
      importRequestId: "507f1f77bcf86cd799439011",
      applicationCount: 2,
      reconcileAppResponse: {
        autoCreateCounts: {
          serviceCount: 3,
          environmentCount: 1,
          clusterLinkCount: 0,
        },
      },
    };
    expect(importReconcileExtract(raw)).toEqual({
      importRequestId: "507f1f77bcf86cd799439011",
      applicationCount: 2,
      autoCreateCounts: {
        serviceCount: 3,
        environmentCount: 1,
        clusterLinkCount: 0,
      },
    });
  });

  it("returns safe defaults for malformed or empty API payloads", () => {
    expect(importReconcileExtract(null)).toEqual({
      importRequestId: "",
      autoCreateCounts: {
        serviceCount: 0,
        environmentCount: 0,
        clusterLinkCount: 0,
      },
    });
    expect(importReconcileExtract({ importRequestId: "  abc  " }).importRequestId).toBe("abc");
  });
});

describe("autoCreateLogExtract", () => {
  it("maps logs[] into harness_list shape with page aggregates", () => {
    const raw = {
      logs: [{ resourceType: "SERVICE", status: "SUCCESS" }],
      total: 1,
      successServices: 1,
      failedServices: 0,
    };
    expect(autoCreateLogExtract(raw)).toEqual({
      items: [{ resourceType: "SERVICE", status: "SUCCESS" }],
      total: 1,
      successServices: 1,
      failedServices: 0,
      successEnvironments: 0,
      failedEnvironments: 0,
      successClusterLinks: 0,
      failedClusterLinks: 0,
    });
  });

  it("defaults to empty items when response is not a record", () => {
    expect(autoCreateLogExtract(undefined)).toEqual({ items: [], total: 0 });
  });
});
