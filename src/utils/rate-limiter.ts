/**
 * Token-bucket rate limiter. Default: 10 requests/second.
 */
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
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      // Wait until a token is available
      const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;
  }
}
