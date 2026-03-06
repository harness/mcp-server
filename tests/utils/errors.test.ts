import { describe, it, expect } from "vitest";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { HarnessApiError, isUserError, toMcpError } from "../../src/utils/errors.js";

describe("HarnessApiError", () => {
  it("stores statusCode, harnessCode, and correlationId", () => {
    const err = new HarnessApiError("bad request", 400, "INVALID_INPUT", "corr-123");
    expect(err.message).toBe("bad request");
    expect(err.statusCode).toBe(400);
    expect(err.harnessCode).toBe("INVALID_INPUT");
    expect(err.correlationId).toBe("corr-123");
    expect(err.name).toBe("HarnessApiError");
  });

  it("works without optional fields", () => {
    const err = new HarnessApiError("server error", 500);
    expect(err.harnessCode).toBeUndefined();
    expect(err.correlationId).toBeUndefined();
  });
});

describe("toMcpError", () => {
  it("passes McpError through unchanged", () => {
    const original = new McpError(ErrorCode.InvalidParams, "test");
    const result = toMcpError(original);
    expect(result).toBe(original);
  });

  it("maps 400 to InvalidParams", () => {
    const err = new HarnessApiError("bad input", 400);
    const result = toMcpError(err);
    expect(result).toBeInstanceOf(McpError);
    expect(result.code).toBe(ErrorCode.InvalidParams);
    expect(result.message).toContain("bad input");
  });

  it("maps 401 to InvalidRequest", () => {
    const err = new HarnessApiError("unauthorized", 401);
    const result = toMcpError(err);
    expect(result.code).toBe(ErrorCode.InvalidRequest);
  });

  it("maps 403 to InvalidRequest", () => {
    const err = new HarnessApiError("forbidden", 403);
    const result = toMcpError(err);
    expect(result.code).toBe(ErrorCode.InvalidRequest);
  });

  it("maps 404 to InvalidParams", () => {
    const err = new HarnessApiError("not found", 404);
    const result = toMcpError(err);
    expect(result.code).toBe(ErrorCode.InvalidParams);
  });

  it("maps 429 to InternalError", () => {
    const err = new HarnessApiError("rate limited", 429);
    const result = toMcpError(err);
    expect(result.code).toBe(ErrorCode.InternalError);
  });

  it("maps 5xx to InternalError", () => {
    const err = new HarnessApiError("gateway error", 502);
    const result = toMcpError(err);
    expect(result.code).toBe(ErrorCode.InternalError);
  });

  it("appends correlationId to message", () => {
    const err = new HarnessApiError("fail", 500, undefined, "corr-xyz");
    const result = toMcpError(err);
    expect(result.message).toContain("fail (correlationId: corr-xyz)");
  });

  it("maps plain Error to InternalError", () => {
    const err = new Error("something broke");
    const result = toMcpError(err);
    expect(result).toBeInstanceOf(McpError);
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("something broke");
  });

  it("maps unknown values to InternalError", () => {
    const result = toMcpError("raw string error");
    expect(result).toBeInstanceOf(McpError);
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("raw string error");
  });
});

describe("isUserError", () => {
  it("returns true for plain Error", () => {
    expect(isUserError(new Error("Unknown resource_type"))).toBe(true);
  });

  it("returns false for HarnessApiError", () => {
    expect(isUserError(new HarnessApiError("server error", 500))).toBe(false);
  });

  it("returns false for McpError", () => {
    expect(isUserError(new McpError(ErrorCode.InternalError, "fail"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isUserError("string")).toBe(false);
    expect(isUserError(null)).toBe(false);
    expect(isUserError(undefined)).toBe(false);
  });
});
