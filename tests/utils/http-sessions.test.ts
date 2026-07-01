import { describe, expect, it } from "vitest";
import { beginSessionRequest, endSessionRequest, isSessionExpired, type HttpSessionActivity } from "../../src/utils/http-sessions.js";

describe("HTTP session activity tracking", () => {
  it("does not expire sessions with active requests even when the TTL has elapsed", () => {
    const session: HttpSessionActivity = {
      lastActivity: 1_000,
      activeRequests: 1,
    };

    expect(isSessionExpired(session, 5_000, 10_001)).toBe(false);
  });

  it("expires only idle sessions whose last completed activity is older than the TTL", () => {
    const session: HttpSessionActivity = {
      lastActivity: 1_000,
      activeRequests: 0,
    };

    expect(isSessionExpired(session, 5_000, 6_000)).toBe(false);
    expect(isSessionExpired(session, 5_000, 6_001)).toBe(true);
  });

  it("keeps the session active while work is in flight and resets idle time on completion", () => {
    const session: HttpSessionActivity = {
      lastActivity: 1_000,
      activeRequests: 0,
    };

    beginSessionRequest(session, 2_000);

    expect(session).toEqual({
      lastActivity: 2_000,
      activeRequests: 1,
    });
    expect(isSessionExpired(session, 5_000, 8_000)).toBe(false);

    endSessionRequest(session, 8_000);

    expect(session).toEqual({
      lastActivity: 8_000,
      activeRequests: 0,
    });
    expect(isSessionExpired(session, 5_000, 13_000)).toBe(false);
    expect(isSessionExpired(session, 5_000, 13_001)).toBe(true);
  });

  it("does not let defensive completion calls drive active request counts negative", () => {
    const session: HttpSessionActivity = {
      lastActivity: 1_000,
      activeRequests: 0,
    };

    endSessionRequest(session, 2_000);

    expect(session).toEqual({
      lastActivity: 2_000,
      activeRequests: 0,
    });
  });

  it("keeps sessions alive while overlapping POST and SSE work is in flight", () => {
    const session: HttpSessionActivity = {
      lastActivity: 1_000,
      activeRequests: 0,
    };

    beginSessionRequest(session, 2_000);
    beginSessionRequest(session, 2_500);

    expect(session.activeRequests).toBe(2);
    expect(isSessionExpired(session, 5_000, 10_000)).toBe(false);

    endSessionRequest(session, 10_000);
    expect(session.activeRequests).toBe(1);
    expect(isSessionExpired(session, 5_000, 10_000)).toBe(false);

    endSessionRequest(session, 10_500);
    expect(isSessionExpired(session, 5_000, 15_500)).toBe(false);
    expect(isSessionExpired(session, 5_000, 15_501)).toBe(true);
  });

  it("regresses long-running POST past default TTL while harness_execute wait is active", () => {
    const defaultTtlMs = 5 * 60_000;
    const session: HttpSessionActivity = {
      lastActivity: 0,
      activeRequests: 0,
    };

    beginSessionRequest(session, 0);

    // Simulate a 10-minute wait:true execute still holding the POST open.
    const tenMinutesMs = 10 * 60_000;
    expect(isSessionExpired(session, defaultTtlMs, tenMinutesMs)).toBe(false);

    endSessionRequest(session, tenMinutesMs);
    expect(isSessionExpired(session, defaultTtlMs, tenMinutesMs + defaultTtlMs)).toBe(false);
    expect(isSessionExpired(session, defaultTtlMs, tenMinutesMs + defaultTtlMs + 1)).toBe(true);
  });
});
