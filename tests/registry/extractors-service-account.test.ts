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
    description: "Account automation",
    accountIdentifier: "test-account",
    governanceMetadata: { deny: false },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and copies aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).toMatchObject({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      tokensCount: 2,
      createdAt: 1710000000000,
    });
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).not.toHaveProperty("serviceAccount");
    expect(flattenServiceAccountAggregate(nestedAggregateItem)).not.toHaveProperty("governanceMetadata");
  });

  it("keeps already-flat service account DTOs", () => {
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

  it("passes through non-record values unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
  });

  it("prefers nested serviceAccount identity over stale top-level fields", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "stale-top-level",
        email: "stale@example.com",
        serviceAccount: {
          identifier: "nested-sa",
          email: "nested@service.harness.io",
          name: "Nested",
        },
        tokensCount: 1,
      }),
    ).toEqual({
      identifier: "nested-sa",
      email: "nested@service.harness.io",
      name: "Nested",
      tokensCount: 1,
    });
  });

  it("omits identity fields when aggregate row has an empty nested serviceAccount", () => {
    expect(flattenServiceAccountAggregate({ serviceAccount: {} })).toEqual({});
  });

  it("still copies aggregate metadata when nested serviceAccount is empty", () => {
    expect(
      flattenServiceAccountAggregate({
        serviceAccount: {},
        tokensCount: 0,
        createdAt: 1,
      }),
    ).toEqual({ tokensCount: 0, createdAt: 1 });
  });

  it("promotes org and project scope identifiers and tags from nested aggregates", () => {
    expect(
      flattenServiceAccountAggregate({
        serviceAccount: {
          identifier: "org-sa",
          orgIdentifier: "platform",
          projectIdentifier: "payments",
          tags: { team: "sre" },
        },
        lastModifiedAt: 99,
      }),
    ).toEqual({
      identifier: "org-sa",
      orgIdentifier: "platform",
      projectIdentifier: "payments",
      tags: { team: "sre" },
      lastModifiedAt: 99,
    });
  });
});

describe("serviceAccountListExtract", () => {
  it("uses totalItems from aggregate pagination when content is a single page", () => {
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

  it("falls back to zero total when aggregate pagination omits totalItems", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: {
          content: [nestedAggregateItem],
        },
      }),
    ).toEqual({
      items: [expect.objectContaining({ identifier: "ci-bot" })],
      total: 0,
    });
  });

  it("unwraps a raw data array for non-aggregate list responses", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            email: "account-sa@service.harness.io",
            name: "Account SA",
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
