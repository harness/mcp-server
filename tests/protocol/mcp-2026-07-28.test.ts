import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  InMemoryTransport,
  PROTOCOL_VERSION_META_KEY,
  createMcpHandler,
} from "@modelcontextprotocol/server";
import { createHarnessServer } from "../../src/index.js";
import { makeConfig } from "../tools/diagnose/helpers.js";

const VERSION = "2026-07-28";
const KEY = "conformance-request-state-key-32b";

function envelope() {
  return {
    [PROTOCOL_VERSION_META_KEY]: VERSION,
    [CLIENT_INFO_META_KEY]: { name: "conformance", version: "1.0.0" },
    [CLIENT_CAPABILITIES_META_KEY]: { elicitation: { form: {} } },
  };
}

function rpc(id: number, method: string, params: Record<string, unknown> = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params: { ...params, _meta: envelope() },
  };
}

function protocolHeaders(method: string, name?: string): Record<string, string> {
  return {
    "MCP-Protocol-Version": VERSION,
    "Mcp-Method": method,
    ...(name ? { "Mcp-Name": name } : {}),
  };
}

function handler() {
  const config = makeConfig({
    HARNESS_TOOLSETS: "pipelines",
    HARNESS_MCP_REQUEST_STATE_KEY: KEY,
  });
  return createMcpHandler(() => createHarnessServer(config).server, { legacy: "reject" });
}

