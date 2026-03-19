import type { Config } from "../config.js";
import type { RequestOptions } from "./types.js";
import { HarnessApiError } from "../utils/errors.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("harness-client");

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const BASE_BACKOFF_MS = 1000;

/** Strip HTML tags and collapse whitespace — used for non-JSON error bodies. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Produce a clean, actionable error message for non-JSON HTTP error responses. */
function humanizeHttpError(status: number, rawBody: string): string {
  const isHtml = /^\s*</.test(rawBody);
  const hint = isHtml ? stripHtml(rawBody).slice(0, 120) : rawBody.slice(0, 200);

  switch (status) {
    case 401:
      return `HTTP 401 Unauthorized — API key is invalid or expired. Verify HARNESS_API_KEY is a valid PAT or Service Account token.${hint ? ` (${hint})` : ""}`;
    case 403:
      return `HTTP 403 Forbidden — access denied. Possible causes: wrong HARNESS_ACCOUNT_ID, IP restrictions, missing RBAC permissions, or corporate proxy/WAF blocking the request.${hint ? ` (${hint})` : ""}`;
    case 404:
      return `HTTP 404 Not Found — the API endpoint or resource does not exist. Verify the base URL and resource identifiers.${hint ? ` (${hint})` : ""}`;
    default:
      return `HTTP ${status}: ${hint || "empty response"}`;
  }
}

export class HarnessClient {
  private readonly baseUrl: string;
  private readonly token?: string;  // Optional — may be undefined in JWT-only mode
  private readonly accountId: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly rateLimiter: RateLimiter;
  private readonly authHeader?: string;  // Authorization header for JWT passthrough

  constructor(config: Config, authHeader?: string) {
    this.baseUrl = config.HARNESS_BASE_URL.replace(/\/$/, "");
    this.token = config.HARNESS_API_KEY;
    this.accountId = config.HARNESS_ACCOUNT_ID;
    this.timeout = config.HARNESS_API_TIMEOUT_MS;
    this.maxRetries = config.HARNESS_MAX_RETRIES;
    this.rateLimiter = new RateLimiter(config.HARNESS_RATE_LIMIT_RPS);
    this.authHeader = authHeader;
  }

  get account(): string {
    return this.accountId;
  }

  get baseURL(): string {
    return this.baseUrl;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    await this.rateLimiter.acquire();

    const method = options.method ?? "GET";
    const url = this.buildUrl(options);
    const headers: Record<string, string> = {
      "Harness-Account": this.accountId,
      ...options.headers,
    };

    // Inject authentication header — JWT takes precedence over API key
    if (this.authHeader) {
      headers["Authorization"] = this.authHeader;
    } else if (this.token) {
      headers["x-api-key"] = this.token;
    }

    if (options.body) {
      if (typeof options.body === "string") {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/yaml";
      } else {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      }
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
        log.debug(`Retry attempt ${attempt}/${this.maxRetries}`, { backoffMs: Math.round(backoff) });
        await new Promise((r) => setTimeout(r, backoff));
      }

      try {
        // Check if already aborted before starting the request
        if (options.signal?.aborted) {
          throw options.signal.reason ?? new DOMException("The operation was aborted", "AbortError");
        }

        const timeoutController = new AbortController();
        const effectiveTimeout = options.timeoutMs ?? this.timeout;
        const timer = setTimeout(() => timeoutController.abort(), effectiveTimeout);
        // Merge external signal (client disconnect) with timeout signal
        const signal = options.signal
          ? AbortSignal.any([options.signal, timeoutController.signal])
          : timeoutController.signal;

        const bodyString = options.body
          ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body))
          : undefined;

        log.debug(`${method} ${url}`);
        if (bodyString) {
          log.debug("Request body", { body: bodyString.slice(0, 1000) });
        }

        const response = await fetch(url, {
          method,
          headers,
          body: bodyString,
          signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const body = await response.text();
          let parsed: { message?: string; code?: string; correlationId?: string } = {};
          try {
            parsed = JSON.parse(body);
          } catch {
            // Non-JSON error (HTML proxy page, WAF block, etc.)
            // Provide actionable messages instead of leaking raw HTML to the LLM
          }

          const message = parsed.message ?? humanizeHttpError(response.status, body);
          log.debug(`HTTP ${response.status} error`, { body: body.slice(0, 1000) });
          const error = new HarnessApiError(
            message,
            response.status,
            parsed.code,
            parsed.correlationId,
          );

          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
            lastError = error;
            continue;
          }

          throw error;
        }

        // 204 No Content — valid success response (e.g. PATCH/DELETE on PM API)
        if (response.status === 204) {
          return { status: "SUCCESS", message: "No content" } as T;
        }

