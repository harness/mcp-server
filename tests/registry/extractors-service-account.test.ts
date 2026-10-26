import { describe, expect, it, beforeEach } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import { compactItems } from "../../src/utils/compact.js";

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

const nestedAggregate = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    description: "Account automation",
    tags: { team: "platform" },
    accountIdentifier: "test-account",
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
      tags: { team: "platform" },
      accountIdentifier: "test-account",
      orgIdentifier: "platform",
      projectIdentifier: "demo",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
  });

  it("passes through already-flat DTOs and only keeps known identity fields", () => {
    const flat = {
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "test-account",
      tokensCount: 99,
      governanceMetadata: { deny: false },
    };
    expect(flattenServiceAccountAggregate(flat)).toEqual({
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "test-account",
    });
  });

  it("returns non-records unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps Spring page content and flattens nested rows", () => {
    expect(
      serviceAccountListExtract({
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

  it("accepts raw data arrays from non-aggregate list endpoints", () => {
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
});

describe("compact vs nested service account DTO", () => {
  let compactFn: (item: Record<string, unknown>) => Record<string, unknown>;

  beforeEach(() => {
    const registry = new Registry(makeConfig());
    compactFn = registry.getResource("service_account").compactItem!;
  });

  it("default compact drops nested serviceAccount email when identity is not flattened", () => {
    const [slim] = compactItems([nestedAggregate]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });

  it("service_account compactItem keeps email after flattening", () => {
    const flattened = flattenServiceAccountAggregate(nestedAggregate) as Record<string, unknown>;
    const [slim] = compactItems([flattened], compactFn) as Record<string, unknown>[];
    expect(slim.email).toBe("ci-bot@service.harness.io");
    expect(slim.identifier).toBe("ci-bot");
    expect(slim.tokensCount).toBe(2);
  });
});
