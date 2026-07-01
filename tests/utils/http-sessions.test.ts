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
});
