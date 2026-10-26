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
    description: "Account automation",
    accountIdentifier: "acct-1",
    governanceMetadata: { deny: false },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and copies aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(nestedAggregate)).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      accountIdentifier: "acct-1",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
  });

  it("keeps already-flat identity fields and drops aggregate-only metadata", () => {
    const flat = {
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "acct-1",
      tokensCount: 9,
    };
    expect(flattenServiceAccountAggregate(flat)).toEqual({
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "acct-1",
    });
  });

  it("passes through non-record values unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBeNull();
    expect(flattenServiceAccountAggregate("plain")).toBe("plain");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps raw data arrays for account-scope lists", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            name: "Account SA",
            email: "account-sa@service.harness.io",
            accountIdentifier: "acct-1",
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
          accountIdentifier: "acct-1",
        },
      ],
      total: 1,
    });
  });

  it("returns empty items for an empty data array", () => {
    expect(serviceAccountListExtract({ status: "SUCCESS", data: [] })).toEqual({
      items: [],
      total: 0,
    });
  });

  it("unwraps paginated aggregate envelopes and flattens each item", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: { content: [nestedAggregate], totalElements: 1 },
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

  it("returns empty items for empty paginated content", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [], totalElements: 0 },
      }),
    ).toEqual({ items: [], total: 0 });
  });
});

describe("compact vs nested service account DTO", () => {
  it("default compact drops nested serviceAccount and email when identity is not flattened", () => {
    const [slim] = compactItems([nestedAggregate]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });
});
