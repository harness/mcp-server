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
    governanceMetadata: { deny: false },
  },
  createdAt: 1710000000000,
  lastModifiedAt: 1710000001000,
  tokensCount: 2,
};

describe("flattenServiceAccountAggregate", () => {
  it("promotes nested serviceAccount identity fields and keeps aggregate metadata", () => {
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

  it("passes through already-flat DTOs without aggregate metadata keys", () => {
    const flat = {
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "acct-1",
    };
    expect(flattenServiceAccountAggregate(flat)).toEqual(flat);
  });

  it("returns non-objects unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("raw")).toBe("raw");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps paginated aggregate envelopes and flattens each item", () => {
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

  it("accepts raw data arrays (account-scope lists) without dropping items", () => {
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

  it("returns empty lists for empty envelopes", () => {
    expect(serviceAccountListExtract({ status: "SUCCESS", data: { content: [], totalElements: 0 } })).toEqual({
      items: [],
      total: 0,
    });
    expect(serviceAccountListExtract({ status: "SUCCESS", data: [] })).toEqual({
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

  it("service_account compactItem keeps email after flattening (account-scope list regression)", () => {
    const config: Config = {
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
    const compactItem = new Registry(config).getResource("service_account").compactItem!;
    const flattened = flattenServiceAccountAggregate(nestedAggregate) as Record<string, unknown>;
    const slim = compactItem(flattened);
    expect(slim.email).toBe("ci-bot@service.harness.io");
    expect(slim.identifier).toBe("ci-bot");
    expect(slim.tokensCount).toBe(2);
  });
});
