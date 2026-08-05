/**
 * Trigger list deep links must keep the parent pipeline id from the request
 * (via triggerListExtract) — not overwrite it with item.identifier (the trigger id).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

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

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("trigger list deep links", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
  });

  it("keeps request pipeline_id in openInHarness (not item.identifier)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        content: [
          { identifier: "mcp_yaml_verify_cron", name: "mcp_yaml_verify_cron", type: "Scheduled" },
        ],
        totalElements: 1,
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "trigger", "list", {
      org_id: "default",
      project_id: "test-project",
      pipeline_id: "test",
    })) as { items: Array<Record<string, unknown>> };

    const link = result.items[0]!.openInHarness as string;
    expect(link).toContain("/pipelines/test/triggers");
    expect(link).not.toContain("/pipelines/mcp_yaml_verify_cron/");
  });

  it("prefers item.pipelineIdentifier over request pipeline_id when present", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        content: [
          {
            identifier: "mcp_yaml_verify_cron",
            name: "mcp_yaml_verify_cron",
            pipelineIdentifier: "otherPipe",
          },
        ],
        totalElements: 1,
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "trigger", "list", {
      org_id: "default",
      project_id: "test-project",
      pipeline_id: "test",
    })) as { items: Array<Record<string, unknown>> };

    const link = result.items[0]!.openInHarness as string;
    expect(link).toContain("/pipelines/otherPipe/triggers");
    expect(link).not.toContain("/pipelines/test/");
    expect(link).not.toContain("/pipelines/mcp_yaml_verify_cron/");
  });
});

describe("trigger delete targetIdentifier", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
  });

  it("sends pipeline_id as targetIdentifier query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: true });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "trigger", "delete", {
      org_id: "default",
      project_id: "test-project",
      trigger_id: "mcp_yaml_verify_cron",
      pipeline_id: "test",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/pipeline/api/triggers/mcp_yaml_verify_cron");
    expect(call.params.targetIdentifier).toBe("test");
  });

  it("throws when pipeline_id is missing", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "trigger", "delete", {
        org_id: "default",
        project_id: "test-project",
        trigger_id: "mcp_yaml_verify_cron",
      }),
    ).rejects.toThrow(/Missing required param\(s\) for trigger\.delete: pipeline_id/);
  });
});

describe("trigger get targetIdentifier", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
  });

  it("sends pipeline_id as targetIdentifier query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "trigger", "get", {
      org_id: "default",
      project_id: "test-project",
      trigger_id: "mcp_yaml_verify_cron",
      pipeline_id: "test",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/pipeline/api/triggers/mcp_yaml_verify_cron");
    expect(call.params.targetIdentifier).toBe("test");
  });
});

describe("trigger update YAML body", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
  });

  it("parses YAML string body and sends NGTriggerConfigV2 object YAML", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS", data: {} });
    const client = makeClient(mockRequest);
    const yamlBody = [
      "trigger:",
      "  name: my-trigger",
      "  identifier: myTrigger",
      "  pipelineIdentifier: myPipeline",
      "  source:",
      "    type: Scheduled",
    ].join("\n");

    await registry.dispatch(client, "trigger", "update", {
      org_id: "default",
      project_id: "test-project",
      trigger_id: "myTrigger",
      body: yamlBody,
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
      body: string;
    };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/pipeline/api/triggers/myTrigger");
    expect(call.params.targetIdentifier).toBe("myPipeline");
    expect(call.body).toContain("pipelineIdentifier: myPipeline");
    expect(call.body).not.toMatch(/^trigger: \|\s/m);
    expect(call.body).not.toContain("trigger: |\n  trigger:");
  });

  it("invalid YAML string body throws a clear error", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "trigger", "update", {
        org_id: "default",
        project_id: "test-project",
        trigger_id: "myTrigger",
        body: "trigger:\n  name: [unclosed",
      }),
    ).rejects.toThrow(/body must be a JSON object or YAML object for trigger/);
  });
});
