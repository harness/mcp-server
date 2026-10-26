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
  createdAt: 1,
  lastModifiedAt: 2,
  tokensCount: 3,
};

describe("flattenServiceAccountAggregate", () => {
  it("flattens nested serviceAccount and keeps aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(aggregateRow)).toMatchObject({
      identifier: "ci-bot",
      email: "ci-bot@service.harness.io",
      tokensCount: 3,
      createdAt: 1,
    });
    expect(flattenServiceAccountAggregate(aggregateRow)).not.toHaveProperty("serviceAccount");
    expect(flattenServiceAccountAggregate(aggregateRow)).not.toHaveProperty("governanceMetadata");
  });

  it("passes through already-flat list items", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "flat-sa",
        email: "flat@service.harness.io",
        name: "Flat",
      }),
    ).toMatchObject({
      identifier: "flat-sa",
      email: "flat@service.harness.io",
      name: "Flat",
    });
  });
});

describe("serviceAccountListExtract", () => {
  it("uses totalItems for aggregate pages when content is shorter than the total", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: { content: [aggregateRow], totalItems: 42 },
      }),
    ).toEqual({
      items: [expect.objectContaining({ identifier: "ci-bot", tokensCount: 3 })],
      total: 42,
    });
  });

  it("accepts raw data arrays (non-aggregate list shape)", () => {
    const flat = {
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
      accountIdentifier: "acct",
    };
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [flat],
      }),
    ).toEqual({
      items: [flat],
      total: 1,
    });
  });
});
