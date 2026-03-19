/**
 * Harness API response envelope types.
 */

/** Standard Harness NG API response wrapper */
export interface HarnessResponse<T> {
  status: "SUCCESS" | "ERROR" | "FAILURE";
  data?: T;
  message?: string;
  code?: string;
  correlationId?: string;
  metadata?: unknown;
}

/** Paginated content wrapper (used by some endpoints) */
export interface HarnessPageResponse<T> {
  status: "SUCCESS" | "ERROR" | "FAILURE";
  data?: {
    content?: T[];
    totalElements?: number;
    totalPages?: number;
    pageIndex?: number;
    pageSize?: number;
    empty?: boolean;
  };
  message?: string;
  code?: string;
  correlationId?: string;
}

/** V1 beta list response format */
export interface HarnessV1ListResponse<T> {
  items?: T[];
  page?: number;
  limit?: number;
  totalItems?: number;
  totalPages?: number;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Override base URL for this request (e.g. FME/Split.io uses https://api.split.io) */
  baseUrl?: string;
  /** Override base path prefix (e.g. "/pipeline/api" vs "/ng/api") */
  rawPath?: boolean;
  /** External abort signal (e.g. from MCP client disconnect). Merged with timeout. */
  signal?: AbortSignal;
  /** Override default timeout for this request (milliseconds). */
  timeoutMs?: number;
  /** Return raw ArrayBuffer instead of parsing JSON. Used for binary endpoints (ZIP downloads). */
  responseType?: "json" | "buffer";
}
