/**
 * Unit coverage for service account list flattening (#1152).
 * Aggregate and flat list shapes must expose identifier/email for compact mode and gets.
 */
import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";

describe("flattenServiceAccountAggregate", () => {
  it("flattens nested serviceAccount identity fields and keeps aggregate metadata", () => {
    const item = {
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

    expect(flattenServiceAccountAggregate(item)).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      accountIdentifier: "acct",
      createdAt: 1,
      lastModifiedAt: 2,
      tokensCount: 3,
    });
  });

  it("passes through a flat DTO without duplicating nested keys", () => {
    const flat = {
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
      name: "Account SA",
    };
    expect(flattenServiceAccountAggregate(flat)).toEqual(flat);
  });

  it("returns non-objects unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("x")).toBe("x");
  });
});

describe("serviceAccountListExtract", () => {
  it("maps aggregate pages through flattenServiceAccountAggregate", () => {
    const raw = {
      data: {
        content: [
          {
            serviceAccount: { identifier: "a", email: "a@service.harness.io" },
            tokensCount: 1,
          },
        ],
        totalItems: 1,
      },
    };

    const { items, total } = serviceAccountListExtract(raw);
    expect(total).toBe(1);
    expect(items).toEqual([{ identifier: "a", email: "a@service.harness.io", tokensCount: 1 }]);
  });

  it("accepts a raw data array for non-aggregate account-scope lists", () => {
    const raw = {
      data: [{ identifier: "flat", email: "flat@service.harness.io", name: "Flat" }],
    };

    const { items, total } = serviceAccountListExtract(raw);
    expect(total).toBe(1);
    expect(items[0]).toEqual({
      identifier: "flat",
      email: "flat@service.harness.io",
      name: "Flat",
    });
  });
});
