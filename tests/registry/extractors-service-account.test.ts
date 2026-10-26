import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";
import { Registry } from "../../src/registry/index.js";
import { compactItems } from "../../src/utils/compact.js";
import type { Config } from "../../src/config.js";

const nestedAggregate = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    description: "Account automation",
    accountIdentifier: "acct-1",
    orgIdentifier: "platform",
    projectIdentifier: "demo",
    tags: { team: "devops" },
    governanceMetadata: { deny: false },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
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
  it("promotes nested serviceAccount identity fields and aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(nestedAggregate)).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      description: "Account automation",
      accountIdentifier: "acct-1",
      orgIdentifier: "platform",
      projectIdentifier: "demo",
      tags: { team: "devops" },
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("serviceAccount");
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("governanceMetadata");
  });

  it("keeps already-flat list DTOs without inventing aggregate metadata", () => {
    const flat = {
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "acct-1",
    };
    expect(flattenServiceAccountAggregate(flat)).toEqual(flat);
  });

  it("passes through non-objects unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps aggregate pages under data.content and flattens each item", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: { content: [nestedAggregate], totalItems: 1 },
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

  it("uses totalItems from aggregate pages when it exceeds the returned page size", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: { content: [nestedAggregate], totalItems: 42 },
      }),
    ).toEqual({
      items: [expect.objectContaining({ identifier: "ci-bot" })],
      total: 42,
    });
  });

  it("accepts raw data arrays used by account-scope list responses", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            name: "Account SA",
            email: "account-sa@service.harness.io",
            accountIdentifier: "acct-1",
          },
        ],
      }),
    ).toEqual({
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
});

describe("compact vs nested service account DTO", () => {
  it("default compact drops nested serviceAccount when identity is not flattened", () => {
    const registry = new Registry(makeConfig());
    const compactItem = registry.getResource("service_account").compactItem;
    const [slim] = compactItems([nestedAggregate], compactItem) as Record<string, unknown>[];
    expect(slim.identifier).toBeUndefined();
    expect(slim.email).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });

  it("compact keeps flattened identity and tokensCount for follow-up gets", () => {
    const registry = new Registry(makeConfig());
    const compactItem = registry.getResource("service_account").compactItem;
    const flattened = flattenServiceAccountAggregate(nestedAggregate) as Record<string, unknown>;
    const [slim] = compactItems([flattened], compactItem) as Record<string, unknown>[];
    expect(slim).toMatchObject({
      identifier: "ci-bot",
      email: "ci-bot@service.harness.io",
      tokensCount: 2,
    });
  });
});
