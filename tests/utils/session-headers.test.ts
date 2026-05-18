import { describe, expect, it } from "vitest";
import type { Config } from "../../src/config.js";
import {
  mergeConfigWithSessionHeaders,
  MissingSessionCredentialsError,
  parseAutoApproveRiskHeader,
  parsePipelineVersionHeader,
} from "../../src/utils/session-headers.js";

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: undefined,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_MCP_AUTH_TOKEN: undefined,
    HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_PIPELINE_VERSION: undefined,
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

describe("session header parsing", () => {
  it("parses pipeline version headers", () => {
    expect(parsePipelineVersionHeader({ "x-harness-pipeline-version": "1" })).toBe("1");
    expect(parsePipelineVersionHeader({ "x-harness-pipeline-version": "0" })).toBe("0");
    expect(parsePipelineVersionHeader({ "x-harness-pipeline-version": "2" })).toBeUndefined();
  });

  it("parses auto-approve risk headers case-insensitively", () => {
    expect(parseAutoApproveRiskHeader({ "x-harness-auto-approve-risk": "ALL" })).toBe("all");
    expect(parseAutoApproveRiskHeader({ "x-harness-auto-approve-risk": " medium_write " })).toBe("medium_write");
    expect(parseAutoApproveRiskHeader({ "x-harness-auto-approve-risk": "read" })).toBeUndefined();
  });

  it("merges valid session headers without mutating the base config", () => {
    const base = makeConfig();
    base.HARNESS_AUTO_APPROVE_RISK = "high_write";
    const merged = mergeConfigWithSessionHeaders(base, {
      "x-harness-pipeline-version": "1",
      "x-harness-auto-approve-risk": "medium_write",
    });
    expect(merged).not.toBe(base);
    expect(merged.HARNESS_PIPELINE_VERSION).toBe("1");
    expect(merged.HARNESS_AUTO_APPROVE_RISK).toBe("medium_write");
    expect(base.HARNESS_PIPELINE_VERSION).toBeUndefined();
    expect(base.HARNESS_AUTO_APPROVE_RISK).toBe("high_write");
  });

  it("caps session auto-approve risk at the deployment threshold", () => {
    const base = makeConfig();
    base.HARNESS_AUTO_APPROVE_RISK = "low_write";

    const merged = mergeConfigWithSessionHeaders(base, {
      "x-harness-auto-approve-risk": "all",
    });

    expect(merged.HARNESS_AUTO_APPROVE_RISK).toBe("low_write");
    expect(base.HARNESS_AUTO_APPROVE_RISK).toBe("low_write");
  });

  it("allows session auto-approve headers to reduce the deployment threshold", () => {
    const base = makeConfig();
    base.HARNESS_AUTO_APPROVE_RISK = "all";

    const merged = mergeConfigWithSessionHeaders(base, {
      "x-harness-auto-approve-risk": "none",
    });

    expect(merged.HARNESS_AUTO_APPROVE_RISK).toBe("none");
  });
});

describe("multi-user session credentials", () => {
  it("merges x-harness-api-key and x-harness-account-id into session config", () => {
    const base = makeConfig({ HARNESS_MCP_MODE: "multi-user", HARNESS_API_KEY: "", HARNESS_ACCOUNT_ID: "" });
    const merged = mergeConfigWithSessionHeaders(base, {
      "x-harness-api-key": "pat.user1.tok.sec",
      "x-harness-account-id": "user1",
    });
    expect(merged.HARNESS_API_KEY).toBe("pat.user1.tok.sec");
    expect(merged.HARNESS_ACCOUNT_ID).toBe("user1");
  });

  it("merges x-harness-org and x-harness-project as session defaults", () => {
    const base = makeConfig({ HARNESS_MCP_MODE: "multi-user", HARNESS_API_KEY: "", HARNESS_ACCOUNT_ID: "" });
    const merged = mergeConfigWithSessionHeaders(base, {
      "x-harness-api-key": "pat.user1.tok.sec",
      "x-harness-account-id": "user1",
      "x-harness-org": "user-org",
      "x-harness-project": "user-project",
    });
    expect(merged.HARNESS_ORG).toBe("user-org");
    expect(merged.HARNESS_PROJECT).toBe("user-project");
  });

  it("throws MissingSessionCredentialsError when api key is missing in multi-user mode", () => {
    const base = makeConfig({ HARNESS_MCP_MODE: "multi-user", HARNESS_API_KEY: "", HARNESS_ACCOUNT_ID: "" });
    expect(() =>
      mergeConfigWithSessionHeaders(base, {
        "x-harness-account-id": "user1",
      }),
    ).toThrow(MissingSessionCredentialsError);
  });

  it("throws MissingSessionCredentialsError when account id is missing in multi-user mode", () => {
    const base = makeConfig({ HARNESS_MCP_MODE: "multi-user", HARNESS_API_KEY: "", HARNESS_ACCOUNT_ID: "" });
    expect(() =>
      mergeConfigWithSessionHeaders(base, {
        "x-harness-api-key": "pat.user1.tok.sec",
      }),
    ).toThrow(MissingSessionCredentialsError);
  });

  it("throws when PAT account ID does not match x-harness-account-id", () => {
    const base = makeConfig({ HARNESS_MCP_MODE: "multi-user", HARNESS_API_KEY: "", HARNESS_ACCOUNT_ID: "" });
    expect(() =>
      mergeConfigWithSessionHeaders(base, {
        "x-harness-api-key": "pat.accountA.tok.sec",
        "x-harness-account-id": "accountB",
      }),
    ).toThrow(MissingSessionCredentialsError);
  });

  it("allows non-PAT tokens without account ID validation", () => {
    const base = makeConfig({ HARNESS_MCP_MODE: "multi-user", HARNESS_API_KEY: "", HARNESS_ACCOUNT_ID: "" });
    const merged = mergeConfigWithSessionHeaders(base, {
      "x-harness-api-key": "sat.sometoken.secret",
      "x-harness-account-id": "any-account",
    });
    expect(merged.HARNESS_ACCOUNT_ID).toBe("any-account");
  });

  it("does not require session credential headers in personal mode", () => {
    const base = makeConfig();
    const merged = mergeConfigWithSessionHeaders(base, {});
    expect(merged).toBe(base);
  });

  it("allows personal mode sessions to override org and project via headers", () => {
    const base = makeConfig();
    const merged = mergeConfigWithSessionHeaders(base, {
      "x-harness-org": "override-org",
      "x-harness-project": "override-project",
    });
    expect(merged.HARNESS_ORG).toBe("override-org");
    expect(merged.HARNESS_PROJECT).toBe("override-project");
    expect(merged.HARNESS_API_KEY).toBe(base.HARNESS_API_KEY);
  });

  it("ignores x-harness-api-key and x-harness-account-id in personal mode", () => {
    const base = makeConfig();
    const merged = mergeConfigWithSessionHeaders(base, {
      "x-harness-api-key": "pat.attacker.tok.sec",
      "x-harness-account-id": "attacker-account",
    });
    expect(merged.HARNESS_API_KEY).toBe(base.HARNESS_API_KEY);
    expect(merged.HARNESS_ACCOUNT_ID).toBe(base.HARNESS_ACCOUNT_ID);
  });
});
