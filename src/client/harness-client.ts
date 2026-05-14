import type { Config } from "../config.js";
import type { RequestOptions } from "./types.js";
import { HarnessApiError } from "../utils/errors.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import { createLogger } from "../utils/logger.js";
import { redactJsonString } from "../utils/redact.js";
import { isFormDataBody } from "../utils/type-guards.js";

const log = createLogger("harness-client");

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Whether the caller explicitly set a body (including empty string).
 * `""` must be preserved: `if (options.body)` treats it as absent, which drops the
 * YAML body on pipeline execute — Harness then ignores `inputSetIdentifiers` and
 * fails with "Value not provided for required variable".
 */
function hasExplicitBody(body: unknown): boolean {
  return body !== undefined && body !== null;
}

function serializeRequestBody(body: unknown): BodyInit | undefined {
  if (!hasExplicitBody(body)) return undefined;
  if (isFormDataBody(body)) return body;
  return typeof body === "string" ? body : JSON.stringify(body);
}

const BASE_BACKOFF_MS = 1000;

/** Strip HTML tags, script/style contents, and collapse whitespace. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s>][\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when body is an HTML page (redirect, WAF block, proxy error). */
function isHtmlBody(body: string): boolean {
  return /^\s*</.test(body) || /<!doctype/i.test(body.slice(0, 100));
}

/** Produce a clean, actionable error message for non-JSON HTTP error responses. */
function humanizeHttpError(status: number, rawBody: string): string {
  const html = isHtmlBody(rawBody);

  switch (status) {
    case 401:
      return "HTTP 401 Unauthorized — API key is invalid or expired. Verify HARNESS_API_KEY is a valid PAT or Service Account token.";
    case 403:
      return "HTTP 403 Forbidden — access denied. Possible causes: wrong HARNESS_ACCOUNT_ID, IP restrictions, missing RBAC permissions, or corporate proxy/WAF blocking the request.";
    case 404:
      return `HTTP 404 Not Found — the API endpoint or resource does not exist. Verify the base URL and resource identifiers.`;
    default: {
      if (html) return `HTTP ${status}: Harness returned an HTML error page (possible proxy, WAF, or redirect). Check HARNESS_BASE_URL and network connectivity.`;
      const hint = rawBody.slice(0, 200);
      return `HTTP ${status}: ${hint || "empty response"}`;
    }
  }
}

/**
 * Detect when parsed.message contains HTML/JS from a redirect page
 * rather than a real Harness API error message.
 */
