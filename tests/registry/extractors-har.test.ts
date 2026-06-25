import { describe, expect, it } from "vitest";
import { harListExtract } from "../../src/registry/extractors.js";

describe("harListExtract", () => {
  it("normalizes HAR list envelope to { items, total, pageIndex, pageSize, pageCount }", () => {
    const raw = {
      data: {
        registries: [{ identifier: "reg-1", name: "Docker Hub" }],
        itemCount: 42,
        pageIndex: 1,
        pageSize: 20,
        pageCount: 3,
      },
      status: "SUCCESS",
    };

    expect(harListExtract("registries")(raw)).toEqual({
      items: [{ identifier: "reg-1", name: "Docker Hub" }],
      total: 42,
      pageIndex: 1,
      pageSize: 20,
      pageCount: 3,
    });
  });

  it("uses the provided array key for items", () => {
    const raw = {
      data: {
        artifacts: [{ name: "my-app", version: "1.0.0" }],
        itemCount: 1,
      },
    };

    expect(harListExtract("artifacts")(raw)).toEqual({
      items: [{ name: "my-app", version: "1.0.0" }],
      total: 1,
      pageIndex: undefined,
      pageSize: undefined,
      pageCount: undefined,
    });
  });

  it("defaults items to [] and total to 0 when array key is missing", () => {
    const raw = { data: { itemCount: 0 } };
    expect(harListExtract("registries")(raw)).toEqual({
      items: [],
      total: 0,
      pageIndex: undefined,
      pageSize: undefined,
      pageCount: undefined,
    });
  });

  it("passes through raw when data is not an object envelope", () => {
    const raw = [{ identifier: "bare-array" }];
    expect(harListExtract("registries")(raw)).toBe(raw);
  });
});
