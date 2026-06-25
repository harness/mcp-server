# Stdio Stability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden PR #143's existing fixes and add a rejection circuit breaker to fully address Claude Code MCP disconnects without over-engineering.

**Architecture:** Two focused changes: (1) fix four weaknesses in PR #143's existing code (signal handler logging, inbound activity tracking, keepalive detection, shutdown cleanup), (2) replace blanket rejection swallowing with a rolling-window circuit breaker that exits after repeated failures.

**Tech Stack:** TypeScript, Node.js process APIs.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/index.ts` (modify) | Fix PR #143 review issues + wire up rejection tracker |
| `src/utils/rejection-tracker.ts` (create) | Track unhandled rejection count; trigger exit after threshold breached |
| `tests/utils/rejection-tracker.test.ts` (create) | Unit tests for rejection threshold logic |

---

## Task 1: Fix PR #143 Review Issues

**Files:**
- Modify: `src/index.ts` (signal handlers ~line 179-180, keepalive ~line 182-197, activity tracking ~line 140-145, shutdown ~line 167-176)

### Concept

The existing PR #143 code has four weaknesses that reduce its effectiveness:
1. Signal handler `.catch(() => process.exit(1))` exits silently without logging why shutdown failed
2. Keepalive only checks `!process.stdin.readable` which may never flip on abrupt parent death
3. `lastActivityTs` only tracks outbound messages, not inbound — long tool calls falsely trigger idle
4. `clearInterval(keepalive)` is missing from the shutdown function

- [ ] **Step 1: Fix signal handlers to log before exiting**

In `src/index.ts`, replace the signal handlers (on the PR branch):

```typescript
// Before (PR #143):
process.on("SIGINT", () => { shutdown("SIGINT").catch(() => process.exit(1)); });
process.on("SIGTERM", () => { shutdown("SIGTERM").catch(() => process.exit(1)); });

// After:
process.on("SIGINT", () => {
  shutdown("SIGINT").catch((err) => {
    logToFile("shutdown failed", { signal: "SIGINT", error: String(err) });
    process.exit(1);
  });
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((err) => {
    logToFile("shutdown failed", { signal: "SIGTERM", error: String(err) });
    process.exit(1);
  });
});
```

- [ ] **Step 2: Track inbound activity on stdin**

After the existing `lastActivityTs` and `transport.send` monkey-patch (~line 140-145), add:

```typescript
process.stdin.on("data", () => { lastActivityTs = Date.now(); });
```

- [ ] **Step 3: Improve keepalive detection condition**

Replace the keepalive check condition to also detect reparenting to init (PID 1 on Linux/macOS means parent died):

```typescript
// Before (PR #143):
if (idleMs > KEEPALIVE_TIMEOUT_MS && !process.stdin.readable) {

// After:
const parentGone = !process.stdin.readable || process.ppid === 1;
if (idleMs > KEEPALIVE_TIMEOUT_MS && parentGone) {
```

- [ ] **Step 4: Clear keepalive interval in shutdown**

Declare `let keepaliveTimer` before the shutdown function, assign it after, and clear in shutdown:

```typescript
// Before shutdown():
let keepaliveTimer: ReturnType<typeof setInterval> | undefined;

// Inside shutdown(), as the first line:
if (keepaliveTimer) clearInterval(keepaliveTimer);

// After shutdown(), where the interval is created:
keepaliveTimer = setInterval(() => {
  // ... existing keepalive logic ...
}, KEEPALIVE_CHECK_MS);
keepaliveTimer.unref();
```

- [ ] **Step 5: Verify build passes**

Run: `pnpm typecheck && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "fix: harden signal handlers, keepalive detection, and activity tracking

- Signal handlers now log the reason before exit on shutdown failure
- Track inbound stdin activity to prevent false idle triggers during long operations
- Keepalive also checks process.ppid === 1 (reparented to init = parent died)
- Clear keepalive interval during graceful shutdown"
```

---

## Task 2: Rejection Threshold Circuit Breaker

**Files:**
- Create: `src/utils/rejection-tracker.ts`
- Create: `tests/utils/rejection-tracker.test.ts`
- Modify: `src/index.ts:523-531` (the `unhandledRejection` handler)

### Concept

PR #143 stops crashing on every unhandled rejection in stdio mode — but swallowing them indefinitely masks bugs. A circuit breaker exits after N rejections in a rolling time window.

- [ ] **Step 1: Write the rejection-tracker module**

```typescript
// src/utils/rejection-tracker.ts
import { createLogger } from "./logger.js";

const log = createLogger("rejection-tracker");

export interface RejectionTrackerOptions {
  /** Max rejections allowed within the window before triggering exit. Default: 5 */
  threshold?: number;
  /** Rolling window in milliseconds. Default: 60_000 (1 minute) */
  windowMs?: number;
}

export class RejectionTracker {
  private readonly threshold: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];

  constructor(options: RejectionTrackerOptions = {}) {
    this.threshold = options.threshold ?? 5;
    this.windowMs = options.windowMs ?? 60_000;
  }

  /**
   * Record a rejection. Returns true if the threshold has been breached
   * (caller should exit).
   */
  record(): boolean {
    const now = Date.now();
    this.timestamps.push(now);

    // Evict entries outside the window
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);

    if (this.timestamps.length >= this.threshold) {
      log.error("Rejection threshold breached", {
        count: this.timestamps.length,
        threshold: this.threshold,
        windowMs: this.windowMs,
      });
      return true;
    }

    return false;
  }

  /** Current count of rejections within the window. */
  get count(): number {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
    return this.timestamps.length;
  }
}
```

- [ ] **Step 2: Write the test**

```typescript
// tests/utils/rejection-tracker.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RejectionTracker } from "../../src/utils/rejection-tracker.js";