async function post(
  mcp: ReturnType<typeof handler>,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await mcp.fetch(new Request("http://127.0.0.1/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  }));
  const text = await response.text();
  const jsonText = text.startsWith("data:")
    ? text.split("\n").filter((line) => line.startsWith("data:")).at(-1)?.slice(5).trim() ?? "{}"
    : text;
  return { status: response.status, body: JSON.parse(jsonText) as Record<string, unknown> };
}

describe("MCP 2026-07-28 conformance", () => {
  it("serves server/discover and tools/call for harness_list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: "SUCCESS",
      data: { content: [{ identifier: "pipe-1", name: "Pipe" }] },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const mcp = handler();

    const discovered = await post(mcp, rpc(1, "server/discover"), protocolHeaders("server/discover"));
    expect(discovered.status).toBe(200);
    expect(discovered.body).toMatchObject({ result: expect.objectContaining({ resultType: "complete" }) });

    const listed = await post(mcp, rpc(2, "tools/call", {
      name: "harness_list",
      arguments: { resource_type: "pipeline" },
    }), protocolHeaders("tools/call", "harness_list"));
    expect(listed.status).toBe(200);
    const result = listed.body.result as { resultType?: string; isError?: boolean };
    expect(result.resultType).toBe("complete");
    expect(result.isError).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("round-trips harness_delete confirmation for accept, decline, confirm false, and caller_confirmed", async () => {
    const calls: Array<{ method?: string; url?: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method, url });
      return new Response(JSON.stringify({ status: "SUCCESS", data: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
    const mcp = handler();
    const deleteArgs = { resource_type: "pipeline", resource_id: "my-pipe" };

    const first = await post(mcp, rpc(1, "tools/call", {
      name: "harness_delete",
      arguments: deleteArgs,
    }), protocolHeaders("tools/call", "harness_delete"));
    const prompt = first.body.result as { resultType?: string; requestState?: string; inputRequests?: { confirm?: { params?: { message?: string } } } };
    expect(prompt.resultType).toBe("input_required");
    expect(prompt.inputRequests?.confirm?.params?.message).toContain("my-pipe");
    const state = prompt.requestState;
    expect(typeof state).toBe("string");

    const accept = await post(mcp, rpc(2, "tools/call", {
      name: "harness_delete",
      arguments: deleteArgs,
      inputResponses: { confirm: { action: "accept", content: { confirm: true } } },
      requestState: state,
    }), protocolHeaders("tools/call", "harness_delete"));
    expect((accept.body.result as { isError?: boolean }).isError).toBeUndefined();
    expect(calls.some((call) => call.method === "DELETE")).toBe(true);

    const decline = await post(mcp, rpc(3, "tools/call", {
      name: "harness_delete",
      arguments: deleteArgs,
      inputResponses: { confirm: { action: "decline" } },
      requestState: state,
    }), protocolHeaders("tools/call", "harness_delete"));
    expect(JSON.stringify(decline.body.result)).toContain("declined");

    const rejected = await post(mcp, rpc(4, "tools/call", {
      name: "harness_delete",
      arguments: deleteArgs,
      inputResponses: { confirm: { action: "accept", content: { confirm: false } } },
      requestState: state,
    }), protocolHeaders("tools/call", "harness_delete"));
    expect(JSON.stringify(rejected.body.result)).toContain("declined");

    const confirmedPrompt = await post(mcp, rpc(5, "tools/call", {
      name: "harness_delete",
      arguments: { ...deleteArgs, confirm: true },
    }), protocolHeaders("tools/call", "harness_delete"));
    const confirmedState = (confirmedPrompt.body.result as { requestState?: string }).requestState;
    const confirmed = await post(mcp, rpc(6, "tools/call", {
      name: "harness_delete",
      arguments: { ...deleteArgs, confirm: true },
      inputResponses: { confirm: { action: "accept", content: {} } },
      requestState: confirmedState,
    }), protocolHeaders("tools/call", "harness_delete"));
    expect((confirmed.body.result as { isError?: boolean }).isError).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("rejects a tampered requestState and a retry whose arguments changed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    const mcp = handler();
    const first = await post(mcp, rpc(1, "tools/call", {
      name: "harness_delete",
      arguments: { resource_type: "pipeline", resource_id: "my-pipe" },
    }), protocolHeaders("tools/call", "harness_delete"));
    const state = (first.body.result as { requestState?: string }).requestState;

    const tampered = await post(mcp, rpc(2, "tools/call", {
      name: "harness_delete",
      arguments: { resource_type: "pipeline", resource_id: "my-pipe" },
      inputResponses: { confirm: { action: "accept", content: { confirm: true } } },
      requestState: `${state}tampered`,
    }), protocolHeaders("tools/call", "harness_delete"));
    expect(tampered.body.error).toMatchObject({ code: -32602 });

    const changed = await post(mcp, rpc(3, "tools/call", {
      name: "harness_delete",
      arguments: { resource_type: "pipeline", resource_id: "other-pipe" },
      inputResponses: { confirm: { action: "accept", content: { confirm: true } } },
      requestState: state,
    }), protocolHeaders("tools/call", "harness_delete"));
    const changedText = JSON.stringify(changed.body);
    expect(changedText.includes("Operation blocked") || (changed.body.error as { code?: number } | undefined)?.code === -32602).toBe(true);
    vi.unstubAllGlobals();
  });

  it("returns -32020 when protocol headers disagree with the body", async () => {
    const mcp = handler();
    const response = await post(mcp, rpc(1, "server/discover"), {
      ...protocolHeaders("tools/list"),
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: -32020 });
  });

  it("delivers a 2025 elicitation prompt through the legacy shim", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    const config = makeConfig({
      HARNESS_TOOLSETS: "pipelines",
      HARNESS_MCP_REQUEST_STATE_KEY: KEY,
    });
    const { server } = createHarnessServer(config);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client(
      { name: "legacy", version: "1.0.0" },
      { capabilities: { elicitation: { form: {} } } },
    );
    client.setRequestHandler("elicitation/create", async () => ({
      action: "accept",
      content: { confirm: true },
    }));
    await client.connect(clientTransport);
    const result = await client.callTool({
      name: "harness_delete",
      arguments: { resource_type: "pipeline", resource_id: "my-pipe" },
    });
    expect(result.isError).toBeUndefined();
    await client.close();
    await server.close();
    vi.unstubAllGlobals();
  });

  it("returns -32022 for an unsupported protocol version", async () => {
    const mcp = handler();
    const body = rpc(1, "server/discover");
    (body.params._meta as Record<string, unknown>)[PROTOCOL_VERSION_META_KEY] = "1900-01-01";
    const response = await post(mcp, body, {
      "MCP-Protocol-Version": "1900-01-01",
      "Mcp-Method": "server/discover",
    });
    expect(response.body.error).toMatchObject({ code: -32022 });
  });
});
