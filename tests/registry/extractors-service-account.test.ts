import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";

const aggregateItem = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    description: "Account automation",
    accountIdentifier: "acct-1",
    orgIdentifier: "platform",
    projectIdentifier: "proj-1",
    tags: { team: "devops" },
    governanceMetadata: { deny: false },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and keeps aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(aggregateItem)).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      accountIdentifier: "acct-1",
      orgIdentifier: "platform",
      projectIdentifier: "proj-1",
      tags: { team: "devops" },
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
  });

  it("does not copy governanceMetadata from nested serviceAccount", () => {
    const flat = flattenServiceAccountAggregate(aggregateItem) as Record<string, unknown>;
    expect(flat.governanceMetadata).toBeUndefined();
    expect(flat.serviceAccount).toBeUndefined();
  });

  it("keeps already-flat list DTOs unchanged aside from field selection", () => {
    const flatDto = {
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "acct-1",
      extraField: "ignored",
    };
    expect(flattenServiceAccountAggregate(flatDto)).toEqual({
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "acct-1",
    });
  });

  it("passes through non-record values", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps paginated aggregate list envelopes", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: { content: [aggregateItem], totalElements: 1 },
      }),
    ).toEqual({
      items: [expect.objectContaining({ identifier: "ci-bot", email: "ci-bot@service.harness.io", tokensCount: 2 })],
      total: 1,
    });
  });

  it("accepts raw data arrays from non-aggregate list endpoints", () => {
    const rawArrayResponse = {
      status: "SUCCESS",
      data: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
          accountIdentifier: "acct-1",
        },
      ],
    };

    expect(serviceAccountListExtract(rawArrayResponse)).toEqual({
      items: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
          accountIdentifier: "acct-1",
        },
      ],
      total: 1,
    });
  });

  it("returns empty results for unrecognized envelopes", () => {
    expect(serviceAccountListExtract({ status: "SUCCESS" })).toEqual({ items: [], total: 0 });
  });
});
