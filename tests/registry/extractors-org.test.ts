import { describe, expect, it } from "vitest";
import { unwrapOrgResponse } from "../../src/registry/extractors.js";

describe("unwrapOrgResponse", () => {
  it("unwraps data.organization (typical NG success)", () => {
    const raw = {
      status: "SUCCESS",
      data: {
        organization: { identifier: "acme", name: "Acme", description: "" },
      },
    };
    expect(unwrapOrgResponse(raw)).toEqual({
      identifier: "acme",
      name: "Acme",
      description: "",
    });
  });

  it("falls back to data.org when organization absent", () => {
    const raw = {
      status: "SUCCESS",
      data: {
        org: { identifier: "legacy", name: "Legacy" },
      },
    };
    expect(unwrapOrgResponse(raw)).toEqual({
      identifier: "legacy",
      name: "Legacy",
    });
  });

  it("unwraps top-level organization when no data envelope", () => {
    const raw = { organization: { identifier: "x", name: "X" } };
    expect(unwrapOrgResponse(raw)).toEqual({ identifier: "x", name: "X" });
  });

  it("returns null or undefined without throwing (defensive)", () => {
    expect(unwrapOrgResponse(null)).toBeNull();
    expect(unwrapOrgResponse(undefined)).toBeUndefined();
  });

  it("prefers organization over org when both are non-null objects", () => {
    const raw = {
      status: "SUCCESS",
      data: {
        organization: { identifier: "canonical", name: "Canonical" },
        org: { identifier: "legacy", name: "Legacy" },
      },
    };
    expect(unwrapOrgResponse(raw)).toEqual({
      identifier: "canonical",
      name: "Canonical",
    });
  });

  it("falls through to org when organization is null", () => {
    const raw = {
      status: "SUCCESS",
      data: {
        organization: null,
        org: { identifier: "from-org", name: "From Org" },
      },
    };
    expect(unwrapOrgResponse(raw)).toEqual({
      identifier: "from-org",
      name: "From Org",
    });
  });

  it("returns inner envelope when both organization and org are null", () => {
    const raw = {
      status: "SUCCESS",
      data: { organization: null, org: null },
    };
    expect(unwrapOrgResponse(raw)).toEqual({ organization: null, org: null });
  });
});
