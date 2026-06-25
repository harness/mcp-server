import { describe, expect, it } from "vitest";
import {
  flattenTrafficType,
  fmeGetExtract,
  fmeListExtract,
} from "../../src/registry/extractors.js";

describe("flattenTrafficType", () => {
  it("copies trafficType.id to trafficTypeId when not already set", () => {
    const item: Record<string, unknown> = {
      name: "dark-mode",
      trafficType: { id: "tt-1", name: "Production" },
    };
    flattenTrafficType(item);
    expect(item.trafficTypeId).toBe("tt-1");
    expect(item.trafficType).toEqual({ id: "tt-1", name: "Production" });
  });

  it("does not overwrite an existing trafficTypeId", () => {
    const item: Record<string, unknown> = {
      trafficTypeId: "kept",
      trafficType: { id: "tt-1" },
    };
    flattenTrafficType(item);
    expect(item.trafficTypeId).toBe("kept");
  });

  it("no-ops when trafficType is missing or has no id", () => {
    const noTrafficType: Record<string, unknown> = { name: "flag" };
    flattenTrafficType(noTrafficType);
    expect(noTrafficType).not.toHaveProperty("trafficTypeId");

    const noId: Record<string, unknown> = { trafficType: { name: "Prod" } };
    flattenTrafficType(noId);
    expect(noId).not.toHaveProperty("trafficTypeId");
  });
});

describe("fmeListExtract", () => {
  it("flattens trafficType.id on each object in the list", () => {
    const raw = {
      objects: [
        { name: "flag-a", trafficType: { id: "tt-1" } },
        { name: "flag-b", trafficTypeId: "existing" },
      ],
    };
    const result = fmeListExtract(raw) as typeof raw;
    expect(result.objects[0]).toMatchObject({ trafficTypeId: "tt-1" });
    expect(result.objects[1]).toMatchObject({ trafficTypeId: "existing" });
  });

  it("returns raw unchanged when objects is not an array", () => {
    const raw = { objects: "not-an-array" };
    expect(fmeListExtract(raw)).toBe(raw);
  });
});

describe("fmeGetExtract", () => {
  it("flattens trafficType.id on a single feature flag", () => {
    const raw = { name: "kill-switch", trafficType: { id: "tt-2" } };
    const result = fmeGetExtract(raw) as Record<string, unknown>;
    expect(result.trafficTypeId).toBe("tt-2");
  });
});
