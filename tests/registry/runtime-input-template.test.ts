import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { RequestOptions } from "../../src/client/types.js";
import { Registry } from "../../src/registry/index.js";
import { runtimeInputExtract } from "../../src/registry/extractors.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "pipelines",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  };
}

function makeClient(requestFn?: (options: RequestOptions) => Promise<unknown>): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("runtimeInputExtract", () => {
  it("projects template yaml, flags, modules, and execute hint when inputs exist", () => {
    const raw = {
      data: {
        inputSetTemplateYaml: "pipeline:\n  variables:\n    - name: branch\n      value: <+input>",
        hasInputSets: true,
        modules: ["ci", "cd"],
      },
    };

    const result = runtimeInputExtract(raw) as Record<string, unknown>;
    expect(result.inputSetTemplateYaml).toContain("<+input>");
    expect(result.hasInputSets).toBe(true);
    expect(result.modules).toEqual(["ci", "cd"]);
    expect(result._hint).toContain("harness_execute(action='run', inputs={...})");
  });

  it("returns null yaml and no-inputs hint when template is absent", () => {
    const result = runtimeInputExtract({ data: {} }) as Record<string, unknown>;
    expect(result.inputSetTemplateYaml).toBeNull();
    expect(result.hasInputSets).toBe(false);
    expect(result.modules).toEqual([]);
    expect(result._hint).toContain("no runtime inputs");
  });
});

describe("runtime_input_template dispatch", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("POSTs to inputSets/template and returns projected shape without raw data envelope", async () => {
    const apiResponse = {
      data: {
        inputSetTemplateYaml: "pipeline:\n  name: deploy",
        hasInputSets: false,
        modules: ["cd"],
      },
    };
    const mockRequest = vi.fn().mockResolvedValue(apiResponse);
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "runtime_input_template", "get", {
      pipeline_id: "deploy_prod",
    });

    const req = mockRequest.mock.calls[0][0] as RequestOptions;
    expect(req.method).toBe("POST");
    expect(req.path).toContain("/pipeline/api/inputSets/template");
    expect(req.params?.pipelineIdentifier).toBe("deploy_prod");

    expect(result).toEqual({
      inputSetTemplateYaml: "pipeline:\n  name: deploy",
      hasInputSets: false,
      modules: ["cd"],
      _hint: expect.stringContaining("harness_execute"),
    });
    expect(result).not.toHaveProperty("data");
  });
});
