/**
 * Elicitation flow tests.
 *
 * Tests the end-to-end elicitation behavior across write tools:
 * - Create, Update, Delete, Execute all require user confirmation
 * - Destructive ops (delete) block when elicitation unavailable
 * - Non-destructive ops (create/update) proceed silently when unavailable
 * - User declining/cancelling stops the operation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_DEFAULT_ORG_ID: "default",
    HARNESS_DEFAULT_PROJECT_ID: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
  };
}

function makeClient(): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue({ data: { identifier: "test" } }),
    account: "test-account",
  } as unknown as HarnessClient;
}

type ElicitAction = "accept" | "decline" | "cancel";

/**
 * Create a minimal McpServer stub with configurable elicitation behavior.
 */
function makeMcpServer(opts: {
  supportsElicitation: boolean;
  elicitAction?: ElicitAction;
  elicitThrows?: boolean;
}) {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  const elicitInput = vi.fn();

  if (opts.elicitThrows) {
    elicitInput.mockRejectedValue(new Error("Elicitation not supported"));
  } else {
    elicitInput.mockResolvedValue({ action: opts.elicitAction ?? "accept" });
  }

  return {
    server: {
      getClientCapabilities: () =>
        opts.supportsElicitation ? { elicitation: { form: {} } } : {},
      elicitInput,
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    _tools: tools,
    _elicitInput: elicitInput,
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const extra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, extra) as Promise<ToolResult>;
    },
  } as any;
}

function parseResult(result: ToolResult): unknown {
  return JSON.parse(result.content[0]!.text);
}

describe("Elicitation flow: harness_create", () => {
  let registry: Registry;
  let client: HarnessClient;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" } as any));
    client = makeClient();
  });

  it("proceeds without elicitation when client does not support it (non-destructive)", async () => {
    const server = makeMcpServer({ supportsElicitation: false });
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);

    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Test" },
    });

    // Should proceed — create is non-destructive, elicitation unavailable → proceed
    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).not.toHaveBeenCalled();
  });

  it("calls elicitInput when supported and proceeds on accept", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "accept" });
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);

    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Test" },
    });

    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).toHaveBeenCalledOnce();
  });

  it("stops on decline", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "decline" });
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);

    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Test" },
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
  });

  it("stops on cancel", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "cancel" });
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);

    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Test" },
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("cancelled") });
  });

  it("proceeds when elicitInput throws (non-destructive)", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitThrows: true });
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);

    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Test" },
    });

    // Non-destructive → proceeds even when elicitation fails
    expect(result.isError).toBeUndefined();
  });
});

describe("Elicitation flow: harness_delete (destructive)", () => {
  let registry: Registry;
  let client: HarnessClient;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" } as any));
    client = makeClient();
  });

  it("blocks when client does not support elicitation", async () => {
    const server = makeMcpServer({ supportsElicitation: false });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
    });

    // Destructive + no elicitation → blocked
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
  });

  it("blocks when elicitInput throws (destructive)", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitThrows: true });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
    });

    // Destructive + elicitation throws → blocked
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("cancelled") });
  });

  it("proceeds when user accepts", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "accept" });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { deleted: boolean };
    expect(data.deleted).toBe(true);
  });

  it("stops when user declines", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "decline" });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
  });
});

describe("Elicitation flow: harness_execute", () => {
  let registry: Registry;
  let client: HarnessClient;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" } as any));
    client = makeClient();
    (client.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { planExecutionId: "exec-123" },
    });
  });

  it("proceeds without elicitation when client does not support it", async () => {
    const server = makeMcpServer({ supportsElicitation: false });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
    });

    // Execute is non-destructive → proceeds without elicitation
    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).not.toHaveBeenCalled();
  });

  it("confirms and proceeds on accept", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "accept" });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
    });

    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).toHaveBeenCalledOnce();
  });

  it("stops on decline", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "decline" });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
  });
});

describe("Elicitation flow: harness_update", () => {
  let registry: Registry;
  let client: HarnessClient;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" } as any));
    client = makeClient();
  });

  it("proceeds without elicitation (non-destructive)", async () => {
    const server = makeMcpServer({ supportsElicitation: false });
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(server, registry, client);

    const result = await server.call("harness_update", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      body: { yamlPipeline: "pipeline:\n  name: Updated" },
    });

    // Non-destructive → proceeds
    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).not.toHaveBeenCalled();
  });

  it("stops on decline when elicitation available", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "decline" });
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(server, registry, client);

    const result = await server.call("harness_update", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      body: { yamlPipeline: "pipeline:\n  name: Updated" },
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
  });
});

describe("Elicitation ordering: validate before elicit", () => {
  let registry: Registry;
  let client: HarnessClient;

  beforeEach(() => {
    registry = new Registry(makeConfig());
    client = makeClient();
  });

  it("harness_create validates resource_type before asking user to confirm", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "accept" });
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);

    // execution has no create operation — should error without eliciting
    const result = await server.call("harness_create", {
      resource_type: "execution",
      body: {},
    });

    expect(result.isError).toBe(true);
    // Should NOT have called elicitInput — validation failed first
    expect(server._elicitInput).not.toHaveBeenCalled();
  });

  it("harness_delete validates resource_type before asking user to confirm", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "accept" });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "execution",
      resource_id: "exec-1",
    });

    expect(result.isError).toBe(true);
    expect(server._elicitInput).not.toHaveBeenCalled();
  });

  it("harness_execute validates action before asking user to confirm", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "accept" });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "nonexistent_action",
    });

    expect(result.isError).toBe(true);
    expect(server._elicitInput).not.toHaveBeenCalled();
  });
});
