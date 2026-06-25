import { describe, it, expect, vi } from "vitest";
import { sendProgress, sendLog } from "../../src/utils/progress.js";

function makeExtra(overrides: {
  progressToken?: string | number;
  sendNotification?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    _meta: overrides.progressToken !== undefined ? { progressToken: overrides.progressToken } : {},
    sendNotification: overrides.sendNotification ?? vi.fn().mockResolvedValue(undefined),
  } as Parameters<typeof sendProgress>[0];
}

describe("sendProgress", () => {
  it("no-ops when progressToken is absent", async () => {
    const sendNotification = vi.fn();
    await sendProgress(makeExtra({ sendNotification }), 1, 10, "working");

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends notifications/progress with token, counts, and message", async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    await sendProgress(makeExtra({ progressToken: "tok-1", sendNotification }), 3, 10, "step 3");

    expect(sendNotification).toHaveBeenCalledWith({
      method: "notifications/progress",
      params: { progressToken: "tok-1", progress: 3, total: 10, message: "step 3" },
    });
  });

  it("allows undefined total", async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    await sendProgress(makeExtra({ progressToken: 42, sendNotification }), 7, undefined);

    expect(sendNotification).toHaveBeenCalledWith({
      method: "notifications/progress",
      params: { progressToken: 42, progress: 7, total: undefined, message: undefined },
    });
  });

  it("swallows notification failures without throwing", async () => {
    const sendNotification = vi.fn().mockRejectedValue(new Error("client disconnected"));
    await expect(sendProgress(makeExtra({ progressToken: "tok", sendNotification }), 1, 1)).resolves.toBeUndefined();
  });
});

describe("sendLog", () => {
  it("sends notifications/message with level, logger, and data", async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    await sendLog(makeExtra({ sendNotification }), "warning", "harness_search", "slow query");

    expect(sendNotification).toHaveBeenCalledWith({
      method: "notifications/message",
      params: { level: "warning", logger: "harness_search", data: "slow query" },
    });
  });

  it("swallows notification failures without throwing", async () => {
    const sendNotification = vi.fn().mockRejectedValue(new Error("unsupported"));
    await expect(sendLog(makeExtra({ sendNotification }), "info", "diag", "note")).resolves.toBeUndefined();
  });
});
