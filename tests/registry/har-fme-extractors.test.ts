/**
 * Unit tests for HAR list and FME trafficType flattening extractors.
 * Guards pagination projection and deep-link identifier injection.
 */
import { describe, it, expect } from "vitest";
import {
  harListExtract,
  flattenTrafficType,
  fmeListExtract,
  fmeGetExtract,
} from "../../src/registry/extractors.js";

describe("harListExtract", () => {
  const extractRegistries = harListExtract("registries");

  it("normalizes HAR list envelope to items/total pagination shape", () => {
    const raw = {
      data: {
        registries: [{ id: "reg-1", name: "docker-hub" }],
        itemCount: 1,
        pageIndex: 0,
        pageSize: 20,
        pageCount: 1,
      },
      status: "SUCCESS",
    };

    expect(extractRegistries(raw)).toEqual({
      items: [{ id: "reg-1", name: "docker-hub" }],
      total: 1,
      pageIndex: 0,
      pageSize: 20,
      pageCount: 1,
    });
  });

  it("defaults missing array key to empty items and zero total", () => {
    expect(
      harListExtract("artifacts")({
        data: { itemCount: 0, pageIndex: 0 },
      }),
    ).toEqual({
      items: [],
      total: 0,
      pageIndex: 0,
      pageSize: undefined,
      pageCount: undefined,
    });
  });

  it("passes through non-envelope responses unchanged", () => {
    const passthrough = { items: [{ id: "x" }], total: 1 };
    expect(extractRegistries(passthrough)).toBe(passthrough);
  });
});

describe("flattenTrafficType", () => {
  it("copies trafficType.id to trafficTypeId when absent", () => {
    const item: Record<string, unknown> = {
      id: "flag-1",
      trafficType: { id: "tt-abc", name: "user" },
    };
    flattenTrafficType(item);
    expect(item.trafficTypeId).toBe("tt-abc");
  });

  it("does not overwrite an existing trafficTypeId", () => {
    const item: Record<string, unknown> = {
      trafficTypeId: "existing",
      trafficType: { id: "tt-abc" },
    };
    flattenTrafficType(item);
    expect(item.trafficTypeId).toBe("existing");
  });

  it("ignores missing or non-object trafficType", () => {
    const noType: Record<string, unknown> = { id: "flag-1" };
    flattenTrafficType(noType);
    expect(noType.trafficTypeId).toBeUndefined();

    const arrayType: Record<string, unknown> = { trafficType: ["x"] };
    flattenTrafficType(arrayType);
    expect(arrayType.trafficTypeId).toBeUndefined();
  });
});

describe("fmeListExtract", () => {
  it("flattens trafficType.id on each list object", () => {
    const raw = {
      objects: [
        { id: "split-1", trafficType: { id: "tt-1" } },
        { id: "split-2", trafficTypeId: "preset", trafficType: { id: "ignored" } },
      ],
      totalCount: 2,
    };

    expect(fmeListExtract(raw)).toBe(raw);
    expect((raw.objects[0] as Record<string, unknown>).trafficTypeId).toBe("tt-1");
    expect((raw.objects[1] as Record<string, unknown>).trafficTypeId).toBe("preset");
  });

  it("returns raw unchanged when objects array is absent", () => {
    const raw = { totalCount: 0 };
    expect(fmeListExtract(raw)).toBe(raw);
  });
});

describe("fmeGetExtract", () => {
  it("flattens trafficType.id on a single item", () => {
    const raw: Record<string, unknown> = {
      id: "flag-1",
      trafficType: { id: "tt-xyz" },
    };
    expect(fmeGetExtract(raw)).toBe(raw);
    expect(raw.trafficTypeId).toBe("tt-xyz");
  });
});
