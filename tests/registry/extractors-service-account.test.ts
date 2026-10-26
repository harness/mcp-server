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
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      accountIdentifier: "test-account",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
  });

  it("keeps already-flat list DTO fields", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "account-sa",
        name: "Account SA",
        email: "account-sa@service.harness.io",
        accountIdentifier: "test-account",
      }),
    ).toMatchObject({
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
    });
  });

  it("does not copy governanceMetadata from nested serviceAccount", () => {
    const flat = flattenServiceAccountAggregate(nestedAggregateItem) as Record<string, unknown>;
    expect(flat.governanceMetadata).toBeUndefined();
    expect(flat.serviceAccount).toBeUndefined();
  });

  it("returns non-record inputs unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("plain")).toBe("plain");
  });
});

describe("serviceAccountListExtract", () => {
  it("uses totalItems when totalElements is absent (aggregate pagination)", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: {
          content: [nestedAggregateItem],
          totalItems: 42,
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
      total: 42,
    });
  });

  it("prefers totalElements when both pagination totals are present", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [nestedAggregateItem], totalElements: 3, totalItems: 99 },
      }),
    ).toEqual({
      items: [expect.objectContaining({ identifier: "ci-bot" })],
      total: 3,
    });
  });

  it("accepts raw data arrays from non-aggregate list responses", () => {
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

  it("returns an empty page with totalItems when aggregate content is empty", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [], totalItems: 0 },
      }),
    ).toEqual({ items: [], total: 0 });
  });

  it("passes non-object page rows through flattenServiceAccountAggregate unchanged", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [null, "orphan-row", nestedAggregateItem], totalItems: 3 },
      }),
    ).toEqual({
      items: [null, "orphan-row", expect.objectContaining({ identifier: "ci-bot" })],
      total: 3,
    });
  });

  it("returns non-object API payloads unchanged via pageExtract", () => {
    expect(serviceAccountListExtract("not-json")).toEqual({ items: [], total: 0 });
    expect(serviceAccountListExtract(42)).toEqual({ items: [], total: 0 });
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
