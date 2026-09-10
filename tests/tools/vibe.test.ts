import { describe, it, expect, vi, afterEach } from "vitest";
import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../../src/config.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { registerCreateTool } from "../../src/tools/harness-create.js";
import { registerExecuteTool } from "../../src/tools/harness-execute.js";
import { registerGetTool } from "../../src/tools/harness-get.js";
import { registerDescribeTool } from "../../src/tools/harness-describe.js";

const appId = "08aff27b-6108-4589-bc39-eb32f94c8d5e";
function setup(overrides: Partial<Config> = {}) {
  const config = {
    HARNESS_MCP_MODE: "single-user", HARNESS_API_KEY: "pat.account.id.secret", HARNESS_ACCOUNT_ID: "account",
    HARNESS_BASE_URL: "https://app.harness.io", HARNESS_ORG: "ambient-org", HARNESS_PROJECT: "ambient-project",
    HARNESS_API_TIMEOUT_MS: 5000, HARNESS_MAX_RETRIES: 0, HARNESS_RATE_LIMIT_RPS: 1000,
    HARNESS_TOOLSETS: "vibe", HARNESS_READ_ONLY: false, HARNESS_AUTO_APPROVE_RISK: "all", LOG_LEVEL: "error", ...overrides,
  } as Config;
  type Handler = (args: Record<string, unknown>, extra: { signal: AbortSignal; sendNotification: () => Promise<void>; _meta: object }) => Promise<ToolResult>;
  const registrations = new Map<string, { schema: { inputSchema: z.ZodRawShape }; handler: Handler }>();
  const stub = { server: { getClientCapabilities: () => ({}) }, registerTool: (name: string, schema: { inputSchema: z.ZodRawShape }, handler: Handler) => { registrations.set(name, { schema, handler }); } };
  const server = stub as unknown as McpServer;
  const registry = new Registry(config);
  const client = new HarnessClient(config);
  registerCreateTool(server, registry, client, config);
  registerExecuteTool(server, registry, client, config);
  registerGetTool(server, registry, client);
  registerDescribeTool(server, registry);
  return {
    async call(name: string, args: Record<string, unknown>, signal = new AbortController().signal) {
      const tool = registrations.get(name)!;
      const parsed = z.object(tool.schema.inputSchema).parse(args);
      return tool.handler(parsed, { signal, sendNotification: async () => {}, _meta: {} });
    },
  };
}
function json(value: unknown) { return new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } }); }
function data(result: ToolResult): Record<string, unknown> {
  const content = result.content[0]!;
  if (content.type !== "text") throw new Error("Expected text content");
  return JSON.parse(content.text);
}
afterEach(() => { vi.restoreAllMocks(); });

