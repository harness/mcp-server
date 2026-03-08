import { describe, it, expect } from "vitest";
import { delegateHandler } from "../../../src/tools/diagnose/delegate.js";
import { makeContext } from "./helpers.js";

function healthyDelegate(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    type: "KUBERNETES",
    connected: true,
    lastHeartBeat: Date.now() - 30_000,
    delegateReplicas: [{ uuid: "r1", lastHeartbeat: Date.now(), version: "1.0.0" }],
    autoUpgrade: "ON",
    legacy: false,
    ...overrides,
  };
}

describe("delegateHandler", () => {
  it("returns note when no delegates found", async () => {
    const ctx = makeContext({
      dispatchMap: { delegate: { list: [] } },
    });

    const result = await delegateHandler.diagnose(ctx);

    expect(result.total_delegates).toBe(0);
    expect(result.note).toContain("No delegates");
  });

  it("reports all healthy delegates", async () => {
    const ctx = makeContext({
      dispatchMap: {
        delegate: { list: [healthyDelegate("d1"), healthyDelegate("d2")] },
      },
    });

    const result = await delegateHandler.diagnose(ctx);

    expect(result.total_delegates).toBe(2);
    expect(result.healthy_count).toBe(2);
    expect(result.unhealthy_count).toBe(0);
    const delegates = result.delegates as Array<Record<string, unknown>>;
    expect(delegates).toHaveLength(2);
    expect(delegates.every((d) => d.healthy === true)).toBe(true);
  });

  it("flags disconnected delegate", async () => {
    const ctx = makeContext({
      dispatchMap: {
        delegate: { list: [healthyDelegate("disc", { connected: false })] },
      },
    });

    const result = await delegateHandler.diagnose(ctx);
    const delegates = result.delegates as Array<Record<string, unknown>>;
    const issues = delegates[0].issues as string[];

    expect(result.unhealthy_count).toBe(1);
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("not actively connected")]));
  });

  it("flags stale heartbeat", async () => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const ctx = makeContext({
      dispatchMap: {
        delegate: { list: [healthyDelegate("stale", { lastHeartBeat: tenMinutesAgo })] },
      },
    });

    const result = await delegateHandler.diagnose(ctx);
    const delegates = result.delegates as Array<Record<string, unknown>>;
    const issues = delegates[0].issues as string[];

    expect(issues).toEqual(expect.arrayContaining([expect.stringMatching(/minutes ago.*stale/)]));
  });

  it("flags expiring replicas", async () => {
    const threeDaysFromNow = Date.now() + 3 * 24 * 60 * 60 * 1000;
    const ctx = makeContext({
      dispatchMap: {
        delegate: {
          list: [
            healthyDelegate("expiring", {
              delegateReplicas: [
                { uuid: "r1", version: "1.0.0", expiringAt: threeDaysFromNow },
              ],
            }),
          ],
        },
      },
    });

    const result = await delegateHandler.diagnose(ctx);
    const delegates = result.delegates as Array<Record<string, unknown>>;
    const issues = delegates[0].issues as string[];

    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("expiring within 7 days")]));
  });

  it("flags legacy delegate", async () => {
    const ctx = makeContext({
      dispatchMap: {
        delegate: { list: [healthyDelegate("old", { legacy: true })] },
      },
    });

    const result = await delegateHandler.diagnose(ctx);
    const delegates = result.delegates as Array<Record<string, unknown>>;
    const issues = delegates[0].issues as string[];

    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("legacy mode")]));
  });

  it("filters to specific delegate by resource_id", async () => {
    const ctx = makeContext({
      input: { resource_id: "d2" },
      dispatchMap: {
        delegate: { list: [healthyDelegate("d1"), healthyDelegate("d2"), healthyDelegate("d3")] },
      },
    });

    const result = await delegateHandler.diagnose(ctx);

    expect(result.total_delegates).toBe(1);
    const delegates = result.delegates as Array<Record<string, unknown>>;
    expect(delegates[0].name).toBe("d2");
  });

  it("throws when resource_id delegate not found", async () => {
    const ctx = makeContext({
      input: { resource_id: "nonexistent" },
      dispatchMap: {
        delegate: { list: [healthyDelegate("d1"), healthyDelegate("d2")] },
      },
    });

    await expect(delegateHandler.diagnose(ctx)).rejects.toThrow("not found");
  });

  it("returns compact summary for large delegate lists", async () => {
    const delegates = Array.from({ length: 8 }, (_, i) => healthyDelegate(`d${i}`));
    delegates[0] = healthyDelegate("d0", { connected: false });

    const ctx = makeContext({
      dispatchMap: { delegate: { list: delegates } },
    });

    const result = await delegateHandler.diagnose(ctx);

    expect(result.total_delegates).toBe(8);
    expect(result.delegates).toBeUndefined();
    expect(result.all_delegates).toBeDefined();
    expect(result.unhealthy_delegates).toBeDefined();
    const compact = result.all_delegates as Array<Record<string, unknown>>;
    expect(compact).toHaveLength(8);
    expect(compact[0]).toHaveProperty("name");
    expect(compact[0]).not.toHaveProperty("issues");
  });

  it("handles non-array response gracefully", async () => {
    const ctx = makeContext({
      dispatchMap: { delegate: { list: { unexpected: true } } },
    });

    const result = await delegateHandler.diagnose(ctx);

    expect(result.total_delegates).toBe(0);
    expect(result.note).toContain("No delegates");
  });
});
