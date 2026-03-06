import { describe, it, expect } from "vitest";
import { RateLimiter } from "../../src/utils/rate-limiter.js";

describe("RateLimiter", () => {
  it("allows burst up to max tokens", async () => {
    const limiter = new RateLimiter(5);
    const start = Date.now();

    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    // All 5 should complete nearly instantly (< 50ms)
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("throttles after burst is exhausted", async () => {
    const limiter = new RateLimiter(2);

    // Exhaust the burst
    await limiter.acquire();
    await limiter.acquire();

    const start = Date.now();
    await limiter.acquire(); // should wait for refill
    const elapsed = Date.now() - start;

    // At 2 tokens/sec, refill 1 token takes ~500ms. Allow some tolerance.
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it("refills tokens over time", async () => {
    const limiter = new RateLimiter(3);

    // Exhaust burst
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    // Wait for partial refill
    await new Promise((r) => setTimeout(r, 400));

    // Should be able to acquire at least one token now
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeLessThan(100);
  });
});
