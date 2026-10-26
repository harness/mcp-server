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
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity and keeps aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(aggregateRow)).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      accountIdentifier: "acct",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
  });

  it("passes through already-flat DTO rows", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "flat-sa",
        name: "Flat",
        email: "flat@service.harness.io",
      }),
    ).toMatchObject({
      identifier: "flat-sa",
      email: "flat@service.harness.io",
    });
  });
});

describe("serviceAccountListExtract", () => {
  it("uses totalItems from aggregate pagination (not only page length)", () => {
    const result = serviceAccountListExtract({
      status: "SUCCESS",
      data: {
        content: [aggregateRow],
        totalItems: 42,
      },
    });

    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      identifier: "ci-bot",
      tokensCount: 2,
    });
  });

  it("accepts raw data arrays for non-aggregate list responses", () => {
    const result = serviceAccountListExtract({
      status: "SUCCESS",
      data: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
        },
      ],
    });

    expect(result).toEqual({
      items: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
        },
      ],
      total: 1,
    });
  });
});
