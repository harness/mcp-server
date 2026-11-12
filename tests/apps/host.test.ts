import { describe, it, expect, vi } from "vitest";
import { HostConnection, readView } from "../../apps/harness-app/src/host.js";
import type { HarnessView } from "../../src/apps/view-types.js";

const REFRESH = { tool: "harness_get", arguments: { resource_type: "pipeline", resource_id: "build_app" } };
const view = (title: string): HarnessView => ({ kind: "result", title, refresh: REFRESH });
const result = (v?: HarnessView, isError?: boolean) => ({
  content: [{ type: "text", text: "{}" }],
  ...(isError ? { isError } : {}),
  ...(v ? { _meta: { "harness.io/view": v } } : {}),
});

function connection(callResult: unknown) {
  const host = new HostConnection();
  const callServerTool = vi.fn().mockResolvedValue(callResult);
  host.app.callServerTool = callServerTool as never;
  const seen: Array<HarnessView | undefined> = [];
  host.subscribe((v) => seen.push(v));
  host.setView(view("Before"));
  return { host, callServerTool, seen };
}

describe("view refresh", () => {
  it("repeats the server-named tool call and replaces the displayed view", async () => {
    const { host, callServerTool, seen } = connection(result(view("After")));

    await host.refresh(REFRESH);

    expect(callServerTool).toHaveBeenCalledWith({ name: "harness_get", arguments: REFRESH.arguments });
    expect(host.current()).toMatchObject({ title: "After" });
    expect(seen.map((v) => v && "title" in v ? v.title : undefined)).toEqual(["Before", "After"]);
  });

  it("keeps the current view when the refreshed result has no view data", async () => {
    const { host, seen } = connection(result());
    await host.refresh(REFRESH);
    expect(host.current()).toMatchObject({ title: "Before" });
    expect(seen).toHaveLength(1);
  });

  it("rejects and keeps the current view when the tool call fails", async () => {
    const { host } = connection(result(view("Ignored"), true));
    await expect(host.refresh(REFRESH)).rejects.toThrow("Refresh failed");
    expect(host.current()).toMatchObject({ title: "Before" });
  });
});

describe("readView", () => {
  it("reads harness.io/view from successful results only", () => {
    expect(readView(result(view("A")))).toMatchObject({ kind: "result", title: "A" });
    expect(readView(result(view("A"), true))).toBeUndefined();
    expect(readView({ _meta: { "harness.io/view": { title: "no kind" } } })).toBeUndefined();
    expect(readView(undefined)).toBeUndefined();
  });
});
