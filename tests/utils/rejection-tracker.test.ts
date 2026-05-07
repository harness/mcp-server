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
