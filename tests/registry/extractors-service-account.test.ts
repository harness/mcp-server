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
    tags: { env: "prod", team: "platform" },
    accountIdentifier: "acct",
    orgIdentifier: "platform",
    projectIdentifier: "demo",
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
  governanceMetadata: { deny: false },
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity, description, and tags", () => {
    expect(flattenServiceAccountAggregate(nestedAggregate)).toMatchObject({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      tags: { env: "prod", team: "platform" },
      accountIdentifier: "acct",
      orgIdentifier: "platform",
      projectIdentifier: "demo",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("serviceAccount");
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("governanceMetadata");
  });

  it("keeps flat DTO fields and omits aggregate meta when not nested", () => {
    const flat = { identifier: "plain", email: "plain@service.harness.io", description: "dto" };
    expect(flattenServiceAccountAggregate(flat)).toMatchObject(flat);
    expect(flattenServiceAccountAggregate(flat)).not.toHaveProperty("tokensCount");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps paginated aggregate envelope and flattens nested rows", () => {
    const result = serviceAccountListExtract({
      status: "SUCCESS",
      data: { content: [nestedAggregate], totalItems: 1 },
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      identifier: "ci-bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      tags: { env: "prod", team: "platform" },
      tokensCount: 2,
    });
  });

  it("accepts raw data array responses without dropping rows", () => {
    const result = serviceAccountListExtract({
      status: "SUCCESS",
      data: [
        {
          identifier: "account-sa",
          email: "account-sa@service.harness.io",
          description: "Account scope list",
        },
      ],
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      identifier: "account-sa",
      email: "account-sa@service.harness.io",
      description: "Account scope list",
    });
  });
});