        const text = await response.text();
        if (!text) {
          throw new HarnessApiError(
            `Empty response body from ${method} ${options.path}`,
            502,
          );
        }
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          throw new HarnessApiError(
            `Non-JSON response from ${method} ${options.path}: ${text.slice(0, 200)}`,
            502,
            undefined,
            undefined,
            parseErr,
          );
        }
        log.debug("Response body", { body: text.slice(0, 1000) });
        return data as T;
      } catch (err) {
        if (err instanceof HarnessApiError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          // External signal (client disconnect) — stop immediately, don't retry
          if (options.signal?.aborted) {
            throw new HarnessApiError("Request cancelled", 499, undefined, undefined, err);
          }
          // Timeout — retry if allowed
          lastError = new HarnessApiError("Request timed out", 408, undefined, undefined, err);
          if (attempt < this.maxRetries) continue;
          throw lastError;
        }
        throw new HarnessApiError(
          `Request failed: ${(err as Error).message ?? String(err)}`,
          502,
          undefined,
          undefined,
          err,
        );
      }
    }

    throw lastError ?? new HarnessApiError("Max retries exceeded", 500);
  }

  /**
   * Make a request and return the raw Response (for streaming).
   * Reuses auth, URL building, rate limiting, and retry on non-OK status
   * (before body consumption). Caller is responsible for reading the body.
   */
  async requestStream(options: RequestOptions): Promise<Response> {
    await this.rateLimiter.acquire();

    const method = options.method ?? "POST";
    const url = this.buildUrl(options);
    const headers: Record<string, string> = {
      "Harness-Account": this.accountId,
      ...options.headers,
    };

    // Inject authentication header — JWT takes precedence over API key
    if (this.authHeader) {
      headers["Authorization"] = this.authHeader;
    } else if (this.token) {
      headers["x-api-key"] = this.token;
    }

    if (options.body) {
      if (typeof options.body === "string") {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/yaml";
      } else {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      }
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
        log.debug(`Stream retry attempt ${attempt}/${this.maxRetries}`, { backoffMs: Math.round(backoff) });
        await new Promise((r) => setTimeout(r, backoff));
      }

      try {
        if (options.signal?.aborted) {
          throw options.signal.reason ?? new DOMException("The operation was aborted", "AbortError");
        }

        const timeoutController = new AbortController();
        const effectiveTimeout = options.timeoutMs ?? this.timeout;
        const timer = setTimeout(() => timeoutController.abort(), effectiveTimeout);
        const signal = options.signal
          ? AbortSignal.any([options.signal, timeoutController.signal])
          : timeoutController.signal;

        const bodyString = options.body
          ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body))
          : undefined;

        log.debug(`STREAM ${method} ${url}`);

        const response = await fetch(url, { method, headers, body: bodyString, signal });

        clearTimeout(timer);

        if (!response.ok) {
          const body = await response.text();
          let parsed: { message?: string; code?: string; correlationId?: string } = {};
          try { parsed = JSON.parse(body); } catch { /* non-JSON */ }

          const message = parsed.message ?? humanizeHttpError(response.status, body);
          const error = new HarnessApiError(message, response.status, parsed.code, parsed.correlationId);

          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
            lastError = error;
            continue;
          }
          throw error;
        }

        return response;
      } catch (err) {
        if (err instanceof HarnessApiError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          if (options.signal?.aborted) {
            throw new HarnessApiError("Request cancelled", 499, undefined, undefined, err);
          }
          lastError = new HarnessApiError("Request timed out", 408, undefined, undefined, err);
          if (attempt < this.maxRetries) continue;
          throw lastError;
        }
        throw new HarnessApiError(
          `Request failed: ${(err as Error).message ?? String(err)}`,
          502, undefined, undefined, err,
        );
      }
    }

    throw lastError ?? new HarnessApiError("Max retries exceeded", 500);
  }

  private buildUrl(options: RequestOptions): string {
    const baseUrl = (options.baseUrl ?? this.baseUrl).replace(/\/$/, "");
    let path = options.path;

    // Prevent double /gateway when base URL already ends with /gateway
    // (common with self-managed Harness installations)
    if (baseUrl.endsWith("/gateway") && path.startsWith("/gateway/")) {
      path = path.slice("/gateway".length);
    }

    // Inject accountIdentifier into query params (used by most Harness APIs)
    const params = new URLSearchParams();
    params.set("accountIdentifier", this.accountId);

    // Log-service gateway expects accountID (capital ID) in query params
    if (path.includes("/log-service/")) {
      params.set("accountID", this.accountId);
    }

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== "") {
          params.set(key, String(value));
        }
      }
    }

    return `${baseUrl}${path}?${params.toString()}`;
  }
}
