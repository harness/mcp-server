import { describe, expect, it } from "vitest";
import type { Config } from "../../src/config.js";
import {
  mergeConfigWithSessionHeaders,
  parseAutoApproveRiskHeader,
  parsePipelineVersionHeader,
} from "../../src/utils/session-headers.js";

function makeConfig(): Config {
  return {
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
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_PIPELINE_VERSION: undefined,
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
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
