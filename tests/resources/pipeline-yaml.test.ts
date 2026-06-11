import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import { registerPipelineYamlResource } from "../../src/resources/pipeline-yaml.js";

type ResourceListResult = {
  resources: Array<{
    uri: string;
    name: string;
  }>;
};

type FakeResourceTemplateInstance = {
  uriTemplate: string;
  list: () => Promise<ResourceListResult>;
};

type ResourceReadResult = {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
};

const resourceTemplates = vi.hoisted((): FakeResourceTemplateInstance[] => []);

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@modelcontextprotocol/sdk/server/mcp.js")>();

  class FakeResourceTemplate {
    uriTemplate: string;
    list: () => Promise<ResourceListResult>;

    constructor(uriTemplate: string, options: { list: () => Promise<ResourceListResult> }) {
      this.uriTemplate = uriTemplate;
      this.list = options.list;
      resourceTemplates.push(this);
    }
  }

  return {
    ...actual,
    ResourceTemplate: FakeResourceTemplate,
  };
});

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.account.token.secret",
    HARNESS_ACCOUNT_ID: "account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "project",
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
    HARNESS_PIPELINE_VERSION: "0",
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

function setupResource(configOverrides: Partial<Config> = {}) {
  const server = {
    registerResource: vi.fn(),
  };
  const registry = {
    getResource: vi.fn(() => ({ scope: "project", scopeOptional: false })),
    dispatch: vi.fn(),
  };
  const client = {};

  registerPipelineYamlResource(
    server as never,
    registry as never,
    client as never,
    makeConfig(configOverrides),
  );

  const template = resourceTemplates.at(-1);
  if (!template) {
    throw new Error("Expected pipeline YAML resource template to be registered");
  }

  const readHandler = server.registerResource.mock.calls[0][3] as (uri: URL) => Promise<ResourceReadResult>;

  return { client, registry, server, template, readHandler };
}

describe("pipeline-yaml resource", () => {
  beforeEach(() => {
    resourceTemplates.length = 0;
    vi.clearAllMocks();
  });

  it("skips project-scoped discovery when default project is missing", async () => {
    const { registry, template } = setupResource({ HARNESS_PROJECT: undefined });

    const result = await template.list();

    expect(result).toEqual({ resources: [] });
    expect(registry.getResource).toHaveBeenCalledWith("pipeline");
    expect(registry.dispatch).not.toHaveBeenCalled();
  });

  it("skips project-scoped discovery when default org is empty", async () => {
    const { registry, template } = setupResource({ HARNESS_ORG: "   " });

    const result = await template.list();

    expect(result).toEqual({ resources: [] });
    expect(registry.getResource).toHaveBeenCalledWith("pipeline");
    expect(registry.dispatch).not.toHaveBeenCalled();
  });

  it("skips discovery when the pipeline toolset is disabled", async () => {
    const { registry, template } = setupResource();
    registry.getResource.mockImplementation(() => {
      throw new Error("Unknown resource_type: pipeline");
    });

    const result = await template.list();

    expect(result).toEqual({ resources: [] });
    expect(registry.dispatch).not.toHaveBeenCalled();
  });

  it("returns unavailable content when direct reads target a disabled pipeline toolset", async () => {
    const { registry, readHandler } = setupResource();
    registry.getResource.mockImplementation(() => {
      throw new Error("Unknown resource_type: pipeline");
    });
    registry.dispatch.mockImplementation(() => {
      throw new Error("Unknown resource_type: pipeline");
    });

    const result = await readHandler(new URL("pipeline:///pipeline_one"));

    expect(result.contents[0]).toMatchObject({
      uri: "pipeline:///pipeline_one",
      mimeType: "application/x-yaml",
    });
    expect(result.contents[0].text).toContain("resource unavailable");
    expect(registry.dispatch).not.toHaveBeenCalled();
  });

  it("lists pipeline resources when org and project defaults are available", async () => {
    const { client, registry, template } = setupResource({
      HARNESS_ORG: "org",
      HARNESS_PROJECT: "project",
    });
    registry.dispatch.mockResolvedValue({
      items: [
        { identifier: "pipeline_one", name: "Pipeline One" },
        { identifier: "pipeline_two" },
        { name: "Missing Identifier" },
      ],
    });

    const result = await template.list();

    expect(registry.dispatch).toHaveBeenCalledWith(
      client,
      "pipeline",
      "list",
      {
        org_id: "org",
        project_id: "project",
        size: 20,
        page: 0,
      },
      { tool: "pipeline_yaml_resource" },
    );
    expect(result).toEqual({
      resources: [
        { uri: "pipeline:///pipeline_one", name: "Pipeline One" },
        { uri: "pipeline:///pipeline_two", name: "pipeline_two" },
      ],
    });
  });
});
