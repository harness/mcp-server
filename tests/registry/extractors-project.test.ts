import { describe, expect, it } from "vitest";
import { unwrapProjectResponse } from "../../src/registry/extractors.js";

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
