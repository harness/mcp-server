import type { IncomingHttpHeaders } from "node:http";
import type { Config } from "../config.js";
import { createLogger } from "./logger.js";

const log = createLogger("session-headers");

export const PIPELINE_VERSION_HEADER = "x-harness-pipeline-version";
export const AUTO_APPROVE_RISK_HEADER = "x-harness-auto-approve-risk";

function getHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const raw = headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : undefined;
}

export function parsePipelineVersionHeader(headers: IncomingHttpHeaders): "0" | "1" | undefined {
  const value = getHeader(headers, PIPELINE_VERSION_HEADER);
  if (value === "0" || value === "1") return value;
  return undefined;
}

export function parseAutoApproveRiskHeader(
  headers: IncomingHttpHeaders,
): Config["HARNESS_AUTO_APPROVE_RISK"] | undefined {
  const value = getHeader(headers, AUTO_APPROVE_RISK_HEADER);
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "none" ||
    normalized === "low_write" ||
    normalized === "medium_write" ||
    normalized === "high_write" ||
    normalized === "all"
  ) {
    return normalized as Config["HARNESS_AUTO_APPROVE_RISK"];
  }
  log.warn("Ignoring unrecognized X-Harness-Auto-Approve-Risk value", { value });
  return undefined;
}

export function mergeConfigWithSessionHeaders(
  baseConfig: Config,
  headers: IncomingHttpHeaders,
): Config {
  const pipelineVersion = parsePipelineVersionHeader(headers);
  const autoApproveRisk = parseAutoApproveRiskHeader(headers);
  if (pipelineVersion === undefined && autoApproveRisk === undefined) return baseConfig;
  return {
    ...baseConfig,
    ...(pipelineVersion !== undefined ? { HARNESS_PIPELINE_VERSION: pipelineVersion } : {}),
    ...(autoApproveRisk !== undefined ? { HARNESS_AUTO_APPROVE_RISK: autoApproveRisk } : {}),
  };
}
