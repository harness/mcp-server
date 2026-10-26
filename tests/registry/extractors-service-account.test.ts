import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";
import { compactItems } from "../../src/utils/compact.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";

const nestedServiceAccount = {
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
  roleAssignmentMetadata: [{ identifier: "ra1", roleName: "Viewer" }],
};

function minimalConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "access_control",
  };
}

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity and aggregate meta", () => {
    expect(flattenServiceAccountAggregate(nestedServiceAccount)).toEqual({
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
  });

  it("keeps whitelisted fields on already-flat list items", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "account-sa",
        name: "Account SA",
        email: "account-sa@service.harness.io",
        accountIdentifier: "test-account",
        tokensCount: 99,
        governanceMetadata: { deny: true },
      }),
    ).toEqual({
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "test-account",
    });
  });

  it("does not copy aggregate meta onto flat DTOs", () => {
    const flat = {
      identifier: "flat",
      email: "flat@service.harness.io",
      tokensCount: 5,
    };
    expect(flattenServiceAccountAggregate(flat)).toEqual({
      identifier: "flat",
      email: "flat@service.harness.io",
    });
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps paginated aggregate envelopes and flattens each item", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: {
          content: [nestedServiceAccount],
          totalItems: 1,
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
      total: 1,
    });
  });

  it("accepts raw data arrays (non-paginated account list)", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            email: "account-sa@service.harness.io",
            accountIdentifier: "test-account",
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          identifier: "account-sa",
          email: "account-sa@service.harness.io",
          accountIdentifier: "test-account",
        },
      ],
      total: 1,
    });
  });
});

describe("compact vs nested service account DTO", () => {
  it("default compact drops nested serviceAccount and email when identity is not flattened", () => {
    const [slim] = compactItems([nestedServiceAccount]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });

  it("resource compactItem keeps email after flattening", () => {
    const registry = new Registry(minimalConfig());
    const compactItem = registry.getResource("service_account").compactItem;
    const [slim] = compactItems(
      [flattenServiceAccountAggregate(nestedServiceAccount)],
      compactItem,
    ) as Record<string, unknown>[];
    expect(slim).toMatchObject({
      identifier: "ci-bot",
      email: "ci-bot@service.harness.io",
      tokensCount: 2,
    });
    expect(slim.governanceMetadata).toBeUndefined();
    expect(slim.roleAssignmentMetadata).toBeUndefined();
  });
});
