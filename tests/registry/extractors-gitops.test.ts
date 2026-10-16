import { describe, expect, it } from "vitest";
import {
  argoProjectListExtract,
  autoCreateLogExtract,
  importReconcileExtract,
} from "../../src/registry/extractors.js";

describe("importReconcileExtract", () => {
  it("flattens nested reconcileAppResponse and always returns autoCreateCounts", () => {
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
    expect(importReconcileExtract(raw)).not.toHaveProperty("reconcileAppResponse");
  });

  it("defaults missing or invalid counts to zero", () => {
    expect(
      importReconcileExtract({
        importRequestId: "abc",
        reconcileAppResponse: { autoCreateCounts: { serviceCount: "nope" } },
      }),
    ).toEqual({
      importRequestId: "abc",
      autoCreateCounts: {
        serviceCount: 0,
        environmentCount: 0,
        clusterLinkCount: 0,
      },
    });
  });

  it("returns safe empty handoff for non-object responses", () => {
    expect(importReconcileExtract(null)).toEqual({
      importRequestId: "",
      autoCreateCounts: {
        serviceCount: 0,
        environmentCount: 0,
        clusterLinkCount: 0,
      },
    });
  });
});

describe("autoCreateLogExtract", () => {
  it("maps logs array to items and preserves aggregate counters", () => {
    const raw = {
      logs: [{ resourceType: "SERVICE", status: "SUCCESS" }],
      total: 10,
      successServices: 1,
      failedServices: 0,
      successEnvironments: 0,
      failedEnvironments: 0,
      successClusterLinks: 0,
      failedClusterLinks: 0,
    };
    expect(autoCreateLogExtract(raw)).toEqual({
      items: [{ resourceType: "SERVICE", status: "SUCCESS" }],
      total: 10,
      successServices: 1,
      failedServices: 0,
      successEnvironments: 0,
      failedEnvironments: 0,
      successClusterLinks: 0,
      failedClusterLinks: 0,
    });
  });

  it("uses logs.length when total is omitted", () => {
    const raw = {
      logs: [{ id: 1 }, { id: 2 }],
    };
    expect(autoCreateLogExtract(raw)).toMatchObject({
      items: [{ id: 1 }, { id: 2 }],
      total: 2,
    });
  });

  it("returns empty list for non-object input", () => {
    expect(autoCreateLogExtract(undefined)).toEqual({ items: [], total: 0 });
  });
});

describe("argoProjectListExtract", () => {
  it("normalizes AgentProjectService rows from a paged envelope", () => {
    const raw = {
      items: [
        {
          metadata: { name: "team-a", creationTimestamp: "2026-01-01T00:00:00Z" },
          spec: { description: "Team A apps" },
        },
      ],
      total: 1,
    };
    expect(argoProjectListExtract(raw)).toEqual({
      items: [
        {
          name: "team-a",
          description: "Team A apps",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      total: 1,
    });
  });

  it("handles a bare array response", () => {
    const raw = [{ metadata: { name: "solo" }, spec: {} }];
    expect(argoProjectListExtract(raw)).toEqual({
      items: [{ name: "solo" }],
      total: 1,
    });
  });
});
