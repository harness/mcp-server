import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";
import { compactItems } from "../../src/utils/compact.js";

const nestedAggregate = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    description: "Automation",
    accountIdentifier: "acct",
    tags: { team: "platform" },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and keeps aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(nestedAggregate)).toMatchObject({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Automation",
      accountIdentifier: "acct",
      tags: { team: "platform" },
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("serviceAccount");
  });

  it("keeps already-flat service account DTOs", () => {
    const flat = {
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "acct",
    };
    expect(flattenServiceAccountAggregate(flat)).toMatchObject(flat);
  });

  it("passes through non-object items unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("orphan")).toBe("orphan");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps raw data arrays used by account-scope list APIs", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            email: "account-sa@service.harness.io",
            accountIdentifier: "acct",
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          identifier: "account-sa",
          email: "account-sa@service.harness.io",
          accountIdentifier: "acct",
        },
      ],
      total: 1,
    });
  });

  it("returns empty items for data: [] without treating the response as missing", () => {
    expect(serviceAccountListExtract({ data: [] })).toEqual({ items: [], total: 0 });
  });

  it("flattens aggregate pages from project/org list APIs", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [nestedAggregate], totalItems: 1 },
      }),
    ).toEqual({
      items: [
        expect.objectContaining({
          identifier: "ci-bot",
          email: "ci-bot@service.harness.io",
          tokensCount: 2,
        }),
      ],
      total: 1,
    });
  });

  it("falls back to pageExtract when data is not a top-level array", () => {
    expect(serviceAccountListExtract({ status: "SUCCESS" })).toEqual({ items: [], total: 0 });
    expect(
      serviceAccountListExtract({ data: { content: [], totalItems: 0 } }),
    ).toEqual({ items: [], total: 0 });
  });
});

describe("compact vs nested service account DTO", () => {
  it("default compact drops nested serviceAccount when identity is not flattened", () => {
    const [slim] = compactItems([nestedAggregate]) as Record<string, unknown>[];
    expect(slim.identifier).toBeUndefined();
    expect(slim.email).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });
});
