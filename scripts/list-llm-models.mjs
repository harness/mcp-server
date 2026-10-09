#!/usr/bin/env node
// Lists LLM models via the local MCP server (HTTP, port 3000), no API key.
// Connector is derived from the Harness URL below.
const URL_ = process.argv[2] ??
  "https://qa.harness.io/ng/account/89XwrN2UQO29dCMQGjOMEQ/all/orgs/default/projects/testhm/settings/connectors/rajanthropictest";
const MCP = process.env.MCP_URL ?? "http://localhost:3000/mcp";

const m = URL_.match(/\/account\/([^/]+)\/.*?(?:orgs\/([^/]+))?(?:\/projects\/([^/]+))?\/settings\/connectors\/([^/?#]+)/);
const [, account, org, project, connector] = m;
const scope = { org_id: org, project_id: project };

const base = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  "x-harness-account-id": account,
};
let sid;
let id = 0;

async function rpc(method, params, notify = false) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: { ...base, ...(sid ? { "mcp-session-id": sid } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", ...(notify ? {} : { id: ++id }), method, params }),
  });
  sid ??= res.headers.get("mcp-session-id") ?? undefined;
  const text = await res.text();
  if (notify) return;
  const data = text.startsWith("event:") || text.includes("\ndata:") || text.startsWith("data:")
    ? text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).pop()
    : text;
  const j = JSON.parse(data);
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

const call = async (name, args) => {
  const r = await rpc("tools/call", { name, arguments: args });
  const t = r.content?.[0]?.text ?? "";
  try { return JSON.parse(t); } catch { return t; }
};

await rpc("initialize", {
  protocolVersion: "2025-03-26", capabilities: {},
  clientInfo: { name: "list-llm-models", version: "1.0" },
});
await rpc("notifications/initialized", {}, true);

// 1. Fetch connector to derive provider + authentication
const conn = await call("harness_get", { resource_type: "connector", resource_id: connector, ...scope });
const c = conn?.connector ?? conn?.data?.connector ?? conn?.data ?? conn;
console.error("connector:", JSON.stringify(c, null, 2));
const spec = c?.spec ?? {};
const type = String(c?.type ?? "").toUpperCase();
const provider = process.env.PROVIDER ?? (type.includes("ANTHROPIC") || spec.provider === "ANTHROPIC" ? "ANTHROPIC" : spec.provider ?? "ANTHROPIC");
const authentication = spec.authentication ?? spec.auth ?? (spec.tokenRef ? { type: "Token", spec: { tokenRef: spec.tokenRef } } : undefined);

// 2. List models
const models = await call("harness_list", {
  resource_type: "llm_model", filters: { provider, authentication, url: spec.url, region: process.env.REGION ?? "us-east5" }, ...scope,
});
console.log(JSON.stringify(models, null, 2));
