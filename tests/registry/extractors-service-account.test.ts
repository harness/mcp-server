import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";

const nestedAggregate = {
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
    expect(flattenServiceAccountAggregate(nestedAggregate)).toEqual({
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

  it("keeps already-flat DTO fields without requiring a serviceAccount wrapper", () => {
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
    expect(flattenServiceAccountAggregate({ identifier: "account-sa" })).not.toHaveProperty("tokensCount");
  });

  it("does not copy governanceMetadata or nested wrapper keys onto the flattened item", () => {
    const flat = flattenServiceAccountAggregate(nestedAggregate) as Record<string, unknown>;
    expect(flat.governanceMetadata).toBeUndefined();
    expect(flat.serviceAccount).toBeUndefined();
  });

  it("passes through non-record items unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps paginated aggregate envelopes", () => {
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

  it("accepts a raw data array so account-scope lists are not dropped", () => {
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
