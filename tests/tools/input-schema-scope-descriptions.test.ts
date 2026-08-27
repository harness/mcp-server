import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import {
  describeScopeHint,
  orgIdDescription,
  projectIdDescription,
  RESOURCE_SCOPE_DESCRIPTION,
} from "../../src/tools/input-schemas.js";

type InputSchema = Record<string, { description?: string | null } | undefined>;

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
    ...overrides,
  };
}

function makeClient(): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue({ data: {} }),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, {
    schema: { inputSchema: InputSchema; description?: string };
    handler?: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }> }>;
  }>();
  return {
    registerTool: vi.fn((
      name: string,
      schema: { inputSchema: InputSchema; description?: string },
      handler?: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }> }>,
    ) => {
      tools.set(name, { schema, handler });
    }),
    schema(name: string): { inputSchema: InputSchema; description?: string } {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool.schema;
    },
    async call(name: string, args: Record<string, unknown>) {
      const tool = tools.get(name);
      if (!tool?.handler) throw new Error(`Tool "${name}" not registered`);
      const extra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, extra);
    },
  };
}

describe("scope field descriptions", () => {
  it("names the configured default when HARNESS_ORG / HARNESS_PROJECT are set", () => {
    expect(orgIdDescription("SrikarOrg")).toContain("overrides configured default 'SrikarOrg'");
    expect(projectIdDescription("SrikarProject")).toContain("overrides configured default 'SrikarProject'");
    expect(orgIdDescription("SrikarOrg")).not.toContain("no configured default");
  });

  it("does not imply a default exists when env/session defaults are unset", () => {
    for (const value of [undefined, "", "   "]) {
      expect(orgIdDescription(value)).toContain("no configured default");
      expect(orgIdDescription(value)).toContain("pass the current org_id on the first call");
      expect(projectIdDescription(value)).toContain("no configured default");
      expect(projectIdDescription(value)).toContain("pass the current project_id on the first call");
      expect(orgIdDescription(value)).not.toMatch(/overrides default/i);
    }
  });

  it("does not tell the model that account scope is a way to skip known org/project", () => {
    expect(RESOURCE_SCOPE_DESCRIPTION).toContain("do not use account to skip a known org/project");
    expect(RESOURCE_SCOPE_DESCRIPTION).not.toContain("omit org/project defaults");
  });

  it("harness_describe scopeHint requires explicit ids when defaults are unset", () => {
    expect(
      describeScopeHint({ scopeOptional: false, hasOrgDefault: false, hasProjectDefault: false }),
    ).toContain("no configured org/project default");
    expect(
      describeScopeHint({ scopeOptional: false, hasOrgDefault: true, hasProjectDefault: true }),
    ).toContain("configured org/project defaults");
  });

  it("harness_describe scopeHint for scopeOptional resources forbids default fallback", () => {
    const hint = describeScopeHint({
      scopeOptional: true,
      hasOrgDefault: true,
      hasProjectDefault: true,
    });
    expect(hint).toContain("no fallback to configured defaults");
    expect(hint).not.toContain("configured org/project defaults");
  });

  it("harness_describe scopeHint requires explicit ids when only one default is configured", () => {
    for (const partial of [
      { hasOrgDefault: true, hasProjectDefault: false },
      { hasOrgDefault: false, hasProjectDefault: true },
    ]) {
      expect(
        describeScopeHint({ scopeOptional: false, ...partial }),
      ).toContain("no configured org/project default");
    }
  });

  it("trims whitespace before treating env defaults as configured", () => {
    expect(orgIdDescription("  my-org  ")).toContain("overrides configured default 'my-org'");
    expect(projectIdDescription("  my-project  ")).toContain("overrides configured default 'my-project'");
  });
});

