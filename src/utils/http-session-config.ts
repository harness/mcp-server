import type { Request } from "express";
import type { Config } from "../config.js";
import { extractAccountIdFromToken } from "../config.js";

const DEFAULT_HARNESS_BASE_URL = "https://app.harness.io";
const PIPELINE_VERSION_HEADER = "x-harness-pipeline-version";

type HeaderRequest = Pick<Request, "headers">;

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

function header(req: HeaderRequest, name: string): string | undefined {
  return firstHeaderValue(req.headers[name.toLowerCase()]);
}

function stripPort(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(1, end) : host;
  }
  return host.split(":")[0] ?? host;
}

function harnessBaseUrlFromRequest(req: HeaderRequest): string | undefined {
  const rawHost = header(req, "x-forwarded-host") ?? header(req, "host");
  if (!rawHost) return undefined;

  const hostname = stripPort(rawHost).toLowerCase();
  if (!hostname.endsWith(".harness.io")) return undefined;
  if (hostname === "mcp.harness.io") return undefined;

  return `https://${hostname}`;
}

export function mergeConfigWithHttpRequest(baseConfig: Config, req: HeaderRequest): Config {
  const apiKey = header(req, "x-api-key");
  const accountId = header(req, "harness-account")
    ?? (apiKey ? extractAccountIdFromToken(apiKey) : undefined);
  const pipelineVersion = header(req, PIPELINE_VERSION_HEADER);
  const requestBaseUrl = harnessBaseUrlFromRequest(req);

  return {
    ...baseConfig,
    ...(apiKey ? { HARNESS_API_KEY: apiKey } : {}),
    ...(accountId ? { HARNESS_ACCOUNT_ID: accountId } : {}),
    ...(pipelineVersion === "0" || pipelineVersion === "1" ? { HARNESS_PIPELINE_VERSION: pipelineVersion } : {}),
    ...(baseConfig.HARNESS_BASE_URL === DEFAULT_HARNESS_BASE_URL && requestBaseUrl
      ? { HARNESS_BASE_URL: requestBaseUrl }
      : {}),
  };
}
