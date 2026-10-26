import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";
import { compactItems } from "../../src/utils/compact.js";

const nestedAggregateItem = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    description: "Account automation",
    accountIdentifier: "test-account",
    governanceMetadata: { deny: false },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and keeps aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).toMatchObject({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      accountIdentifier: "test-account",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).not.toHaveProperty("serviceAccount");
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).not.toHaveProperty("governanceMetadata");
  });

  it("keeps already-flat service account DTO fields", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "flat-bot",
        name: "Flat Bot",
        email: "flat@service.harness.io",
        accountIdentifier: "acct",
      }),
    ).toMatchObject({
      identifier: "flat-bot",
      name: "Flat Bot",
      email: "flat@service.harness.io",
      accountIdentifier: "acct",
    });
  });

  it("returns non-objects unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBeNull();
    expect(flattenServiceAccountAggregate("x")).toBe("x");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps paginated aggregate list envelopes", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: {
          content: [nestedAggregateItem],
          totalItems: 1,
        },
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

  it("accepts raw array data from non-aggregate list responses", () => {
    const flatItem = {
      identifier: "acct-only",
      name: "Account Scope",
      email: "acct@service.harness.io",
      accountIdentifier: "test-account",
    };
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [flatItem],
      }),
    ).toEqual({
      items: [flatItem],
      total: 1,
    });
  });
});

describe("compact vs nested service account DTO", () => {
  it("default compact drops nested serviceAccount and email when identity is not flattened", () => {
    const [slim] = compactItems([nestedAggregateItem]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });
});