describe("registered tool schemas reflect session defaults", () => {
  let client: HarnessClient;

  beforeEach(() => {
    client = makeClient();
  });

  it("harness_list warns when org/project defaults are unset", async () => {
    const registry = new Registry(makeConfig({ HARNESS_ORG: undefined, HARNESS_PROJECT: undefined }));
    const server = makeMcpServer();
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server as never, registry, client);

    const schema = server.schema("harness_list").inputSchema;
    expect(schema.org_id?.description).toContain("no configured default");
    expect(schema.project_id?.description).toContain("no configured default");
    expect(schema.resource_scope?.description).not.toContain("omit org/project defaults");
    expect(server.schema("harness_list").description).toContain("pass org_id and project_id on the first call");
  });

  it("harness_execute names the configured default when present", async () => {
    const registry = new Registry(makeConfig());
    const server = makeMcpServer();
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server as never, registry, client, makeConfig());

    const schema = server.schema("harness_execute").inputSchema;
    expect(schema.org_id?.description).toContain("overrides configured default 'default'");
    expect(schema.project_id?.description).toContain("overrides configured default 'test-project'");
  });

  it("harness_describe connector hint requires explicit scope when defaults are unset", async () => {
    const registry = new Registry(makeConfig({
      HARNESS_TOOLSETS: "connectors",
      HARNESS_ORG: undefined,
      HARNESS_PROJECT: undefined,
    }));
    const server = makeMcpServer();
    const { registerDescribeTool } = await import("../../src/tools/harness-describe.js");
    registerDescribeTool(server as never, registry);

    const result = await server.call("harness_describe", { resource_type: "connector" });
    const data = JSON.parse(result.content[0]!.text) as { scopeHint?: string; description?: string };
    expect(data.scopeHint).toContain("no configured org/project default");
    expect(data.description).toContain("Default list/get/execute scope is project");
  });

  const NO_DEFAULT_CONFIG = makeConfig({ HARNESS_ORG: undefined, HARNESS_PROJECT: undefined });

  const scopeAwareTools = [
    {
      name: "harness_get",
      register: async (server: ReturnType<typeof makeMcpServer>, registry: Registry, client: HarnessClient) => {
        const { registerGetTool } = await import("../../src/tools/harness-get.js");
        registerGetTool(server as never, registry, client);
      },
    },
    {
      name: "harness_create",
      register: async (server: ReturnType<typeof makeMcpServer>, registry: Registry, client: HarnessClient) => {
        const { registerCreateTool } = await import("../../src/tools/harness-create.js");
        registerCreateTool(server as never, registry, client, NO_DEFAULT_CONFIG);
      },
    },
    {
      name: "harness_update",
      register: async (server: ReturnType<typeof makeMcpServer>, registry: Registry, client: HarnessClient) => {
        const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
        registerUpdateTool(server as never, registry, client, NO_DEFAULT_CONFIG);
      },
    },
    {
      name: "harness_delete",
      register: async (server: ReturnType<typeof makeMcpServer>, registry: Registry, client: HarnessClient) => {
        const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
        registerDeleteTool(server as never, registry, client, NO_DEFAULT_CONFIG);
      },
    },
    {
      name: "harness_search",
      register: async (server: ReturnType<typeof makeMcpServer>, registry: Registry, client: HarnessClient) => {
        const { registerSearchTool } = await import("../../src/tools/harness-search.js");
        registerSearchTool(server as never, registry, client);
      },
    },
    {
      name: "harness_status",
      register: async (server: ReturnType<typeof makeMcpServer>, registry: Registry, client: HarnessClient) => {
        const { registerStatusTool } = await import("../../src/tools/harness-status.js");
        registerStatusTool(server as never, registry, client, NO_DEFAULT_CONFIG);
      },
    },
    {
      name: "harness_diagnose",
      register: async (server: ReturnType<typeof makeMcpServer>, registry: Registry, client: HarnessClient) => {
        const { registerDiagnoseTool } = await import("../../src/tools/harness-diagnose.js");
        registerDiagnoseTool(server as never, registry, client, NO_DEFAULT_CONFIG);
      },
    },
  ] as const;

  it.each(scopeAwareTools)("$name warns when org/project defaults are unset", async ({ name, register }) => {
    const registry = new Registry(NO_DEFAULT_CONFIG);
    const server = makeMcpServer();
    await register(server, registry, client);

    const schema = server.schema(name).inputSchema;
    expect(schema.org_id?.description).toContain("no configured default");
    expect(schema.project_id?.description).toContain("no configured default");
  });
});
