import { createLogger } from "./logger.js";

const log = createLogger("rejection-tracker");

export interface RejectionTrackerOptions {
  threshold?: number;
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

  record(): boolean {
    const now = Date.now();
    this.timestamps.push(now);

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

  get count(): number {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
    return this.timestamps.length;
  }
}
