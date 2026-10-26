import { describe, expect, it } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import {
  flattenServiceAccountAggregate,
  serviceAccountListExtract,
} from "../../src/registry/extractors.js";
import { compactItems } from "../../src/utils/compact.js";

function makeConfig(): Config {
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

const nestedAggregate = {
  serviceAccount: {
    identifier: "ci-bot",
    name: "CI Bot",
    email: "ci-bot@service.harness.io",
    description: "Account automation",
    accountIdentifier: "acct-1",
    orgIdentifier: "platform",
    projectIdentifier: "dev",
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
      projectIdentifier: "dev",
      createdAt: 1710000000000,
      lastModifiedAt: 1710000001000,
      tokensCount: 2,
    });
  });

  it("does not copy governanceMetadata or the nested serviceAccount envelope", () => {
    const flat = flattenServiceAccountAggregate(nestedAggregate) as Record<string, unknown>;
    expect(flat.governanceMetadata).toBeUndefined();
    expect(flat.serviceAccount).toBeUndefined();
  });

  it("keeps already-flat DTO fields without aggregate metadata keys", () => {
    expect(
      flattenServiceAccountAggregate({
        identifier: "account-sa",
        name: "Account SA",
        email: "account-sa@service.harness.io",
        accountIdentifier: "acct-1",
      }),
    ).toEqual({
      identifier: "account-sa",
      name: "Account SA",
      email: "account-sa@service.harness.io",
      accountIdentifier: "acct-1",
    });
  });

  it("passes through non-record values unchanged", () => {
    expect(flattenServiceAccountAggregate(null)).toBe(null);
    expect(flattenServiceAccountAggregate("legacy")).toBe("legacy");
  });
});

describe("serviceAccountListExtract", () => {
  it("unwraps a raw data array (non-aggregate list) and flattens each item", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: [
          {
            identifier: "account-sa",
            name: "Account SA",
            email: "account-sa@service.harness.io",
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          identifier: "account-sa",
          name: "Account SA",
          email: "account-sa@service.harness.io",
        },
      ],
      total: 1,
    });
  });

  it("unwraps paginated aggregate content and preserves totalElements", () => {
    expect(
      serviceAccountListExtract({
        status: "SUCCESS",
        data: {
          content: [nestedAggregate],
          totalElements: 42,
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
      total: 42,
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
  it("default compact drops email when identity is still nested under serviceAccount", () => {
    const [slim] = compactItems([nestedAggregate]) as Record<string, unknown>[];
    expect(slim.email).toBeUndefined();
    expect(slim.identifier).toBeUndefined();
    expect(slim.serviceAccount).toBeUndefined();
  });

  it("service_account compactItem retains email after flattening (account-scope list contract)", () => {
    const compactItem = new Registry(makeConfig()).getResource("service_account").compactItem;
    expect(compactItem).toBeDefined();

    const [flat] = serviceAccountListExtract({
      data: { content: [nestedAggregate], totalElements: 1 },
    }).items as Record<string, unknown>[];
    const [slim] = compactItems([flat], compactItem) as Record<string, unknown>[];
    expect(slim.email).toBe("ci-bot@service.harness.io");
    expect(slim.identifier).toBe("ci-bot");
    expect(slim.tokensCount).toBe(2);
  });
});
