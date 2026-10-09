#!/usr/bin/env node
// Mimics POST /ng/api/llm-connector/models via harness_list(llm_model) on local MCP (port 3000).
const MCP = process.env.MCP_URL ?? "http://localhost:3000/mcp";
const base = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  "x-harness-account-id": "px7xd_BFRCi-pfWPYXVjvw",
};
let sid, id = 0;
async function rpc(method, params, notify = false) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: { ...base, ...(sid ? { "mcp-session-id": sid } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", ...(notify ? {} : { id: ++id }), method, params }),
  });
  sid ??= res.headers.get("mcp-session-id") ?? undefined;
  const text = await res.text();
  if (notify) return;
  const line = text.split("\n").filter((l) => l.startsWith("data:")).pop();
  const j = JSON.parse(line ? line.slice(5) : text);
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}
await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "llm-models", version: "1" } });
await rpc("notifications/initialized", {}, true);
const r = await rpc("tools/call", {
  name: "harness_list",
  arguments: {
    resource_type: "llm_model",
    org_id: "default",
    project_id: "Yogesh_Without_GitSync",
    filters: {
      provider: "OPENAI",
      authentication: { type: "Token", spec: { tokenRef: "yogeshopenai" } },
      url: "https://api.openai.com/v1",
    },
  },
});
console.log(r.content?.[0]?.text);
