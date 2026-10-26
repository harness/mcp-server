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
    accountIdentifier: "acct-1",
    orgIdentifier: "platform",
    projectIdentifier: "demo",
    governanceMetadata: { deny: false },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(nestedAggregate)).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      accountIdentifier: "acct-1",
      orgIdentifier: "platform",
      projectIdentifier: "demo",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
  });

  it("keeps already-flat DTO fields without requiring a nested serviceAccount", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "flat-sa",
        email: "flat@service.harness.io",
        name: "Flat SA",
      }),
    ).toMatchObject({
      identifier: "flat-sa",
      email: "flat@service.harness.io",
      name: "Flat SA",
    });
  });

  it("passes through non-object items unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps paginated aggregate lists and uses totalItems when present", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [nestedAggregate], totalItems: 42 },
      }),
    ).toEqual({
      items: [expect.objectContaining({ identifier: "ci-bot", email: "ci-bot@service.harness.io" })],
      total: 42,
    });
  });

  it("accepts a raw data array for account-scope list responses", () => {
    const flat = {
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
      name: "Account SA",
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

  it("returns an empty page when aggregate content is missing", () => {
    expect(serviceAccountListExtract({ data: { content: [], totalItems: 0 } })).toEqual({
      items: [],
      total: 0,
    });
  });
});

describe("compact vs nested service account DTO", () => {
  it("default compact drops email when identity is not flattened", () => {
    const [slim] = compactItems([nestedAggregate]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });
});
