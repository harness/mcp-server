import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";

const nestedAggregate = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    description: "Account automation",
    accountIdentifier: "acct",
    governanceMetadata: { deny: false },
  },
  createdAt: 1,
  lastModifiedAt: 2,
  tokensCount: 3,
};

describe("serviceAccountListExtract", () => {
  it("flattens aggregate page content and preserves envelope metadata", () => {
    const raw = {
      data: {
        content: [nestedAggregate],
        totalItems: 1,
      },
    };
    const { items, total } = serviceAccountListExtract(raw);
    expect(total).toBe(1);
    expect(items[0]).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      accountIdentifier: "acct",
      createdAt: 1,
      lastModifiedAt: 2,
      tokensCount: 3,
    });
    expect((items[0] as Record<string, unknown>).governanceMetadata).toBeUndefined();
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

  it("uses totalItems from the aggregate page envelope", () => {
    const raw = {
      data: {
        content: [nestedAggregate, nestedAggregate],
        totalItems: 42,
      },
    };
    const { items, total } = serviceAccountListExtract(raw);
    expect(items).toHaveLength(2);
    expect(total).toBe(42);
  });
});

describe("flattenServiceAccountAggregate", () => {
  it("passes through a plain service account DTO", () => {
    const dto = { identifier: "x", name: "X", email: "x@service.harness.io" };
    expect(flattenServiceAccountAggregate(dto)).toEqual(dto);
  });

  it("returns non-objects unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBeNull();
    expect(flattenServiceAccountAggregate("bad")).toBe("bad");
  });

  it("prefers nested serviceAccount identity over duplicate top-level fields", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "stale-top-level",
        serviceAccount: {
          identifier: "nested-sa",
          email: "nested@service.harness.io",
        },
        tokensCount: 1,
      }),
    ).toEqual({
      identifier: "nested-sa",
      email: "nested@service.harness.io",
      tokensCount: 1,
    });
  });

  it("does not copy governanceMetadata or the nested envelope", () => {
    const flat = flattenServiceAccountAggregate(nestedAggregate) as Record<string, unknown>;
    expect(flat.governanceMetadata).toBeUndefined();
    expect(flat.serviceAccount).toBeUndefined();
  });

  it("returns an empty object when aggregate envelope has an empty nested serviceAccount", () => {
    expect(flattenServiceAccountAggregate({ serviceAccount: {} })).toEqual({});
  });
});
