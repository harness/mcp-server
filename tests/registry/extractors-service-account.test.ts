import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";

const aggregateRow = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    accountIdentifier: "acct",
    governanceMetadata: { deny: false },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and keeps aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(aggregateRow)).toMatchObject({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      accountIdentifier: "acct",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
    expect(flattenServiceAccountAggregate(aggregateRow)).not.toHaveProperty("serviceAccount");
    expect(flattenServiceAccountAggregate(aggregateRow)).not.toHaveProperty("governanceMetadata");
  });

  it("passes through flat DTO rows without aggregate metadata keys", () => {
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
  it("unwraps paginated aggregate content and honors totalItems", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: { content: [aggregateRow], totalItems: 42 },
      }),
    ).toEqual({
      items: [
        expect.objectContaining({
          identifier: "ci-bot",
          email: "ci-bot@service.harness.io",
          tokensCount: 2,
        }),
      ],
      total: 42,
    });
  });

  it("accepts a raw data array for non-aggregate list responses", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            name: "Account SA",
            email: "account-sa@service.harness.io",
          },
        ],
      }),
    ).toEqual({
      items: [
        expect.objectContaining({
          identifier: "account-sa",
          email: "account-sa@service.harness.io",
        }),
      ],
      total: 1,
    });
  });
});
