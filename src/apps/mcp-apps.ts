/**
 * MCP Apps (SEP-1865, extension io.modelcontextprotocol/ui) support.
 *
 * Tools that can render a view declare `_meta.ui.resourceUri`. Hosts without the
 * extension ignore it. View data is added to a result's `_meta` only when the
 * connected host declared the extension, so text-only clients get byte-identical
 * results.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parse as parseYaml } from "yaml";
import type { Config } from "../config.js";
import type { ToolResult } from "../utils/response-formatter.js";
import { asRecord, asString } from "../utils/type-guards.js";
import type { HarnessView, ResultView, ViewRefresh, ViewStatus } from "./view-types.js";

export const MCP_APPS_EXTENSION_ID = "io.modelcontextprotocol/ui";
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
export const MCP_APP_RESOURCE_URI = "ui://harness/app";
export const VIEW_META_KEY = "harness.io/view";

export function mcpAppsEnabled(config: Config): boolean {
  return config.HARNESS_MCP_APPS !== "off";
}

/** True when the client declared io.modelcontextprotocol/ui with the HTML MIME type. */
export function clientSupportsMcpApps(capabilities: unknown): boolean {
  const extensions = asRecord(asRecord(capabilities)?.extensions);
  const ui = asRecord(extensions?.[MCP_APPS_EXTENSION_ID]);
  const mimeTypes = ui?.mimeTypes;
  return Array.isArray(mimeTypes) && mimeTypes.includes(MCP_APP_MIME_TYPE);
}

export interface AppViewContext {
  /** Spread into a tool's registration config. Empty when MCP Apps is off. */
  readonly toolMeta: { _meta?: Record<string, unknown> };
  /** Add view data to a successful result when the connected host renders MCP Apps. */
  attach(result: ToolResult, build: () => HarnessView | undefined): ToolResult;
}

export function createAppViewContext(server: McpServer, enabled: boolean): AppViewContext {
  return {
    toolMeta: enabled ? { _meta: { ui: { resourceUri: MCP_APP_RESOURCE_URI } } } : {},
    attach(result, build) {
      if (!enabled || result.isError) return result;
      if (!clientSupportsMcpApps(server.server?.getClientCapabilities?.())) return result;
      const view = build();
      if (!view) return result;
      const meta = asRecord(result._meta) ?? {};
      return { ...result, _meta: { ...meta, [VIEW_META_KEY]: view } };
    },
  };
}

const RUNNING = new Set(["Running", "AsyncWaiting", "TaskWaiting", "TimedWaiting", "ResourceWaiting", "Pausing", "Discontinuing"]);
const QUEUED = new Set(["Queued", "NotStarted", "QueuedLicenseLimitReached", "QueuedExecutionConcurrencyReached", "WaitStepRunning"]);
const WAITING = new Set(["ApprovalWaiting", "InterventionWaiting", "InputWaiting", "Paused", "WaitingOnApproval"]);
const SUCCESS = new Set(["Success", "Succeeded", "IgnoreFailed"]);
const FAILED = new Set(["Failed", "Errored", "Expired", "ApprovalRejected", "Error"]);
const ABORTED = new Set(["Aborted", "AbortedByFreeze", "Skipped", "Suspended"]);

const STATUS_LABELS: Record<string, string> = {
  AbortedByFreeze: "Blocked by freeze",
  ApprovalWaiting: "Waiting for approval",
  InterventionWaiting: "Waiting for intervention",
  InputWaiting: "Waiting for input",
  ApprovalRejected: "Rejected",
  IgnoreFailed: "Succeeded",
  Success: "Succeeded",
};

/** Map a Harness execution/resource status to a display pill. */
export function viewStatus(status: string | undefined): ViewStatus | undefined {
  if (!status) return undefined;
  const label = STATUS_LABELS[status] ?? status.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (RUNNING.has(status)) return { label, tone: "info", live: true };
  if (QUEUED.has(status)) return { label, tone: "neutral", live: true };
  if (WAITING.has(status)) return { label, tone: "warning", live: true };
  if (SUCCESS.has(status)) return { label, tone: "success" };
  if (FAILED.has(status)) return { label, tone: "danger" };
  if (ABORTED.has(status)) return { label, tone: "neutral" };
  return { label, tone: "neutral" };
}

/** Name and identifier from the record, a nested entity ({service: {...}}), or a YAML-only body (yamlPipeline). */
function entityLabels(record: Record<string, unknown>): { name?: string; identifier?: string } {
  const read = (r: Record<string, unknown> | undefined) => ({
    name: asString(r?.name) ?? asString(r?.displayName),
    identifier: asString(r?.identifier) ?? asString(r?.id),
  });
  const top = read(record);
  if (top.name || top.identifier) return top;
  for (const value of Object.values(record)) {
    const nested = asRecord(value);
    if (nested && ("identifier" in nested || "name" in nested)) {
      const labels = read(nested);
      if (labels.name || labels.identifier) return labels;
    }
  }
  for (const [key, value] of Object.entries(record)) {
    if (!/^yaml/i.test(key) || typeof value !== "string") continue;
    try {
      const root = asRecord(parseYaml(value));
      const entity = root ? asRecord(Object.values(root)[0]) : undefined;
      const labels = read(entity);
      if (labels.name || labels.identifier) return labels;
    } catch {
      // not YAML; ignore
    }
  }
  return {};
}

/**
 * Generic card for a single-resource result: name or identifier, status, and the
 * openInHarness deep link. Returns undefined when there is nothing worth showing.
 */
export function buildResultView(
  data: unknown,
  options: { displayName: string; action?: string; refresh?: ViewRefresh; status?: string; resourceId?: string },
): ResultView | undefined {
  const record = asRecord(data);
  if (!record) return undefined;
  const labels = entityLabels(record);
  const name = labels.name;
  const identifier = labels.identifier ?? options.resourceId;
  const link = asString(record.openInHarness);
  if (!link && !name && !identifier) return undefined;

  const subtitleParts = [options.displayName, options.action, name && identifier && name !== identifier ? identifier : undefined];
  const view: ResultView = {
    kind: "result",
    title: name ?? identifier ?? options.displayName,
    subtitle: subtitleParts.filter(Boolean).join(" · "),
  };
  const status = viewStatus(options.status ?? asString(record.status));
  if (status) view.status = status;
  if (link) view.open_in_harness = link;
  if (options.refresh) view.refresh = options.refresh;
  return view;
}
