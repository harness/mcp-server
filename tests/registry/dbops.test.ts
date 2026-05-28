import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("dbops registry mappings", () => {
  it("executes the LLM authoring pipeline with nested harness_create body fields", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "dbops" }));
    const mockRequest = vi.fn().mockResolvedValue({
      pipelineExecutionId: "exec-123",
      pipelineIdentifier: "authoring_pipeline",
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "database_execute_llm_authoring_pipeline", "create", {
      body: {
        schema_id: "accounts",
        instance_id: "prod-db",
        conversation_id: "conversation-123",
        changeset: "databaseChangeLog: []",
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/dbops/v1/orgs/default/projects/test-project/execute-llm-authoring-pipeline",
      body: {
        schemaIdentifier: "accounts",
        instanceIdentifier: "prod-db",
        conversationId: "conversation-123",
        changeset: "databaseChangeLog: []",
        orgIdentifier: "default",
        projectIdentifier: "test-project",
      },
    }));
  });
});
