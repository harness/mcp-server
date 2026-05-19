export interface HttpSessionLifecycleState {
  lastActivity: number;
  activeRequests: number;
}

export function beginSessionRequest(session: HttpSessionLifecycleState, now = Date.now()): void {
  session.activeRequests += 1;
  session.lastActivity = now;
}

export function endSessionRequest(session: HttpSessionLifecycleState, now = Date.now()): void {
  session.activeRequests = Math.max(0, session.activeRequests - 1);
  session.lastActivity = now;
}

export function shouldReapSession(session: HttpSessionLifecycleState, now: number, ttlMs: number): boolean {
  return session.activeRequests === 0 && now - session.lastActivity > ttlMs;
}