describe("Vibe generic MCP tool workflow", () => {
  it("imports a project without automatically deploying", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ id: appId, name: "demo", source_type: "github", source_path: "repo", created_at: "now" }));
    const tools = setup();
    const result = await tools.call("harness_create", { resource_type: "vibe_project", body: { mode: "custom-mode", customConfig: { repository: "demo" } } });
    expect(result.isError).toBeUndefined();
    expect(data(result).id).toBe(appId);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]![0]).endsWith("/projects/import")).toBe(true);
  });

  it("prepares an upload, then deploys the returned projectId and reads lifecycle by resource_id", async () => {
    const prepared = { projectId: appId, sourceId: "source", upload: { uploadId: "upload", expiresAt: "later", files: [{ path: "app.zip", objectPath: "source/app.zip", uploadUrl: "https://storage.example/app.zip?sig=abc%2B123", method: "PUT", headers: { "Content-Type": "application/zip" }, expiresAt: "later" }] } };
    const progress = { app: { id: appId, name: "demo", status: "building", approvalStatus: "pending" }, execution: { id: "exec", appId, type: "import_and_preview", status: "running", startedAt: "now", triggeredBy: "user", stages: [] }, overallPercent: 0, phase: "setting_up" };
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(prepared))
      .mockResolvedValueOnce(json({ id: "exec", project_id: appId, status: "pending", created_at: "now" }))
      .mockResolvedValueOnce(json(progress));
    const tools = setup();
    const prepare = await tools.call("harness_execute", { resource_type: "vibe_project", action: "prepare", body: { name: "demo", file: { path: "app.zip" } } });
    expect(data(prepare)).toEqual(prepared);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const deploy = await tools.call("harness_execute", { resource_type: "vibe_project", action: "deploy", resource_id: data(prepare).projectId, project_id: "harness-scope" });
    expect(deploy.isError).toBeUndefined();
    expect(JSON.parse(fetchSpy.mock.calls[1]![1]!.body as string)).toEqual({ project_id: appId });
    const lifecycle = await tools.call("harness_get", { resource_type: "vibe_app_lifecycle", resource_id: appId });
    expect(data(lifecycle)).toEqual(progress);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(String(fetchSpy.mock.calls[2]![0]).endsWith(`/apps/${appId}/lifecycle`)).toBe(true);
  });

  it("accepts deployment params.app_id and rejects disagreement with body.project_id", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ id: "exec", project_id: appId, status: "pending", created_at: "now" }));
    const tools = setup();
    expect((await tools.call("harness_execute", { resource_type: "vibe_project", action: "deploy", params: { app_id: appId } })).isError).toBeUndefined();
    const conflicting = await tools.call("harness_execute", { resource_type: "vibe_project", action: "deploy", resource_id: appId, body: { project_id: "different-app" } });
    expect(conflicting.isError).toBe(true);
    expect(data(conflicting).error).toContain("conflicts");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation for deployment and respects read-only mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const tools = setup({ HARNESS_AUTO_APPROVE_RISK: "none" });
    const blocked = await tools.call("harness_execute", { resource_type: "vibe_project", action: "deploy", resource_id: appId });
    expect(blocked.isError).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    const readOnly = setup({ HARNESS_READ_ONLY: true });
    for (const action of ["prepare", "deploy"]) {
      expect((await readOnly.call("harness_execute", { resource_type: "vibe_project", action, resource_id: appId, confirm: true })).isError).toBe(true);
    }
    expect((await readOnly.call("harness_create", { resource_type: "vibe_project", body: { mode: "github_link" }, confirm: true })).isError).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([{ resource_id: appId }, { params: { app_id: appId } }])("returns lifecycle event batches in read-only mode through either identifier form", async identifier => {
    const event = { type: "preview_ready", payload: { previewUrl: "https://preview.example" }, at: "now" };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`data: ${JSON.stringify(event)}\n\n`, { headers: { "Content-Type": "text/event-stream" } }));
    const tools = setup({ HARNESS_READ_ONLY: true, HARNESS_AUTO_APPROVE_RISK: "none" });
    const result = await tools.call("harness_execute", { resource_type: "vibe_app_lifecycle", action: "events", ...identifier });
    expect(data(result)).toEqual({ events: [event], stop_reason: "end" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("describes upload schemas, deployment identity, related resources, and stream limits", async () => {
    const tools = setup();
    const project = data(await tools.call("harness_describe", { resource_type: "vibe_project" }));
    expect(project.identifierFields).toEqual(["app_id"]);
    expect(project.operations).toEqual([expect.objectContaining({ operation: "create", bodySchema: expect.objectContaining({ fields: [expect.objectContaining({ name: "mode", required: true })] }) })]);
    expect(project.executeActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "prepare", bodySchema: expect.objectContaining({ fields: expect.arrayContaining([expect.objectContaining({ name: "file", fields: expect.arrayContaining([expect.objectContaining({ name: "path", required: true })]) })]) }) }),
      expect.objectContaining({ action: "deploy", bodySchema: expect.objectContaining({ fields: [expect.objectContaining({ name: "project_id" })] }) }),
    ]));
    const lifecycle = data(await tools.call("harness_describe", { resource_type: "vibe_app_lifecycle" }));
    expect(lifecycle.executeActions).toEqual([expect.objectContaining({ action: "events", description: expect.stringContaining("5 seconds"), paramsSchema: { fields: [{ name: "app_id", required: true, description: expect.stringContaining("resource_id or params.app_id") }] } })]);
  });
});
