export interface HttpSessionActivity {
  lastActivity: number;
  activeRequests: number;
}

export function beginSessionRequest(session: HttpSessionActivity, now = Date.now()): void {
  session.activeRequests += 1;
  session.lastActivity = now;
}

export function endSessionRequest(session: HttpSessionActivity, now = Date.now()): void {
  session.activeRequests = Math.max(0, session.activeRequests - 1);
  session.lastActivity = now;
}

export function isSessionExpired(session: HttpSessionActivity, ttlMs: number, now = Date.now()): boolean {
  return session.activeRequests === 0 && now - session.lastActivity > ttlMs;
}
