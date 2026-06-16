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
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
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
    const action = opts.elicitAction ?? "accept";
    elicitInput.mockResolvedValue(action === "accept" ? { action, content: { confirm: true } } : { action });
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

  it("does not call elicitInput for low_write create even when client supports it", async () => {
    // pipeline.create is low_write — confirmation is gated on
    // requiresConfirmation(risk), which kicks in at medium_write.
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "accept" });
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);

    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Test" },
    });

    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).not.toHaveBeenCalled();
  });

  it("proceeds when elicitInput throws (low-risk create silently bypasses)", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitThrows: true });
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);

    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Test" },
    });

    // low_write short-circuits before elicitInput is even called.
    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).not.toHaveBeenCalled();
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

  it("blocks high_write action when client does not support elicitation", async () => {
    const server = makeMcpServer({ supportsElicitation: false });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
    });

    // pipeline.run is high_write → blocked without elicitation
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
    expect(server._elicitInput).not.toHaveBeenCalled();
  });

  it("confirms and proceeds on accept for high_write action", async () => {
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

  it("proceeds without elicitation for low_write action on non-elicitation client", async () => {
    const server = makeMcpServer({ supportsElicitation: false });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);

    // pipeline import is low_write — should proceed without elicitation
    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "import",
      resource_id: "my-pipe",
      body: { pipelineName: "Test", pipelineDescription: "" },
    });

    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).not.toHaveBeenCalled();
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

  it("does not call elicitInput for low_write update even when client supports it", async () => {
    // pipeline.update is low_write — no prompt is surfaced. The decline below
    // would only matter for medium_write+ updates.
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "decline" });
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(server, registry, client);

    const result = await server.call("harness_update", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      body: { yamlPipeline: "pipeline:\n  name: Updated" },
    });

    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).not.toHaveBeenCalled();
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

describe("Elicitation flow: confirm: true override (end-to-end through tool entry points)", () => {
  let registry: Registry;
  let client: HarnessClient;

  beforeEach(() => {
    registry = new Registry(makeConfig());
    client = makeClient();
    (client.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { planExecutionId: "exec-123", identifier: "test" },
    });
  });

  it("harness_delete proceeds with confirm:true when client lacks elicitation", async () => {
    const server = makeMcpServer({ supportsElicitation: false });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).not.toHaveBeenCalled();
  });

  it("harness_delete proceeds with confirm:true when elicitInput throws", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitThrows: true });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
  });

  it("harness_execute proceeds with confirm:true when client lacks elicitation (high_write)", async () => {
    const server = makeMcpServer({ supportsElicitation: false });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).not.toHaveBeenCalled();
  });

  it("harness_delete proceeds with confirm:true on accept missing confirm flag", async () => {
    // Non-interactive client that advertises elicitation but returns a
    // degenerate accept (no confirm field). callerConfirmed is the opt-in.
    // Using a destructive resource so the elicitation prompt is actually
    // surfaced (low_write resources short-circuit before elicitInput runs).
    const server = makeMcpServer({ supportsElicitation: true });
    server._elicitInput.mockResolvedValue({ action: "accept", content: {} });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    expect(server._elicitInput).toHaveBeenCalledOnce();
  });

  it("harness_delete still blocks on explicit decline EVEN with confirm:true (authoritative human decline)", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "decline" });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      confirm: true,
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
    // The error must explicitly tell the caller that confirm:true does NOT
    // bypass an explicit decline — otherwise an LLM will retry forever.
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("does not bypass an explicit decline") });
  });

  it("harness_execute still blocks on explicit cancel EVEN with confirm:true", async () => {
    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "cancel" });
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
      confirm: true,
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("cancelled") });
  });

  it("error hint when client lacks elicitation tells caller to retry with confirm:true", async () => {
    const server = makeMcpServer({ supportsElicitation: false });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      // no confirm — caller should learn from the hint
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("retry with confirm: true") });
  });

  it("error hint on accept-without-confirm tells caller to retry with confirm:true (recoverable)", async () => {
    // Regression: a degenerate accept (no confirm field) is the classic
    // non-interactive-automation shape. The error message must NOT tell the
    // caller "confirm: true does not bypass an explicit decline" — there
    // was no explicit decline. Routing this through method:"blocked" gives
    // them the recovery hint matching the documented contract.
    const server = makeMcpServer({ supportsElicitation: true });
    server._elicitInput.mockResolvedValue({ action: "accept", content: {} });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      // no confirm — should be told it's recoverable
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("retry with confirm: true") });
    // Must NOT carry the explicit-decline copy.
    expect(parseResult(result)).not.toMatchObject({ error: expect.stringContaining("does not bypass an explicit decline") });
  });

  it("blocked operations emit a pre-dispatch audit event with confirmation=blocked", async () => {
    // End-to-end coverage that the tool handlers actually call
    // registry.auditBlockedAttempt — the user reviewer surfaced this as a
    // promised-but-unwired contract.
    const { AuditManager } = await import("../../src/audit/manager.js");
    const events: import("../../src/audit/types.js").AuditEvent[] = [];
    const manager = new AuditManager();
    manager.addSink({
      name: "test",
      emit(e) { events.push(e); },
    });
    const auditedRegistry = new Registry(makeConfig(), { auditManager: manager });

    const server = makeMcpServer({ supportsElicitation: true, elicitAction: "decline" });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, auditedRegistry, client);

    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
    });

    expect(result.isError).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]!.tool).toBe("harness_delete");
    expect(events[0]!.operation).toBe("delete");
    expect(events[0]!.resource_type).toBe("pipeline");
    expect(events[0]!.resource_id).toBe("my-pipe");
    expect(events[0]!.confirmation).toBe("blocked");
    expect(events[0]!.outcome).toBe("error");
    expect(events[0]!.error).toContain("declined");
  });
});
