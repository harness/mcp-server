import { describe, expect, it } from "vitest";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import { compactItems } from "../../src/utils/compact.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
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
    ...overrides,
  };
}

const nestedAggregate = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@example.com",
    accountIdentifier: "acct",
    orgIdentifier: "platform",
    projectIdentifier: "dev",
    governanceMetadata: { deny: false },
  },
  createdAt: 1_700_000_000_000,
  lastModifiedAt: 1_700_000_100_000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and keeps aggregate metadata", () => {
    expect(flattenServiceAccountAggregate(nestedAggregate)).toEqual({
      identifier: "ci-bot",
      name: "CI Bot",
      email: "ci-bot@example.com",
      accountIdentifier: "acct",
      orgIdentifier: "platform",
      projectIdentifier: "dev",
      createdAt: 1_700_000_000_000,
      lastModifiedAt: 1_700_000_100_000,
      tokensCount: 2,
    });
    expect(flattenServiceAccountAggregate(nestedAggregate)).not.toHaveProperty("governanceMetadata");
  });

  it("keeps already-flat service account DTOs unchanged", () => {
    const flat = {
      identifier: "sa-1",
      name: "Flat",
      email: "flat@example.com",
    };
    expect(flattenServiceAccountAggregate(flat)).toEqual(flat);
  });

  it("passes through non-record items", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("raw")).toBe("raw");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps raw array responses from account-scope /serviceaccount lists", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [nestedAggregate, { identifier: "other", email: "o@example.com" }],
      }),
    ).toEqual({
      items: [
        expect.objectContaining({ identifier: "ci-bot", email: "ci-bot@example.com", tokensCount: 2 }),
        { identifier: "other", email: "o@example.com" },
      ],
      total: 2,
    });
  });

  it("unwraps paginated aggregate list envelopes", () => {
    expect(
      serviceAccountListExtract({
        data: { content: [nestedAggregate], totalElements: 1 },
      }),
    ).toEqual({
      items: [expect.objectContaining({ identifier: "ci-bot", email: "ci-bot@example.com" })],
      total: 1,
    });
  });

  it("preserves totalElements when larger than the returned page", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: {
          content: [nestedAggregate],
          totalElements: 42,
        },
      }),
    ).toEqual({
      items: [expect.objectContaining({ identifier: "ci-bot", email: "ci-bot@example.com" })],
      total: 42,
    });
  });

  it("unwraps aggregate pages that report totalItems (NG service account list shape)", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: {
          content: [nestedAggregate],
          totalItems: 99,
        },
      }),
    ).toEqual({
      items: [expect.objectContaining({ identifier: "ci-bot" })],
      total: 99,
    });
  });

  it("returns empty items when the envelope has no recognizable list shape", () => {
    expect(serviceAccountListExtract({ status: "SUCCESS" })).toEqual({
      items: [],
      total: 0,
    });
  });
});

describe("compact vs nested service account DTO", () => {
  it("default compact drops nested serviceAccount and email when identity is not flattened", () => {
    const [slim] = compactItems([nestedAggregate]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });

  it("service_account compactItem keeps email only after flattening", () => {
    const registry = new Registry(makeConfig());
    const compactItem = registry.getResource("service_account").compactItem;
    const flat = flattenServiceAccountAggregate(nestedAggregate) as Record<string, unknown>;
    const [slim] = compactItems([flat], compactItem) as Record<string, unknown>[];
    expect(slim.email).toBe("ci-bot@example.com");
    expect(slim.identifier).toBe("ci-bot");
    expect(slim.tokensCount).toBe(2);
  });
});
