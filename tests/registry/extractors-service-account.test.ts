import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";

const nestedAggregateItem = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    accountIdentifier: "acct-1",
    governanceMetadata: { deny: false },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).toMatchObject({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      accountIdentifier: "acct-1",
      tokensCount: 2,
      createdAt: 1710000000000,
    });
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).not.toHaveProperty("serviceAccount");
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).not.toHaveProperty("governanceMetadata");
  });

  it("keeps already-flat DTO fields", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "account-sa",
        email: "account-sa@service.harness.io",
        name: "Account SA",
      }),
    ).toMatchObject({
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
      name: "Account SA",
    });
  });
});

describe("serviceAccountListExtract", () => {
  it("uses pagination.totalItems for aggregate lists (not items.length)", () => {
    const raw = {
      status: "SUCCESS",
      data: {
        content: [nestedAggregateItem],
        totalItems: 42,
      },
    };

    const result = serviceAccountListExtract(raw);
    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ identifier: "ci-bot", tokensCount: 2 });
  });

  it("accepts raw data arrays from non-aggregate list endpoints", () => {
    const raw = {
      status: "SUCCESS",
      data: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
        },
      ],
    };

    const result = serviceAccountListExtract(raw);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
    });
  });
});
