import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";

describe("serviceAccountListExtract", () => {
  it("flattens aggregate page content and preserves envelope metadata", () => {
    const raw = {
      data: {
        content: [
          {
            serviceAccount: {
              identifier: "ci-bot",
              name: "CI Bot",
              email: "ci-bot@service.harness.io",
              accountIdentifier: "acct",
            },
            createdAt: 1,
            lastModifiedAt: 2,
            tokensCount: 3,
          },
        ],
        totalItems: 1,
      },
    };
    const { items, total } = serviceAccountListExtract(raw);
    expect(total).toBe(1);
    expect(items[0]).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      accountIdentifier: "acct",
      createdAt: 1,
      lastModifiedAt: 2,
      tokensCount: 3,
    });
  });

  it("preserves aggregate totalItems when content is empty", () => {
    const raw = {
      data: {
        content: [],
        totalItems: 42,
      },
    };
    const { items, total } = serviceAccountListExtract(raw);
    expect(items).toEqual([]);
    expect(total).toBe(42);
  });

  it("accepts a raw data array (non-aggregate list) without dropping rows", () => {
    const raw = {
      data: [
        {
          identifier: "plain",
          name: "Plain",
          email: "plain@service.harness.io",
        },
      ],
    };
    const { items, total } = serviceAccountListExtract(raw);
    expect(total).toBe(1);
    expect(items[0]).toMatchObject({ identifier: "plain", email: "plain@service.harness.io" });
  });
});

describe("flattenServiceAccountAggregate", () => {
  it("prefers nested serviceAccount fields over duplicate top-level keys", () => {
    const flattened = flattenServiceAccountAggregate({
      serviceAccount: { identifier: "nested", name: "Nested", email: "n@service.harness.io" },
      identifier: "top-level",
      name: "Top",
      tokensCount: 9,
    }) as Record<string, unknown>;
    expect(flattened.identifier).toBe("nested");
    expect(flattened.name).toBe("Nested");
    expect(flattened.tokensCount).toBe(9);
  });

  it("passes through a plain service account DTO", () => {
    const dto = { identifier: "x", name: "X", email: "x@service.harness.io" };
    expect(flattenServiceAccountAggregate(dto)).toEqual(dto);
  });

  it("returns non-objects unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBeNull();
    expect(flattenServiceAccountAggregate("bad")).toBe("bad");
  });
});
