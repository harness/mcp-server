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
  createdAt: 1,
  lastModifiedAt: 2,
  tokensCount: 3,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount fields and keeps aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(aggregateRow)).toMatchObject({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      accountIdentifier: "acct",
      createdAt: 1,
      lastModifiedAt: 2,
      tokensCount: 3,
    });
    expect(flattenServiceAccountAggregate(aggregateRow)).not.toHaveProperty("serviceAccount");
  });

  it("passes through already-flat service account DTOs", () => {
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
  it("uses data.totalItems when totalElements is absent (aggregate pagination)", () => {
    const result = serviceAccountListExtract({
      data: {
        content: [aggregateRow],
        totalItems: 27,
      },
    });

    expect(result.total).toBe(27);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ identifier: "ci-bot", email: "ci-bot@service.harness.io" });
  });

  it("prefers totalElements when both pagination totals are present", () => {
    const result = serviceAccountListExtract({
      data: {
        content: [aggregateRow],
        totalElements: 5,
        totalItems: 27,
      },
    });

    expect(result.total).toBe(5);
  });

  it("accepts a raw data array for non-aggregate list responses", () => {
    const result = serviceAccountListExtract({
      data: [
        {
          identifier: "account-sa",
          email: "account-sa@service.harness.io",
          name: "Account SA",
        },
      ],
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
    });
  });
});
