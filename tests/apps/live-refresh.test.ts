import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_WINDOW_MS, LiveRefresh, REFRESH_INTERVAL_MS } from "../../apps/harness-app/src/views/live-refresh.js";
import type { PipelineExecutionView } from "../../src/apps/view-types.js";

const REFRESH = { tool: "harness_get", arguments: { resource_type: "execution", resource_id: "e1" } };
const view = (over: Partial<PipelineExecutionView> = {}): PipelineExecutionView => ({
  kind: "pipeline_execution",
  execution_id: "e1",
  pipeline: { name: "Build" },
  scope: {},
  status: { label: "Running", tone: "info", live: true },
  terminal: false,
  steps_loaded: true,
  stages: [{ id: "build", name: "Build", status: { label: "Running", tone: "info", live: true } }],
  refresh: REFRESH,
  ...over,
});

function controller() {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const paused: boolean[] = [];
  const live = new LiveRefresh({ refresh, onPausedChange: (p) => paused.push(p) });
  return { live, refresh, paused };
}

describe("execution card live refresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("refreshes every 30 seconds while the run is not terminal", () => {
    const { live, refresh } = controller();
    live.update(view());
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("stops once a refreshed view is terminal", () => {
    const { live, refresh } = controller();
    live.update(view());
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    live.update(view({ terminal: true, status: { label: "Succeeded", tone: "success" } }));
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 5);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("never polls a terminal view", () => {
    const { live, refresh } = controller();
    live.update(view({ terminal: true }));
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 5);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("pauses after an hour and resumes after a manual refresh", () => {
    const { live, refresh, paused } = controller();
    live.update(view());
    vi.advanceTimersByTime(LIVE_WINDOW_MS + REFRESH_INTERVAL_MS);
    const calls = refresh.mock.calls.length;
    expect(paused).toEqual([true]);
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(calls);

    live.resume();
    expect(paused).toEqual([true, false]);
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(calls + 1);
  });

  it("fetches a missing step graph once, immediately, even for a terminal run", () => {
    const { live, refresh } = controller();
    live.update(view({ terminal: true, steps_loaded: false }));
    expect(refresh).toHaveBeenCalledTimes(1);
    live.update(view({ terminal: true, steps_loaded: false }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps polling after a failed refresh", async () => {
    const { live, refresh } = controller();
    refresh.mockRejectedValueOnce(new Error("network"));
    live.update(view());
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS * 2);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("stops on teardown", () => {
    const { live, refresh } = controller();
    live.update(view());
    live.stop();
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 3);
    expect(refresh).not.toHaveBeenCalled();
  });
});
