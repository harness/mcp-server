import type { PipelineExecutionView } from "../../../../src/apps/view-types.js";

export const REFRESH_INTERVAL_MS = 30_000;
export const LIVE_WINDOW_MS = 60 * 60_000;

export interface LiveRefreshOptions {
  /** Repeat the view's read-only refresh call; failures are ignored and retried on the next tick. */
  refresh: (view: PipelineExecutionView) => Promise<void>;
  onPausedChange: (paused: boolean) => void;
  intervalMs?: number;
  windowMs?: number;
  now?: () => number;
}

/**
 * Execution card refresh lifecycle: fetch a missing stage or step graph once, then
 * refresh every 30 seconds while the run is not terminal, pausing after an hour.
 */
export class LiveRefresh {
  private view: PipelineExecutionView | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private windowStart: number;
  private paused = false;
  private fetchedGraph = false;
  private readonly intervalMs: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(private readonly options: LiveRefreshOptions) {
    this.intervalMs = options.intervalMs ?? REFRESH_INTERVAL_MS;
    this.windowMs = options.windowMs ?? LIVE_WINDOW_MS;
    this.now = options.now ?? Date.now;
    this.windowStart = this.now();
  }

  update(view: PipelineExecutionView): void {
    this.view = view;
    if (!view.refresh) return this.stop();
    if (!this.fetchedGraph && (view.stages.length === 0 || view.steps_loaded === false)) {
      this.fetchedGraph = true;
      void this.tick();
    }
    if (view.terminal) {
      this.stop();
      this.setPaused(false);
    } else if (!this.paused) {
      this.start();
    }
  }

  /** After a manual refresh: restart the hour window and live updates. */
  resume(): void {
    this.windowStart = this.now();
    this.setPaused(false);
    if (this.view && !this.view.terminal && this.view.refresh) this.start();
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private start(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      if (this.now() - this.windowStart >= this.windowMs) {
        this.stop();
        this.setPaused(true);
        return;
      }
      void this.tick();
    }, this.intervalMs);
  }

  private async tick(): Promise<void> {
    if (!this.view?.refresh) return;
    try {
      await this.options.refresh(this.view);
    } catch {
      // The next tick retries.
    }
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.options.onPausedChange(paused);
  }
}
