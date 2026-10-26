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
    accountIdentifier: "acct",
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
      accountIdentifier: "acct",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("serviceAccount");
  });

  it("passes through non-object items unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
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
  it("uses totalItems from paginated aggregate, not content.length", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [nestedAggregate], totalItems: 42 },
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

  it("prefers totalItems over content.length on aggregate pages", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [], totalItems: 99 },
      }),
    ).toEqual({ items: [], total: 99 });
  });

  it("unwraps raw data array responses at account scope", () => {
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
