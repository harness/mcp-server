/**
 * Token-bucket rate limiter. Default: 10 requests/second.
 */

const MAX_WAIT_MS = 30_000;

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number = 10,
    private readonly refillRatePerMs: number = maxTokens / 1000,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      // Wait until a token is available
      const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    throw new Error(`Rate limiter: timed out waiting ${MAX_WAIT_MS}ms for a token`);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;
  }
}
