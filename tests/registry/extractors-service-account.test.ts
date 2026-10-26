/**
 * Unit tests for service account list flattening (#1152).
 * Aggregate and raw-array NG responses must not be dropped or lose email in compact mode.
 */
import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";
import { compactItems } from "../../src/utils/compact.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";

const nestedAggregate = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    description: "Account automation",
    accountIdentifier: "test-account",
    orgIdentifier: "platform",
    projectIdentifier: "dev",
    governanceMetadata: { deny: false },
    tags: { team: "platform" },
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
  it("promotes nested serviceAccount identity fields and keeps aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(nestedAggregate)).toMatchObject({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@service.harness.io",
      accountIdentifier: "test-account",
      orgIdentifier: "platform",
      projectIdentifier: "dev",
      tags: { team: "platform" },
      tokensCount: 2,
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
    });
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("serviceAccount");
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("governanceMetadata");
  });

  it("keeps already-flat DTO fields without aggregate metadata keys", () => {
    const flat = {
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "test-account",
    };
    expect(flattenServiceAccountAggregate(flat)).toEqual(flat);
  });

  it("passes through non-record values unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
  });

  it("ignores a non-object serviceAccount wrapper and reads top-level identity fields", () => {
    const malformed = {
      serviceAccount: "not-an-object",
      identifier: "still-visible",
      email: "still@service.harness.io",
      tokensCount: 1,
    };
    expect(flattenServiceAccountAggregate(malformed)).toEqual({
      identifier: "still-visible",
      email: "still@service.harness.io",
    });
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps raw data arrays used by account-scope list responses", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            name: "Account SA",
            email: "account-sa@service.harness.io",
            accountIdentifier: "test-account",
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
          accountIdentifier: "test-account",
        },
      ],
      total: 1,
    });
  });

  it("unwraps paginated aggregate content and flattens each item", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
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
});

describe("service account compact mode", () => {
  it("retains email when items are flattened before compactItem runs", () => {
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

  it("drops email from nested aggregate rows when flattening was skipped", () => {
    const registry = new Registry(makeConfig());
    const compactItem = registry.getResource("service_account").compactItem;
    const [slim] = compactItems([nestedAggregate], compactItem) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
  });
});
