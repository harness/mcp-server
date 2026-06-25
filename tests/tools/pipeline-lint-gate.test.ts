/**
 * Regression tests for pre-dispatch pipeline YAML lint in harness_create /
 * harness_update. The lint utility is unit-tested in pipeline-lint.test.ts;
 * these tests prove the tool handlers block on errors, skip the API call, and
 * surface warnings on success.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
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
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: "accept", content: { confirm: true } }),
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool.handler(args, {
        signal: new AbortController().signal,
        sendNotification: vi.fn(),
        _meta: {},
      }) as Promise<ToolResult>;
    },
  };
}

function parseResult(result: ToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

const CODEBASE_CONFLICT_YAML = `
pipeline:
  name: CI
  identifier: ci_pipe
  properties:
    ci:
      codebase:
        connectorRef: github_conn
        repoName: harness-code-repo
        build:
          type: branch
          spec:
            branch: main
  stages: []
`;

const TRIGGER_BRANCH_WARNING_YAML = `
pipeline:
  name: CI
  identifier: ci_pipe
  properties:
    ci:
      codebase:
        repoName: my-app
        build:
          type: branch
          spec:
            branch: <+trigger.branch>
  stages: []
`;

const V1_WITH_V0_STEP_YAML = `
pipeline:
  stages:
    - name: deploy
      steps:
        - step:
            type: K8sRollingDeploy
            spec:
              skipDryRun: false
`;

describe("harness_create — pipeline lint gate", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "new-pipe" } });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const client = makeClient(mockRequest);
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);
  });

  it("blocks v0 pipeline create when codebase has connectorRef and repoName", async () => {
    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: CODEBASE_CONFLICT_YAML },
    });

    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toContain("Pipeline YAML has 1 error(s)");
    expect(data.error).toContain("connectorRef");
    expect(data.error).toContain("repoName");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("blocks pipeline_v1 create when v0 step types are present", async () => {
    const result = await server.call("harness_create", {
      resource_type: "pipeline_v1",
      body: { yamlPipeline: V1_WITH_V0_STEP_YAML },
    });

    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toContain("K8sRollingDeploy");
    expect(data.error).toContain("v0 step type");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("creates v0 pipeline and attaches lint warnings without blocking", async () => {
    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: TRIGGER_BRANCH_WARNING_YAML },
    });

    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledOnce();
    const data = parseResult(result);
    const warnings = data._warnings as string[];
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("<+trigger.branch>");
  });

  it("lints raw YAML string bodies without yamlPipeline wrapper", async () => {
    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: CODEBASE_CONFLICT_YAML,
    });

    expect(result.isError).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("harness_update — pipeline lint gate", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "my-pipe" } });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const client = makeClient(mockRequest);
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(server, registry, client);
  });

  it("blocks pipeline update when lint finds blocking errors", async () => {
    const result = await server.call("harness_update", {
      resource_type: "pipeline",
      resource_id: "ci_pipe",
      body: { yamlPipeline: CODEBASE_CONFLICT_YAML },
    });

    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toContain("must be fixed before updating");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("updates pipeline_v1 and blocks on v0 step types in YAML", async () => {
    const result = await server.call("harness_update", {
      resource_type: "pipeline_v1",
      resource_id: "v1_pipe",
      body: { yamlPipeline: V1_WITH_V0_STEP_YAML },
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result).error).toContain("K8sRollingDeploy");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("updates v0 pipeline and surfaces lint warnings on success", async () => {
    const result = await server.call("harness_update", {
      resource_type: "pipeline",
      resource_id: "ci_pipe",
      body: { yamlPipeline: TRIGGER_BRANCH_WARNING_YAML },
    });

    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledOnce();
    const warnings = parseResult(result)._warnings as string[];
    expect(warnings[0]).toContain("null on manual runs");
  });
});

describe("harness_describe — pipeline_v1 create guidance", () => {
  it("surfaces clone.repo and global template catalog in createHint", async () => {
    const server = makeMcpServer();
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const { registerDescribeTool } = await import("../../src/tools/harness-describe.js");
    registerDescribeTool(server, registry);

    const result = await server.call("harness_describe", { resource_type: "pipeline_v1" });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.createHint).toContain("clone.repo");
    expect(data.createHint).toContain("template_v1");
    expect(data.createHint).toContain("global: true");
  });
});