function isGarbageMessage(message: string | undefined): boolean {
  if (!message) return true;
  if (isHtmlBody(message)) return true;
  if (/function\s+\w+\s*\(/.test(message)) return true;
  if (/redirectPage|signInPath|encodeURIComponent/.test(message)) return true;
  return false;
}

/**
 * Per-path-prefix error field enrichments.
 * When an API error response contains the named field AND the request path
 * matches the prefix, the field value is appended to the error message.
 * Add entries here for endpoint groups that return extra context fields.
 */
const ERROR_FIELD_ENRICHMENTS: Array<{ pathPrefix: string; field: string }> = [
  { pathPrefix: "/chaos/", field: "description" },
  { pathPrefix: "/loadTest/", field: "description" },
];

function enrichErrorMessage(
  rawMessage: string,
  parsed: Record<string, unknown>,
  path: string,
): string {
  let message = rawMessage;
  for (const { pathPrefix, field } of ERROR_FIELD_ENRICHMENTS) {
    const value = parsed[field];
    if (path.startsWith(pathPrefix) && typeof value === "string" && value) {
      message += ` — ${value}`;
    }
  }
  return message;
}

/**
 * Optional per-request account ID resolver. When provided, HarnessClient
 * calls this to get the real account ID (e.g. from JWT claims stored in
 * AsyncLocalStorage) instead of using the static config value.
 */
export type AccountIdResolver = () => string | undefined;

export class HarnessClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly accountId: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly rateLimiter: RateLimiter;
  private readonly logUnsafeBodies: boolean;
  private accountIdResolver?: AccountIdResolver;
  private currentUserId?: string;
  private currentUserPromise?: Promise<string>;

  constructor(config: Config) {
    this.baseUrl = config.HARNESS_BASE_URL.replace(/\/$/, "");
    this.token = config.HARNESS_API_KEY;
    this.accountId = config.HARNESS_ACCOUNT_ID;
    this.timeout = config.HARNESS_API_TIMEOUT_MS;
    this.maxRetries = config.HARNESS_MAX_RETRIES;
    this.rateLimiter = new RateLimiter(config.HARNESS_RATE_LIMIT_RPS);
    this.logUnsafeBodies = config.HARNESS_LOG_UNSAFE_BODIES;
  }

  /**
   * Set a per-request account ID resolver. When set, resolveAccountId()
   * calls this first, falling back to the static config value.
   */
  setAccountIdResolver(resolver: AccountIdResolver): void {
    this.accountIdResolver = resolver;
  }

  /** Resolve the account ID: per-request override → static config fallback. */
  private resolveAccountId(): string {
    return this.accountIdResolver?.() ?? this.accountId;
  }

  get account(): string {
    return this.resolveAccountId();
  }

  get baseURL(): string {
    return this.baseUrl;
  }

  /**
   * Resolve the UUID of the user authenticated by the current PAT.
   * Cached for the lifetime of the process and inflight-deduped so concurrent
   * callers share a single GET /ng/api/user/currentUser request.
   *
   * Used by callers (e.g. STO exemption approve/reject/promote) that need to
   * stamp the authenticated user as the actor without forcing the LLM to ask
   * the human for a UUID.
   */
  async getCurrentUserId(): Promise<string> {
    if (this.currentUserId) return this.currentUserId;
    if (this.currentUserPromise) return this.currentUserPromise;
    this.currentUserPromise = (async () => {
      const resp = await this.request<{ data?: { uuid?: string } }>({
        method: "GET",
        path: "/ng/api/user/currentUser",
      });
      const uuid = resp?.data?.uuid;
      if (!uuid) {
        throw new HarnessApiError(
          "Could not resolve current user UUID via /ng/api/user/currentUser. " +
          "The PAT may belong to a service account without a user identity.",
          500,
        );
      }
      this.currentUserId = uuid;
      return uuid;
    })();
    try {
      return await this.currentUserPromise;
    } catch (err) {
      this.currentUserPromise = undefined;
      throw err;
    }
  }

  async request<T>(options: RequestOptions): Promise<T> {
    await this.rateLimiter.acquire();

    const method = options.method ?? "GET";
    const url = this.buildUrl(options);
    const isFme = options.product === "fme";
    const accountId = this.resolveAccountId();
    const headers: Record<string, string> = {
      ...(isFme ? {} : { "Harness-Account": accountId }),
      ...options.headers,
    };

    // Only inject x-api-key when the caller hasn't already set auth.
    // When service-routing handles auth (bearer-jwt, remote-mcp), it sets
    // Authorization directly — sending x-api-key alongside would cause
    // downstream services to attempt API-key validation on the dummy token.
    if (!headers["Authorization"] && !headers["x-api-key"]) {
      headers["x-api-key"] = this.token;
    }

    if (hasExplicitBody(options.body)) {
      if (typeof options.body === "string") {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/yaml";
      } else if (isFormDataBody(options.body)) {
        // Let fetch set multipart/form-data with the correct boundary.
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

        const bodyString = serializeRequestBody(options.body);

        log.debug(`${method} ${url}`);
        if (isFormDataBody(options.body)) {
          log.debug("Request body", { body: "multipart/form-data body (redacted)" });
        } else if (bodyString !== undefined) {
          const serializedBody = bodyString as string;
          log.debug("Request body", {
            body: this.logUnsafeBodies ? serializedBody.slice(0, 1000) : redactJsonString(serializedBody),
          });
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

          const rawMessage = isGarbageMessage(parsed.message)
              ? humanizeHttpError(response.status, body)
              : parsed.message!;
          const message = enrichErrorMessage(rawMessage, parsed, options.path);
          log.debug(`HTTP ${response.status} error`, {
            body: this.logUnsafeBodies ? body.slice(0, 1000) : redactJsonString(body),
          });
          const error = new HarnessApiError(
            message,
            response.status,
            parsed.code,
            parsed.correlationId,
          );

          if (
            RETRYABLE_STATUS_CODES.has(response.status) &&
            attempt < this.maxRetries &&
            options.retryPolicy !== "do_not_retry"
          ) {
            lastError = error;
            continue;
          }

          throw error;
        }

        // 204 No Content — valid success response (e.g. PATCH/DELETE on PM API)
        if (response.status === 204) {
          return { status: "SUCCESS", message: "No content" } as T;
        }

        // Binary response mode — return raw ArrayBuffer (used for ZIP downloads)
        if (options.responseType === "buffer") {
          const buffer = await response.arrayBuffer();
          log.debug("Binary response", { bytes: buffer.byteLength });
          return buffer as T;
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
        log.debug("Response body", {
          body: this.logUnsafeBodies ? text.slice(0, 1000) : redactJsonString(text),
        });
        return data as T;
      } catch (err) {
        if (err instanceof HarnessApiError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          // External signal (client disconnect) — stop immediately, don't retry
          if (options.signal?.aborted) {
            throw new HarnessApiError("Request cancelled", 499, undefined, undefined, err);
          }
          // Timeout — retry if allowed (and policy permits)
          lastError = new HarnessApiError("Request timed out", 408, undefined, undefined, err);
          if (attempt < this.maxRetries && options.retryPolicy !== "do_not_retry") continue;
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
    const isFme = options.product === "fme";
    const accountId = this.resolveAccountId();
    const headers: Record<string, string> = {
      ...(isFme ? {} : { "Harness-Account": accountId }),
      ...options.headers,
    };

    // Same auth-header guard as request() — see comment there.
    if (!headers["Authorization"] && !headers["x-api-key"]) {
      headers["x-api-key"] = this.token;
    }

    if (hasExplicitBody(options.body)) {
      if (typeof options.body === "string") {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/yaml";
      } else if (isFormDataBody(options.body)) {
        // Let fetch set multipart/form-data with the correct boundary.
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

        const bodyString = serializeRequestBody(options.body);

        log.debug(`STREAM ${method} ${url}`);

        const response = await fetch(url, { method, headers, body: bodyString, signal });

        clearTimeout(timer);

        if (!response.ok) {
          const body = await response.text();
          let parsed: { message?: string; code?: string; correlationId?: string } = {};
          try { parsed = JSON.parse(body); } catch { /* non-JSON */ }

          const rawMessage = isGarbageMessage(parsed.message)
              ? humanizeHttpError(response.status, body)
              : parsed.message!;
          const message = enrichErrorMessage(rawMessage, parsed, options.path);
          const error = new HarnessApiError(message, response.status, parsed.code, parsed.correlationId);

          if (
            RETRYABLE_STATUS_CODES.has(response.status) &&
            attempt < this.maxRetries &&
            options.retryPolicy !== "do_not_retry"
          ) {
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
          if (attempt < this.maxRetries && options.retryPolicy !== "do_not_retry") continue;
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
    const queryIndex = path.indexOf("?");
    const pathQuery = queryIndex === -1 ? "" : path.slice(queryIndex + 1);
    if (queryIndex !== -1) {
      path = path.slice(0, queryIndex);
    }
    const pathParams = new URLSearchParams(pathQuery);

    const basePath = new URL(baseUrl).pathname.replace(/\/$/, "");
    if (basePath && basePath !== "/" && path.startsWith(`${basePath}/`)) {
      path = path.slice(basePath.length);
    }

    // Inject accountIdentifier into query params (used by most Harness APIs).
    // Some APIs (e.g. SEI) use only the Harness-Account header — skip when told.
    // FME/Split API uses neither Harness account query params nor Harness-Account header.
    const params = new URLSearchParams();
    if (!options.headerBasedScoping && options.product !== "fme") {
      const accountId = this.resolveAccountId();
      params.set("accountIdentifier", accountId);
      params.set("routingId", accountId);

      // Log-service gateway expects accountID (capital ID) in query params
      if (path.includes("/log-service/")) {
        params.set("accountID", accountId);
      }
    }

    for (const key of pathParams.keys()) {
      params.delete(key);
    }
    for (const [key, value] of pathParams) {
      params.append(key, value);
    }

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value === undefined || value === "") continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item !== undefined && item !== "") {
              params.append(key, String(item));
            }
          }
        } else {
          params.set(key, String(value));
        }
      }
    }

    const queryParts: string[] = [];
    params.forEach((value, key) => {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
    const queryString = queryParts.join('&');

    const url = queryString ? `${baseUrl}${path}?${queryString}` : `${baseUrl}${path}`;
    log.debug(`Built URL: ${url}`);
    return url;
  }
}
