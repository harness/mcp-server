import type { IncomingHttpHeaders } from "node:http";
import type { Config } from "../config.js";
import { RISK_SEVERITY, type RiskLevel } from "../registry/types.js";

export const PIPELINE_VERSION_HEADER = "x-harness-pipeline-version";
export const AUTO_APPROVE_RISK_HEADER = "x-harness-auto-approve-risk";
export const API_KEY_HEADER = "x-harness-api-key";
export const ACCOUNT_ID_HEADER = "x-harness-account-id";
export const ORG_HEADER = "x-harness-org";
export const PROJECT_HEADER = "x-harness-project";

type ConfigAutoApproveRisk = Config["HARNESS_AUTO_APPROVE_RISK"];

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
  return undefined;
}

function autoApproveSeverity(risk: ConfigAutoApproveRisk): number {
  if (risk === "none") return -1;
  if (risk === "all") return Number.POSITIVE_INFINITY;
  return RISK_SEVERITY.get(risk as RiskLevel) ?? -1;
}

function capAutoApproveRisk(
  requested: ConfigAutoApproveRisk,
  maximum: ConfigAutoApproveRisk,
): ConfigAutoApproveRisk {
  return autoApproveSeverity(requested) <= autoApproveSeverity(maximum) ? requested : maximum;
}

/**
 * Error thrown when a multi-user session is missing required credentials.
 * Handled in the HTTP session creation path to return a JSON-RPC error.
 */
export class MissingSessionCredentialsError extends Error {
  constructor(missing: string[]) {
    super(
      `Multi-user mode requires ${missing.join(" and ")} headers on the initialize request. ` +
      `Missing: ${missing.join(", ")}`,
    );
    this.name = "MissingSessionCredentialsError";
  }
}

export function mergeConfigWithSessionHeaders(
  baseConfig: Config,
  headers: IncomingHttpHeaders,
): Config {
  const pipelineVersion = parsePipelineVersionHeader(headers);
  const autoApproveRisk = parseAutoApproveRiskHeader(headers);

  const isMultiUser = baseConfig.HARNESS_MCP_MODE === "multi-user";

  // Identity headers are only accepted in multi-user mode.
  // In single-user mode, the operator's config is authoritative.
  const sessionApiKey = isMultiUser ? getHeader(headers, API_KEY_HEADER) : undefined;
  const sessionAccountId = isMultiUser ? getHeader(headers, ACCOUNT_ID_HEADER) : undefined;
  const sessionOrg = getHeader(headers, ORG_HEADER);
  const sessionProject = getHeader(headers, PROJECT_HEADER);

  if (isMultiUser) {
    const missing: string[] = [];
    if (!sessionApiKey) missing.push(API_KEY_HEADER);
    if (!sessionAccountId) missing.push(ACCOUNT_ID_HEADER);
    if (missing.length > 0) {
      throw new MissingSessionCredentialsError(missing);
    }
  }

  const hasOverrides = pipelineVersion !== undefined
    || autoApproveRisk !== undefined
    || sessionApiKey !== undefined
    || sessionAccountId !== undefined
    || sessionOrg !== undefined
    || sessionProject !== undefined;

  if (!hasOverrides) return baseConfig;

  const cappedAutoApproveRisk = autoApproveRisk === undefined
    ? undefined
    : capAutoApproveRisk(autoApproveRisk, baseConfig.HARNESS_AUTO_APPROVE_RISK ?? "none");
  return {
    ...baseConfig,
    ...(pipelineVersion !== undefined ? { HARNESS_PIPELINE_VERSION: pipelineVersion } : {}),
    ...(cappedAutoApproveRisk !== undefined ? { HARNESS_AUTO_APPROVE_RISK: cappedAutoApproveRisk } : {}),
    ...(sessionApiKey !== undefined ? { HARNESS_API_KEY: sessionApiKey } : {}),
    ...(sessionAccountId !== undefined ? { HARNESS_ACCOUNT_ID: sessionAccountId } : {}),
    ...(sessionOrg !== undefined ? { HARNESS_ORG: sessionOrg } : {}),
    ...(sessionProject !== undefined ? { HARNESS_PROJECT: sessionProject } : {}),
  };
}
