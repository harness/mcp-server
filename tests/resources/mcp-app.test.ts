import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it, expect, vi } from "vitest";
import type { Config } from "../../src/config.js";
import { loadAppHtml, registerMcpAppResource } from "../../src/resources/mcp-app.js";
import { buildResultView, clientSupportsMcpApps, viewStatus } from "../../src/apps/mcp-apps.js";

function capture(config: Partial<Config>) {
  const registerResource = vi.fn();
  registerMcpAppResource({ registerResource } as never, config as Config);
  return registerResource;
}

describe("ui://harness/app resource", () => {
  it("registers the MCP Apps HTML resource with a deny-by-default CSP", async () => {
    const registerResource = capture({ HARNESS_MCP_APPS: "auto" });
    expect(registerResource).toHaveBeenCalledOnce();
    const [name, uri, metadata, read] = registerResource.mock.calls[0]!;
    expect(name).toBe("harness-app");
    expect(uri).toBe("ui://harness/app");
    expect(metadata).toMatchObject({ mimeType: "text/html;profile=mcp-app", _meta: { ui: { csp: {} } } });

    const result = await read(new URL("ui://harness/app"));
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]).toMatchObject({
      uri: "ui://harness/app",
      mimeType: "text/html;profile=mcp-app",
      _meta: { ui: { csp: {} } },
    });
    expect(result.contents[0].text).toMatch(/^<!DOCTYPE html>/);
  });

  it("is not registered when HARNESS_MCP_APPS=off", () => {
    expect(capture({ HARNESS_MCP_APPS: "off" })).not.toHaveBeenCalled();
  });

  it("serves the built bundle when present and an empty document when it is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "harness-app-"));
    const built = join(dir, "harness-app.html");
    writeFileSync(built, "<!DOCTYPE html><html><body>built</body></html>");
    expect(loadAppHtml(pathToFileURL(built))).toContain("built");
    expect(loadAppHtml(pathToFileURL(join(dir, "missing.html")))).toMatch(/^<!DOCTYPE html>.*<body>/);
  });
});

describe("clientSupportsMcpApps", () => {
  it("requires the io.modelcontextprotocol/ui extension with the MCP App HTML MIME type", () => {
    const ui = (mimeTypes: unknown) => ({ extensions: { "io.modelcontextprotocol/ui": { mimeTypes } } });
    expect(clientSupportsMcpApps(ui(["text/html;profile=mcp-app"]))).toBe(true);
    expect(clientSupportsMcpApps(ui(["text/html"]))).toBe(false);
    expect(clientSupportsMcpApps({ extensions: { "io.modelcontextprotocol/ui": {} } })).toBe(false);
    expect(clientSupportsMcpApps({ elicitation: {} })).toBe(false);
    expect(clientSupportsMcpApps(undefined)).toBe(false);
  });
});

describe("viewStatus", () => {
  it.each([
    ["Running", "Running", "info", true],
    ["ApprovalWaiting", "Waiting for approval", "warning", true],
    ["Queued", "Queued", "neutral", true],
    ["Success", "Succeeded", "success", undefined],
    ["Failed", "Failed", "danger", undefined],
    ["Errored", "Errored", "danger", undefined],
    ["AbortedByFreeze", "Blocked by freeze", "neutral", undefined],
    ["SomethingNew", "Something New", "neutral", undefined],
  ])("%s → %s (%s)", (status, label, tone, live) => {
    expect(viewStatus(status)).toEqual({ label, tone, ...(live ? { live } : {}) });
  });

  it("returns undefined without a status", () => {
    expect(viewStatus(undefined)).toBeUndefined();
  });
});

describe("buildResultView", () => {
  it("uses name, identifier, status, and the deep link", () => {
    const view = buildResultView(
      { name: "Build App", identifier: "build_app", status: "Failed", openInHarness: "https://app.harness.io/x" },
      { displayName: "Pipeline", action: "run" },
    );
    expect(view).toEqual({
      kind: "result",
      title: "Build App",
      subtitle: "Pipeline · run · build_app",
      status: { label: "Failed", tone: "danger" },
      open_in_harness: "https://app.harness.io/x",
    });
  });

  it("reads the name from a YAML-only pipeline get response", () => {
    const view = buildResultView(
      {
        yamlPipeline: "pipeline:\n  name: AI Platform On-Call Slack\n  identifier: ai_platform_oncall_slack\n  stages: []\n",
        storeType: "INLINE",
        openInHarness: "https://app.harness.io/p",
      },
      { displayName: "Pipeline", resourceId: "ai_platform_oncall_slack" },
    );
    expect(view).toMatchObject({ title: "AI Platform On-Call Slack", subtitle: "Pipeline · ai_platform_oncall_slack" });
  });

  it("reads the name from a nested entity and falls back to the requested id", () => {
    expect(buildResultView({ service: { name: "Payments", identifier: "payments" }, openInHarness: "https://app.harness.io/s" }, { displayName: "Service" })?.title).toBe("Payments");
    expect(buildResultView({ openInHarness: "https://app.harness.io/x", yamlPipeline: "not: [valid" }, { displayName: "Pipeline", resourceId: "build_app" })?.title).toBe("build_app");
  });

  it("returns undefined when the result has nothing to show", () => {
    expect(buildResultView({ items: [] }, { displayName: "Pipeline" })).toBeUndefined();
    expect(buildResultView({ id: "ci:pipeline_execution_summary_ci", name: "CI Pipeline Executions" }, { displayName: "KG Type" })).toBeUndefined();
    expect(buildResultView("text", { displayName: "Pipeline" })).toBeUndefined();
  });
});
