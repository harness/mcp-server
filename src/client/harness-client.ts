import type { Config } from "../config.js";
import type { RequestOptions } from "./types.js";
import { HarnessApiError } from "../utils/errors.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("harness-client");

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const BASE_BACKOFF_MS = 1000;

export class HarnessClient {
  private baseUrl: string;
  private token: string;
  private accountId: string;
  private timeout: number;
  private maxRetries: number;
  private rateLimiter: RateLimiter;

  constructor(config: Config) {
    this.baseUrl = config.HARNESS_BASE_URL.replace(/\/$/, "");
    this.token = config.HARNESS_API_KEY;
    this.accountId = config.HARNESS_ACCOUNT_ID;
    this.timeout = config.HARNESS_API_TIMEOUT_MS;
    this.maxRetries = config.HARNESS_MAX_RETRIES;
    this.rateLimiter = new RateLimiter(config.HARNESS_RATE_LIMIT_RPS);
  }

  get account(): string {
    return this.accountId;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    await this.rateLimiter.acquire();

    const method = options.method ?? "GET";
    const url = this.buildUrl(options);
    const headers: Record<string, string> = {
      "x-api-key": this.token,
      "Harness-Account": this.accountId,
      ...options.headers,
    };

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
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        log.debug(`${method} ${url}`);

        const response = await fetch(url, {
          method,
          headers,
          body: options.body
            ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body))
            : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const body = await response.text();
          let parsed: { message?: string; code?: string; correlationId?: string } = {};
          try {
            parsed = JSON.parse(body);
          } catch {
            // raw text error
          }

          const error = new HarnessApiError(
            parsed.message ?? `HTTP ${response.status}: ${body.slice(0, 500)}`,
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

        const data = await response.json();
        return data as T;
      } catch (err) {
        if (err instanceof HarnessApiError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          lastError = new HarnessApiError("Request timed out", 408);
          if (attempt < this.maxRetries) continue;
          throw lastError;
        }
        throw new HarnessApiError(
          `Request failed: ${(err as Error).message ?? String(err)}`,
          502,
        );
      }
    }

    throw lastError ?? new HarnessApiError("Max retries exceeded", 500);
  }

  private buildUrl(options: RequestOptions): string {
    let path = options.path;

    // Inject accountIdentifier into query params
    const params = new URLSearchParams();
    params.set("accountIdentifier", this.accountId);

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== "") {
          params.set(key, String(value));
        }
      }
    }

    return `${this.baseUrl}${path}?${params.toString()}`;
  }
}
