import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "stephenAnsible",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  } as Config;
}

function makeClient(requestFn: ReturnType<typeof vi.fn>): HarnessClient {
  return { request: requestFn, account: "test-account" } as unknown as HarnessClient;
}

describe("llm_model", () => {
  it("declares list-only discovery metadata with required provider filter", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    const def = registry.getResource("llm_model");
    expect(def.toolset).toBe("connectors");
    expect(def.scope).toBe("account");
    expect(def.supportedScopes).toEqual(["account", "org", "project"]);
    expect(def.scopeOptional).toBe(true);
    expect(def.identifierFields).toEqual([]);
    expect(def.operations.list).toBeDefined();
    expect(def.operations.get).toBeUndefined();
    const providerField = def.listFilterFields?.find((f) => f.name === "provider");
    expect(providerField?.required).toBe(true);
    expect(providerField?.enum).toEqual(
      expect.arrayContaining(["ANTHROPIC", "OPENAI", "GITHUB_COPILOT", "HARNESS_OPENAI", "HARNESS_ANTHROPIC"]),
    );
  });

  it("POSTs discovery body to llm-connector/models at account scope and returns options", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors", HARNESS_ORG: "o", HARNESS_PROJECT: "p" }));
    const request = vi.fn().mockResolvedValue({ status: "SUCCESS", data: [{ value: "claude", displayName: "Claude" }] });
    const client = makeClient(request);
    const res = await registry.dispatch(client, "llm_model", "list", {
      provider: "ANTHROPIC",
      authentication: { type: "Token", spec: { tokenRef: "account.s" } },
    });
    const call = request.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/llm-connector/models");
    expect(call.body).toMatchObject({ provider: "ANTHROPIC", authentication: { type: "Token" } });
    expect(call.params?.orgIdentifier).toBeUndefined();
    expect(call.params?.projectIdentifier).toBeUndefined();
    expect(JSON.stringify(res)).toContain("displayName");
  });

  it("merges optional discovery fields from body when provider is a top-level filter", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    const request = vi.fn().mockResolvedValue({ status: "SUCCESS", data: [] });
    const client = makeClient(request);
    await registry.dispatch(client, "llm_model", "list", {
      provider: "OPENAI",
      body: {
        authentication: { type: "Token", spec: { tokenRef: "account.openai" } },
        url: "https://api.example.com",
        region: "us-east-1",
      },
    });
    const call = request.mock.calls[0][0];
    expect(call.body).toEqual({
      provider: "OPENAI",
      authentication: { type: "Token", spec: { tokenRef: "account.openai" } },
      url: "https://api.example.com",
      region: "us-east-1",
    });
  });

  it("requires provider as a top-level list filter (body-only provider is rejected)", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    const client = makeClient(vi.fn());
    await expect(
      registry.dispatch(client, "llm_model", "list", {
        body: { provider: "OPENAI", authentication: { type: "Token", spec: { tokenRef: "account.s" } } },
      }),
    ).rejects.toThrow(/Missing required filter\(s\) for listing llm_model: provider/);
  });

  it("prefers top-level list params over body for the same discovery field", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    const request = vi.fn().mockResolvedValue({ status: "SUCCESS", data: [] });
    const client = makeClient(request);
    await registry.dispatch(client, "llm_model", "list", {
      provider: "ANTHROPIC",
      body: { provider: "OPENAI", region: "eu-west-1" },
      region: "us-west-2",
    });
    const call = request.mock.calls[0][0];
    expect(call.body).toEqual({
      provider: "ANTHROPIC",
      authentication: undefined,
      url: undefined,
      region: "us-west-2",
    });
  });

  it("injects org/project query params only when caller supplies them (scopeOptional)", async () => {
    const registry = new Registry(makeConfig({
      HARNESS_TOOLSETS: "connectors",
      HARNESS_ORG: "config-org",
      HARNESS_PROJECT: "config-project",
    }));
    const request = vi.fn().mockResolvedValue({ status: "SUCCESS", data: [] });
    const client = makeClient(request);

    await registry.dispatch(client, "llm_model", "list", {
      provider: "GITHUB_COPILOT",
      authentication: { type: "Token", spec: { tokenRef: "org.secret" } },
      org_id: "my-org",
      project_id: "my-project",
    });
    const scopedCall = request.mock.calls[0][0];
    expect(scopedCall.params?.orgIdentifier).toBe("my-org");
    expect(scopedCall.params?.projectIdentifier).toBe("my-project");

    await registry.dispatch(client, "llm_model", "list", {
      provider: "GITHUB_COPILOT",
      authentication: { type: "Token", spec: { tokenRef: "account.secret" } },
    });
    const accountCall = request.mock.calls[1][0];
    expect(accountCall.params?.orgIdentifier).toBeUndefined();
    expect(accountCall.params?.projectIdentifier).toBeUndefined();
  });

  it("compactItem surfaces value and displayName for list responses", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    const def = registry.getResource("llm_model");
    expect(def.compactItem?.({ value: "gpt-4", displayName: "GPT-4", extra: "ignored" })).toEqual({
      value: "gpt-4",
      displayName: "GPT-4",
    });
  });
});
