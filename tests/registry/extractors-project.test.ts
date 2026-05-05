import { describe, expect, it } from "vitest";
import { projectListExtract, unwrapProjectResponse } from "../../src/registry/extractors.js";

describe("unwrapProjectResponse", () => {
  it("unwraps data.project (typical NG success)", () => {
    const raw = {
      status: "SUCCESS",
      data: {
        project: { identifier: "p1", name: "P1", orgIdentifier: "default" },
      },
    };
    expect(unwrapProjectResponse(raw)).toEqual({
      identifier: "p1",
      name: "P1",
      orgIdentifier: "default",
    });
  });

  it("passes through when no project wrapper", () => {
    expect(unwrapProjectResponse({ foo: 1 })).toEqual({ foo: 1 });
  });

  it("returns null or undefined without throwing (defensive)", () => {
    expect(unwrapProjectResponse(null)).toBeNull();
    expect(unwrapProjectResponse(undefined)).toBeUndefined();
  });

  it("returns inner data when project is null (no crash)", () => {
    const raw = {
      status: "SUCCESS",
      data: { project: null },
    };
    expect(unwrapProjectResponse(raw)).toEqual({ project: null });
  });

  it("returns inner when project key missing after ng envelope", () => {
    const raw = { status: "SUCCESS", data: { other: true } };
    expect(unwrapProjectResponse(raw)).toEqual({ other: true });
  });
});

describe("projectListExtract", () => {
  it("unwraps { project: {...} } wrapper from each item in content", () => {
    const raw = {
      status: "SUCCESS",
      data: {
        content: [
          { project: { identifier: "p1", name: "Project 1", orgIdentifier: "org1" } },
          { project: { identifier: "p2", name: "Project 2", orgIdentifier: "org2" } },
        ],
        totalElements: 2,
      },
    };
    const result = projectListExtract(raw);
    expect(result.items).toEqual([
      { identifier: "p1", name: "Project 1", orgIdentifier: "org1" },
      { identifier: "p2", name: "Project 2", orgIdentifier: "org2" },
    ]);
    expect(result.total).toBe(2);
  });

  it("passes through items that lack project wrapper", () => {
    const raw = {
      status: "SUCCESS",
      data: {
        content: [{ identifier: "p1", name: "Already unwrapped" }],
        totalElements: 1,
      },
    };
    const result = projectListExtract(raw);
    expect(result.items).toEqual([{ identifier: "p1", name: "Already unwrapped" }]);
  });

  it("returns empty items when data.content is missing", () => {
    const raw = { status: "SUCCESS", data: {} };
    const result = projectListExtract(raw);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
