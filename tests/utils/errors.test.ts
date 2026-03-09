import { describe, it, expect } from "vitest";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  HarnessApiError,
  isUserError,
  isUserFixableApiError,
  toMcpError,
} from "../../src/utils/errors.js";

describe("isUserFixableApiError", () => {
  it("returns true for HarnessApiError with status 400", () => {
    const err = new HarnessApiError("Bad request", 400);
    expect(isUserFixableApiError(err)).toBe(true);
  });

  it("returns true for HarnessApiError with status 404", () => {
    const err = new HarnessApiError("Pipeline not found", 404, "ENTITY_NOT_FOUND");
    expect(isUserFixableApiError(err)).toBe(true);
  });

  it("returns false for HarnessApiError with status 401", () => {
    const err = new HarnessApiError("Unauthorized", 401);
    expect(isUserFixableApiError(err)).toBe(false);
  });

  it("returns false for HarnessApiError with status 403", () => {
    const err = new HarnessApiError("Forbidden", 403);
    expect(isUserFixableApiError(err)).toBe(false);
  });

  it("returns false for HarnessApiError with status 429", () => {
    const err = new HarnessApiError("Rate limited", 429);
    expect(isUserFixableApiError(err)).toBe(false);
  });

  it("returns false for HarnessApiError with status 500", () => {
    const err = new HarnessApiError("Internal server error", 500);
    expect(isUserFixableApiError(err)).toBe(false);
  });

  it("returns false for plain Error", () => {
    const err = new Error("something broke");
    expect(isUserFixableApiError(err)).toBe(false);
  });

  it("returns false for McpError", () => {
    const err = new McpError(ErrorCode.InternalError, "mcp error");
    expect(isUserFixableApiError(err)).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isUserFixableApiError("string")).toBe(false);
    expect(isUserFixableApiError(null)).toBe(false);
    expect(isUserFixableApiError(undefined)).toBe(false);
  });
});

describe("isUserError", () => {
  it("returns true for plain Error", () => {
    expect(isUserError(new Error("bad input"))).toBe(true);
  });

  it("returns false for HarnessApiError", () => {
    expect(isUserError(new HarnessApiError("not found", 404))).toBe(false);
  });

  it("returns false for McpError", () => {
    expect(isUserError(new McpError(ErrorCode.InternalError, "mcp"))).toBe(false);
  });
});

describe("HarnessApiError — cause chain", () => {
  it("preserves cause when provided", () => {
    const original = new TypeError("fetch failed");
    const err = new HarnessApiError("Request failed: fetch failed", 502, undefined, undefined, original);
    expect(err.cause).toBe(original);
  });

  it("cause is undefined when not provided", () => {
    const err = new HarnessApiError("Not found", 404);
    expect(err.cause).toBeUndefined();
  });

  it("works with non-Error cause values", () => {
    const err = new HarnessApiError("fail", 500, undefined, undefined, "raw string cause");
    expect(err.cause).toBe("raw string cause");
  });
});

describe("toMcpError — cause chain", () => {
  it("preserves HarnessApiError as cause on McpError", () => {
    const original = new HarnessApiError("timeout", 408);
    const result = toMcpError(original);
    expect(result.cause).toBe(original);
  });

  it("preserves plain Error as cause on McpError", () => {
    const original = new Error("oops");
    const result = toMcpError(original);
    expect(result.cause).toBe(original);
  });

  it("preserves nested cause chain (HarnessApiError wrapping TypeError)", () => {
    const root = new TypeError("network error");
    const apiErr = new HarnessApiError("Request failed: network error", 502, undefined, undefined, root);
    const mcpErr = toMcpError(apiErr);
    expect(mcpErr.cause).toBe(apiErr);
    expect((mcpErr.cause as HarnessApiError).cause).toBe(root);
  });
});

describe("toMcpError", () => {
  it("passes through McpError unchanged", () => {
    const err = new McpError(ErrorCode.InvalidParams, "bad");
    expect(toMcpError(err)).toBe(err);
  });

  it("maps HarnessApiError 401 to InvalidRequest", () => {
    const result = toMcpError(new HarnessApiError("Unauthorized", 401));
    expect(result).toBeInstanceOf(McpError);
    expect(result.code).toBe(ErrorCode.InvalidRequest);
  });

  it("includes correlationId in message", () => {
    const result = toMcpError(new HarnessApiError("fail", 500, undefined, "abc-123"));
    expect(result.message).toContain("abc-123");
  });

  it("wraps plain Error as InternalError", () => {
    const result = toMcpError(new Error("oops"));
    expect(result).toBeInstanceOf(McpError);
    expect(result.code).toBe(ErrorCode.InternalError);
  });

  it("wraps string as InternalError", () => {
    const result = toMcpError("raw string");
    expect(result).toBeInstanceOf(McpError);
    expect(result.message).toContain("raw string");
  });
});
