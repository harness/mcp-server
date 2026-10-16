import { describe, expect, it } from "vitest";
import {
  appProjMapExtract,
  argoProjectListExtract,
  autoCreateLogExtract,
  importReconcileExtract,
} from "../../src/registry/extractors.js";

describe("appProjMapExtract", () => {
  it("returns empty items for non-record input", () => {
    expect(appProjMapExtract(null)).toEqual({ items: [], total: 0 });
    expect(appProjMapExtract([])).toEqual({ items: [], total: 0 });
  });

  it("flattens appProjMap keys into list rows with defaults", () => {
    expect(
      appProjMapExtract({
        appProjMap: {
          "team-a": {
            orgIdentifier: "default",
            projectIdentifier: "proj",
            autoCreateServiceEnv: true,
          },
          "team-b": {},
        },
      }),
    ).toEqual({
      items: [
        {
          argoproject: "team-a",
          orgIdentifier: "default",
          projectIdentifier: "proj",
          autoCreateServiceEnv: true,
        },
        {
          argoproject: "team-b",
          orgIdentifier: "",
          projectIdentifier: "",
          autoCreateServiceEnv: false,
        },
      ],
      total: 2,
    });
  });
});

describe("argoProjectListExtract", () => {
  it("maps a bare array to whitelist-safe rows", () => {
    expect(
      argoProjectListExtract([
        {
          metadata: { name: " team-a ", creationTimestamp: "2024-01-01T00:00:00Z" },
          spec: { description: " Team A " },
        },
        { metadata: { name: "" }, spec: {} },
      ]),
    ).toEqual({
      items: [
        {
          name: "team-a",
          description: "Team A",
          createdAt: "2024-01-01T00:00:00Z",
        },
        { name: "" },
      ],
      total: 2,
    });
  });

  it("unwraps { items, total, metadata } envelopes", () => {
    expect(
      argoProjectListExtract({
        items: [{ metadata: { name: "apps" }, spec: {} }],
        total: 99,
        metadata: { page: 1 },
      }),
    ).toEqual({
      items: [{ name: "apps" }],
      total: 99,
      metadata: { page: 1 },
    });
  });

  it("synthesizes total from items when the API omits it", () => {
    expect(
      argoProjectListExtract({
        items: [{ metadata: { name: "a" }, spec: {} }],
      }),
    ).toEqual({
      items: [{ name: "a" }],
      total: 1,
    });
  });
});

describe("importReconcileExtract", () => {
  it("returns safe defaults for non-record responses", () => {
    expect(importReconcileExtract(undefined)).toEqual({
      importRequestId: "",
      autoCreateCounts: {
        serviceCount: 0,
        environmentCount: 0,
        clusterLinkCount: 0,
      },
    });
  });

  it("hoists nested reconcileAppResponse counts and drops the nested blob", () => {
    expect(
      importReconcileExtract({
        importRequestId: "req-1",
        reconcileAppResponse: {
          autoCreateCounts: {
            serviceCount: 2,
            environmentCount: 1,
            clusterLinkCount: 3,
          },
        },
        status: "OK",
      }),
    ).toEqual({
      importRequestId: "req-1",
      status: "OK",
      autoCreateCounts: {
        serviceCount: 2,
        environmentCount: 1,
        clusterLinkCount: 3,
      },
    });
  });
});

describe("autoCreateLogExtract", () => {
  it("returns empty list shape for non-record input", () => {
    expect(autoCreateLogExtract("bad")).toEqual({ items: [], total: 0 });
  });

  it("preserves page aggregates alongside log items", () => {
    expect(
      autoCreateLogExtract({
        logs: [{ resourceRef: "svc", status: "FAILED" }],
        total: 5,
        successServices: 1,
        failedServices: 2,
        successEnvironments: 0,
        failedEnvironments: 1,
        successClusterLinks: 0,
        failedClusterLinks: 1,
      }),
    ).toEqual({
      items: [{ resourceRef: "svc", status: "FAILED" }],
      total: 5,
      successServices: 1,
      failedServices: 2,
      successEnvironments: 0,
      failedEnvironments: 1,
      successClusterLinks: 0,
      failedClusterLinks: 1,
    });
  });
});
