import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";

describe("serviceAccountListExtract", () => {
  it("flattens aggregate rows and preserves list metadata", () => {
    const item = flattenServiceAccountAggregate({
      serviceAccount: {
        identifier: "ci-bot",
        name: "CI Bot",
        email: "ci-bot@service.harness.io",
        governanceMetadata: { deny: false },
      },
      createdAt: 1,
      lastModifiedAt: 2,
      tokensCount: 3,
    }) as Record<string, unknown>;

    expect(item).toMatchObject({
      identifier: "ci-bot",
      email: "ci-bot@service.harness.io",
      tokensCount: 3,
    });
    expect(item.serviceAccount).toBeUndefined();
    expect(item.governanceMetadata).toBeUndefined();
  });

  it("uses totalItems when totalElements is absent (aggregate list API)", () => {
    const result = serviceAccountListExtract({
      status: "SUCCESS",
      data: {
        content: [
          {
            serviceAccount: {
              identifier: "sa-1",
              name: "SA 1",
              email: "sa-1@service.harness.io",
            },
          },
        ],
        totalItems: 42,
      },
    });

    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ identifier: "sa-1" });
  });

  it("prefers totalElements when both pagination totals are present", () => {
    const result = serviceAccountListExtract({
      data: {
        content: [{ identifier: "plain" }],
        totalElements: 10,
        totalItems: 99,
      },
    });

    expect(result.total).toBe(10);
  });

  it("accepts a raw data array for non-aggregate list responses", () => {
    const result = serviceAccountListExtract({
      status: "SUCCESS",
      data: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
        },
      ],
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ identifier: "account-sa" });
  });
});
