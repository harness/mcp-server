import { describe, expect, it } from "vitest";
import {
  checkHttpSessionLimit,
  createHttpSessionLimitError,
  type HttpSessionLimitConfig,
  type HttpSessionLimitEntry,
} from "../../src/utils/http-session-limits.js";

const limits: HttpSessionLimitConfig = {
  maxSessions: 3,
  maxSessionsPerPrincipal: 2,
};

function session(principal: string): HttpSessionLimitEntry {
  return { principal };
}

describe("HTTP MCP session limits", () => {
  it("allows a new session while global and principal caps have capacity", () => {
    const sessions = new Map([
      ["s1", session("acct-a")],
      ["s2", session("acct-b")],
    ]);

    expect(checkHttpSessionLimit(sessions, "acct-a", limits)).toEqual({ allowed: true });
  });

  it("rejects when the global session cap is reached", () => {
    const sessions = new Map([
      ["s1", session("acct-a")],
      ["s2", session("acct-b")],
      ["s3", session("acct-c")],
    ]);

    expect(checkHttpSessionLimit(sessions, "acct-d", limits)).toEqual({
      allowed: false,
      reason: "global",
      status: 429,
      message: "Too many active MCP sessions. Close an existing session and retry.",
    });
  });

  it("rejects when the principal session cap is reached", () => {
    const sessions = new Map([
      ["s1", session("acct-a")],
      ["s2", session("acct-a")],
    ]);

    expect(checkHttpSessionLimit(sessions, "acct-a", limits)).toEqual({
      allowed: false,
      reason: "principal",
      status: 429,
      message: "Too many active MCP sessions for this principal. Close an existing session and retry.",
    });
  });

  it("uses the lower cap when per-principal cap is higher than the global cap", () => {
    const sessions = new Map([
      ["s1", session("acct-a")],
    ]);

    expect(checkHttpSessionLimit(sessions, "acct-a", {
      maxSessions: 2,
      maxSessionsPerPrincipal: 10,
    })).toEqual({ allowed: true });

    sessions.set("s2", session("acct-a"));

    expect(checkHttpSessionLimit(sessions, "acct-a", {
      maxSessions: 2,
      maxSessionsPerPrincipal: 10,
    })).toMatchObject({ allowed: false, reason: "global" });
  });

  it("formats cap rejections as JSON-RPC errors", () => {
    expect(createHttpSessionLimitError("Too many sessions")).toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Too many sessions" },
      id: null,
    });
  });
});
