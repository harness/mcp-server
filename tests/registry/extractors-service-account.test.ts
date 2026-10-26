import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";

describe("flattenServiceAccountAggregate", () => {
  it("passes through non-record values unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("plain")).toBe("plain");
  });

  it("flattens nested serviceAccount identity fields for aggregate list rows", () => {
    const flattened = flattenServiceAccountAggregate({
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
      extraWrapperField: "ignored",
    }) as Record<string, unknown>;

    expect(flattened).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      accountIdentifier: "acct",
      createdAt: 1,
      lastModifiedAt: 2,
      tokensCount: 3,
    });
    expect(flattened.governanceMetadata).toBeUndefined();
    expect(flattened.serviceAccount).toBeUndefined();
  });

  it("keeps aggregate metadata only when the row used a nested serviceAccount", () => {
    const flatDto = flattenServiceAccountAggregate({
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
      tokensCount: 9,
    }) as Record<string, unknown>;

    expect(flatDto.identifier).toBe("account-sa");
    expect(flatDto.email).toBe("account-sa@service.harness.io");
    expect(flatDto.tokensCount).toBeUndefined();
  });

  it("copies declared identity fields from a flat list DTO", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "org-sa",
        name: "Org SA",
        orgIdentifier: "platform",
        description: "desc",
        tags: { env: "qa" },
      }),
    ).toEqual({
      identifier: "org-sa",
      name: "Org SA",
      orgIdentifier: "platform",
      description: "desc",
      tags: { env: "qa" },
    });
  });
});

describe("serviceAccountListExtract", () => {
  it("accepts a raw data array envelope and flattens each row", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            email: "account-sa@service.harness.io",
          },
        ],
      }),
    ).toEqual({
      items: [{ identifier: "account-sa", email: "account-sa@service.harness.io" }],
      total: 1,
    });
  });

  it("accepts paginated aggregate content and preserves totalItems", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: {
          content: [
            {
              serviceAccount: {
                identifier: "nested",
                email: "nested@service.harness.io",
              },
              tokensCount: 1,
            },
          ],
          totalItems: 42,
        },
      }),
    ).toEqual({
      items: [{ identifier: "nested", email: "nested@service.harness.io", tokensCount: 1 }],
      total: 42,
    });
  });

  it("returns empty items when the envelope is missing list data", () => {
    expect(serviceAccountListExtract({ status: "SUCCESS" })).toEqual({ items: [], total: 0 });
  });

  it("preserves totalItems when aggregate content is empty (last page / filter miss)", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: { content: [], totalItems: 99 },
      }),
    ).toEqual({ items: [], total: 99 });
  });

  it("treats a raw empty data array as zero total", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [],
      }),
    ).toEqual({ items: [], total: 0 });
  });

  it("prefers totalElements over totalItems for paginated envelopes", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: { content: [], totalElements: 7, totalItems: 99 },
      }),
    ).toEqual({ items: [], total: 7 });
  });
});
