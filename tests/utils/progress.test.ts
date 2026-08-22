import { describe, it, expect, vi } from "vitest";
import { sendProgress, sendLog } from "../../src/utils/progress.js";

function makeExtra(overrides: {
  progressToken?: string;
  sendNotification?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    _meta: overrides.progressToken !== undefined ? { progressToken: overrides.progressToken } : {},
    sendNotification: overrides.sendNotification ?? vi.fn().mockResolvedValue(undefined),
  } as never;
}

describe("sendProgress", () => {
  it("is a no-op when progressToken is absent", async () => {
    const sendNotification = vi.fn();
    await sendProgress(makeExtra({ sendNotification }), 1, 3, "step");
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("emits notifications/progress when progressToken is present", async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    await sendProgress(makeExtra({ progressToken: "tok-1", sendNotification }), 2, 5, "fetching logs");
    expect(sendNotification).toHaveBeenCalledWith({
      method: "notifications/progress",
      params: { progressToken: "tok-1", progress: 2, total: 5, message: "fetching logs" },
    });
  });

  it("swallows notification failures without throwing", async () => {
    const sendNotification = vi.fn().mockRejectedValue(new Error("client disconnected"));
    await expect(
      sendProgress(makeExtra({ progressToken: "tok-1", sendNotification }), 1, 1),
    ).resolves.toBeUndefined();
  });
});

describe("sendLog", () => {
  it("emits notifications/message with level, logger, and data", async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    await sendLog(makeExtra({ sendNotification }), "info", "harness-diagnose", "fetching step logs");
    expect(sendNotification).toHaveBeenCalledWith({
      method: "notifications/message",
      params: { level: "info", logger: "harness-diagnose", data: "fetching step logs" },
    });
  });

  it("swallows notification failures without throwing", async () => {
    const sendNotification = vi.fn().mockRejectedValue(new Error("unsupported"));
    await expect(
      sendLog(makeExtra({ sendNotification }), "warning", "harness-status", "retrying"),
    ).resolves.toBeUndefined();
  });
});
