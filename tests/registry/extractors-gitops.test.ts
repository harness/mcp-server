import { describe, expect, it } from "vitest";
import {
  appProjMapExtract,
  argoProjectListExtract,
  autoCreateLogExtract,
  importReconcileExtract,
} from "../../src/registry/extractors.js";

describe("appProjMapExtract", () => {
  it("flattens appProjMap keys into list rows with defaults", () => {
    expect(
      appProjMapExtract({
        appProjMap: {
          "team-a": { orgIdentifier: "default", projectIdentifier: "proj-a" },
          "team-b": { orgIdentifier: "o", projectIdentifier: "p", autoCreateServiceEnv: true },
        },
      }),
    ).toEqual({
      items: [
        {
          argoproject: "team-a",
          orgIdentifier: "default",
          projectIdentifier: "proj-a",
          autoCreateServiceEnv: false,
        },
        {
          argoproject: "team-b",
          orgIdentifier: "o",
          projectIdentifier: "p",
          autoCreateServiceEnv: true,
        },
      ],
      total: 2,
    });
  });

  it("returns empty items when envelope is missing or malformed", () => {
    expect(appProjMapExtract(null)).toEqual({ items: [], total: 0 });
    expect(appProjMapExtract({})).toEqual({ items: [], total: 0 });
    expect(appProjMapExtract({ appProjMap: "not-a-map" })).toEqual({ items: [], total: 0 });
  });
});

describe("argoProjectListExtract", () => {
  it("projects AppProject proto rows and preserves metadata", () => {
    expect(
      argoProjectListExtract({
        items: [
          {
            metadata: { name: "team-a", creationTimestamp: "2026-03-23T08:33:26Z" },
            spec: { description: "Team A" },
          },
        ],
        metadata: { resourceVersion: "rv-1" },
      }),
    ).toEqual({
      items: [
        {
          name: "team-a",
          description: "Team A",
          createdAt: "2026-03-23T08:33:26Z",
        },
      ],
      total: 1,
      metadata: { resourceVersion: "rv-1" },
    });
  });

  it("accepts a bare array response and synthesizes total from length", () => {
    expect(
      argoProjectListExtract([
        { metadata: { name: "p1" }, spec: {} },
        { metadata: { name: "p2" }, spec: { description: "two" } },
      ]),
    ).toEqual({
      items: [{ name: "p1" }, { name: "p2", description: "two" }],
      total: 2,
    });
  });

  it("prefers API total when present and omits empty optional fields", () => {
    expect(
      argoProjectListExtract({
        items: [{ metadata: { name: "only-name" }, spec: { description: "" } }],
        total: 99,
      }),
    ).toEqual({
      items: [{ name: "only-name" }],
      total: 99,
    });
  });

  it("handles non-object responses", () => {
    expect(argoProjectListExtract(undefined)).toEqual({ items: [], total: 0 });
  });
});

describe("importReconcileExtract", () => {
  it("flattens reconcileAppResponse counts and drops nested envelope", () => {
    expect(
      importReconcileExtract({
        importRequestId: "  req-1  ",
        applicationCount: 2,
        reconcileAppResponse: {
          autoCreateCounts: {
            serviceCount: 1,
            environmentCount: 2,
            clusterLinkCount: 3,
          },
        },
      }),
    ).toEqual({
      importRequestId: "req-1",
      applicationCount: 2,
      autoCreateCounts: {
        serviceCount: 1,
        environmentCount: 2,
        clusterLinkCount: 3,
      },
    });
  });

  it("defaults missing or invalid nested counts to zero", () => {
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

  it("returns safe defaults for non-object responses", () => {
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
  it("maps logs to items and preserves page aggregates", () => {
    expect(
      autoCreateLogExtract({
        logs: [{ resourceType: "service", status: "FAILED" }],
        total: 1,
        successServices: 0,
        failedServices: 1,
        successEnvironments: 0,
        failedEnvironments: 0,
        successClusterLinks: 0,
        failedClusterLinks: 0,
      }),
    ).toEqual({
      items: [{ resourceType: "service", status: "FAILED" }],
      total: 1,
      successServices: 0,
      failedServices: 1,
      successEnvironments: 0,
      failedEnvironments: 0,
      successClusterLinks: 0,
      failedClusterLinks: 0,
    });
  });

  it("synthesizes total from logs length when API omits total", () => {
    expect(
      autoCreateLogExtract({
        logs: [{ status: "SUCCESS" }, { status: "WARNING" }],
      }),
    ).toEqual({
      items: [{ status: "SUCCESS" }, { status: "WARNING" }],
      total: 2,
      successServices: 0,
      failedServices: 0,
      successEnvironments: 0,
      failedEnvironments: 0,
      successClusterLinks: 0,
      failedClusterLinks: 0,
    });
  });

  it("returns empty shape for non-object responses", () => {
    expect(autoCreateLogExtract("bad")).toEqual({ items: [], total: 0 });
  });
});
