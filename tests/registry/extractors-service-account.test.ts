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
    accountIdentifier: "test-account",
    orgIdentifier: "platform",
    projectIdentifier: "demo",
    governanceMetadata: { deny: false },
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
      description: "Account automation",
      accountIdentifier: "test-account",
      orgIdentifier: "platform",
      projectIdentifier: "demo",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("serviceAccount");
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("governanceMetadata");
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

  it("passes through non-record items unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("plain")).toBe("plain");
  });

  it("prefers nested serviceAccount identity over stale top-level duplicates", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "stale-wrapper-id",
        serviceAccount: {
          identifier: "ci-bot",
          email: "ci-bot@service.harness.io",
        },
        tokensCount: 1,
      }),
    ).toMatchObject({
      identifier: "ci-bot",
      email: "ci-bot@service.harness.io",
      tokensCount: 1,
    });
    expect(
      flattenServiceAccountAggregate({
        identifier: "flat-only",
        email: "flat@service.harness.io",
      }),
    ).toMatchObject({
      identifier: "flat-only",
      email: "flat@service.harness.io",
    });
  });

  it("does not copy aggregate metadata when the list item is already flat", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "flat-only",
        tokensCount: 9,
      }),
    ).toEqual({ identifier: "flat-only" });
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps paginated aggregate list envelopes and flattens each item", () => {
    expect(
      serviceAccountListExtract({
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

  it("uses totalItems when totalElements is absent on aggregate list pages", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [nestedAggregate], totalItems: 42 },
      }),
    ).toEqual({
      items: [
        expect.objectContaining({
          identifier: "ci-bot",
          email: "ci-bot@service.harness.io",
        }),
      ],
      total: 42,
    });
  });

  it("returns an empty list when account-scope data is an empty array", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [],
      }),
    ).toEqual({ items: [], total: 0 });
  });

  it("accepts raw data arrays from account-scope list responses", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            name: "Account SA",
            email: "account-sa@service.harness.io",
            accountIdentifier: "test-account",
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

describe("compact vs nested service account DTO", () => {
  it("default compact drops nested serviceAccount and email when identity is not flattened", () => {
    const [slim] = compactItems([nestedAggregate]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });

  it("flattened items promote identifier for default compact (email needs resource compactItem)", () => {
    const [slim] = compactItems([flattenServiceAccountAggregate(nestedAggregate)]) as Record<
      string,
      unknown
    >[];
    expect(slim.identifier).toBe("ci-bot");
    expect(slim.email).toBeUndefined();
  });
});