describe("RejectionTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not breach threshold with fewer rejections", () => {
    const tracker = new RejectionTracker({ threshold: 3, windowMs: 10_000 });
    expect(tracker.record()).toBe(false);
    expect(tracker.record()).toBe(false);
    expect(tracker.count).toBe(2);
  });

  it("breaches threshold when count reached", () => {
    const tracker = new RejectionTracker({ threshold: 3, windowMs: 10_000 });
    tracker.record();
    tracker.record();
    expect(tracker.record()).toBe(true);
  });

  it("evicts old entries outside the window", () => {
    const tracker = new RejectionTracker({ threshold: 3, windowMs: 10_000 });
    tracker.record();
    tracker.record();

    vi.advanceTimersByTime(11_000);

    expect(tracker.record()).toBe(false);
    expect(tracker.record()).toBe(false);
    expect(tracker.record()).toBe(true);
  });

  it("uses default threshold of 5 and window of 60s", () => {
    const tracker = new RejectionTracker();
    for (let i = 0; i < 4; i++) {
      expect(tracker.record()).toBe(false);
    }
    expect(tracker.record()).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm test tests/utils/rejection-tracker.test.ts`

- [ ] **Step 4: Wire into unhandledRejection handler in index.ts**

Replace the `unhandledRejection` handler in `main()`:

```typescript
import { RejectionTracker } from "./utils/rejection-tracker.js";

// Inside main(), before the unhandledRejection handler:
const rejectionTracker = new RejectionTracker({ threshold: 5, windowMs: 60_000 });

process.on("unhandledRejection", (reason) => {
  const data = { error: String(reason), stack: (reason as Error)?.stack };
  log.error("Unhandled promise rejection", data);
  logToFile("unhandledRejection", data);
  if (transport !== "stdio") {
    process.exit(1);
  }
  if (rejectionTracker.record()) {
    log.error("Too many unhandled rejections — exiting to allow reconnect");
    logToFile("rejection threshold breached — exiting", { count: 5, windowMs: 60_000 });
    process.exit(1);
  }
});
```

- [ ] **Step 5: Verify build passes**

Run: `pnpm typecheck && pnpm build`

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`

- [ ] **Step 7: Commit**

```bash
git add src/utils/rejection-tracker.ts tests/utils/rejection-tracker.test.ts src/index.ts
git commit -m "fix: add rejection circuit breaker for stdio mode

Instead of swallowing all unhandled rejections indefinitely (which could
mask serious bugs), exit after 5 rejections within 60 seconds. This keeps
the server alive through transient errors but fails fast when something
is fundamentally broken."
```

---

## Task 3: Final Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Full build + typecheck**

Run: `pnpm typecheck && pnpm build`

- [ ] **Step 2: Full test suite**

Run: `pnpm test`

- [ ] **Step 3: Manual stdio smoke test**

Run: `echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}},"id":1}' | node build/index.js --transport stdio 2>/dev/null`

Expected: Valid JSON-RPC response on stdout with server capabilities.

---

## Implementation Notes

### What we're NOT doing (and why)

- **Stdout guard**: Speculative — no evidence a dependency is writing to stdout. Add later if disconnects persist.
- **Progress keepalives**: Complex (touches client + every tool file) and Claude Code's MCP timeout is generous. The real fix was stopping `process.exit(1)` on rejections.

### Integration with PR #143

All changes go on the same `fix/stdio-disconnect-stability` branch:
- Task 1 fixes weaknesses in PR #143's existing code
- Task 2 replaces the blanket rejection swallowing with a smarter circuit breaker
- Total: ~50 lines of new code, no new dependencies
