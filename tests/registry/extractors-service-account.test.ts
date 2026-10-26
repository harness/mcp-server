import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";
import { compactItems } from "../../src/utils/compact.js";

const aggregateItem = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    description: "Account automation",
    accountIdentifier: "test-account",
    orgIdentifier: "platform",
    projectIdentifier: "demo",
    tags: { env: "prod" },
  },
  createdAt: 1_700_000_000_000,
  lastModifiedAt: 1_700_000_100_000,
  tokensCount: 2,
  governanceMetadata: { deny: false },
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields to the top level", () => {
    expect(flattenServiceAccountAggregate(aggregateItem)).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      accountIdentifier: "test-account",
      orgIdentifier: "platform",
      projectIdentifier: "demo",
      tags: { env: "prod" },
      createdAt: 1_700_000_000_000,
      lastModifiedAt: 1_700_000_100_000,
      tokensCount: 2,
    });
  });

  it("keeps already-flat service account DTOs and omits aggregate-only metadata", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "account-sa",
        name: "Account SA",
        email: "account-sa@service.harness.io",
        accountIdentifier: "test-account",
      }),
    ).toEqual({
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "test-account",
    });
  });

  it("passes through non-record values unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
  });

  it("omits governanceMetadata and other fields outside the service account DTO", () => {
    expect(
      flattenServiceAccountAggregate({
        serviceAccount: {
          identifier: "ci-bot",
          name: "CI Bot",
          email: "ci-bot@service.harness.io",
          governanceMetadata: { deny: false },
        },
        governanceMetadata: { deny: true },
        createdAt: 1,
        tokensCount: 0,
      }),
    ).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      createdAt: 1,
      tokensCount: 0,
    });
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps raw data arrays (account-scope list) and flattens each item", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [aggregateItem],
      }),
    ).toEqual({
      items: [flattenServiceAccountAggregate(aggregateItem)],
      total: 1,
    });
  });

  it("unwraps paginated aggregate envelopes (data.content)", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [aggregateItem], totalElements: 1 },
      }),
    ).toEqual({
      items: [flattenServiceAccountAggregate(aggregateItem)],
      total: 1,
    });
  });

  it("uses totalItems when totalElements is absent (NG aggregate list)", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [aggregateItem], totalItems: 42 },
      }),
    ).toEqual({
      items: [flattenServiceAccountAggregate(aggregateItem)],
      total: 42,
    });
  });

  it("returns an empty list for a raw data array with no items", () => {
    expect(serviceAccountListExtract({ data: [] })).toEqual({ items: [], total: 0 });
  });

  it("uses pageExtract when data is not a top-level array", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [], totalElements: 0 },
      }),
    ).toEqual({ items: [], total: 0 });
  });
});

describe("compact vs nested service account DTO", () => {
  it("default compact drops nested serviceAccount and email when identity is not flattened", () => {
    const [slim] = compactItems([aggregateItem]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
    expect(slim.tokensCount).toBeUndefined();
  });
});
