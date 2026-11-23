/**
 * cost_breakdown / cost_timeseries need a perspective_id (GraphQL `viewId: String!`).
 * Without it harness_search (all-types scatter-gather) sent an empty viewId and
 * nextgen-ce rejected every call. They must declare it required so search skips them
 * and a direct list fails locally.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";

const CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
} as const;

const PERSPECTIVE_TYPES = ["cost_breakdown", "cost_timeseries"] as const;

describe("CCM perspective-scoped list types", () => {
  const registry = new Registry(CONFIG);

  it.each(PERSPECTIVE_TYPES)("%s declares perspective_id as a required list filter", (rt) => {
    const field = registry.getResource(rt).listFilterFields?.find((f) => f.name === "perspective_id");
    expect(field?.required).toBe(true);
  });

  it("harness_search's default candidate filter excludes them", () => {
    const candidates = registry.getAllResourceTypes().filter(
      (rt) =>
        registry.supportsOperation(rt, "list") &&
        !registry.getResource(rt).listFilterFields?.some((f) => f.required),
    );
    for (const rt of PERSPECTIVE_TYPES) expect(candidates).not.toContain(rt);
  });

  it.each(PERSPECTIVE_TYPES)("%s list without perspective_id fails locally, no HTTP call", async (rt) => {
    const request = vi.fn();
    const client = { request, account: "testaccount" } as never;
    await expect(registry.dispatch(client, rt, "list", {})).rejects.toThrow(/perspective_id/);
    expect(request).not.toHaveBeenCalled();
  });
});
