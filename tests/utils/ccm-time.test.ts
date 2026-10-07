import { describe, it, expect } from "vitest";
import { parseTimeInput, parseCustomWindow, toUtcDateString } from "../../src/utils/ccm-time.js";

const SEP_28 = 1790553600000; // 2026-09-28T00:00:00Z
const DAY = 86_400_000;

describe("parseTimeInput", () => {
  it("returns undefined for null/undefined/empty", () => {
    expect(parseTimeInput(undefined, "start_time")).toBeUndefined();
    expect(parseTimeInput(null, "start_time")).toBeUndefined();
    expect(parseTimeInput("", "start_time")).toBeUndefined();
  });

  it("parses YYYY-MM-DD as UTC midnight for a start", () => {
    expect(parseTimeInput("2026-09-28", "start_time")).toBe(SEP_28);
  });

  it("parses date-only end as inclusive end of that UTC day", () => {
    expect(parseTimeInput("2026-09-29", "end_time", { endOfDay: true })).toBe(SEP_28 + 2 * DAY - 1);
  });

  it("passes epoch ms (number and numeric string) through", () => {
    expect(parseTimeInput(SEP_28, "start_time")).toBe(SEP_28);
    expect(parseTimeInput(String(SEP_28), "start_time")).toBe(SEP_28);
    expect(parseTimeInput(`  ${SEP_28}  `, "start_time")).toBe(SEP_28);
  });

  it("treats 10-digit epoch values as seconds", () => {
    expect(parseTimeInput(SEP_28 / 1000, "start_time")).toBe(SEP_28);
  });

  it("uses full ISO datetimes exactly as given (no end-of-day expansion)", () => {
    expect(parseTimeInput("2026-09-28T00:00:00Z", "end_time", { endOfDay: true })).toBe(SEP_28);
  });

  it("treats zone-less datetimes as UTC regardless of server timezone", () => {
    expect(parseTimeInput("2026-09-28T00:00", "start_time")).toBe(SEP_28);
    expect(parseTimeInput("2026-09-28 00:00:00", "start_time")).toBe(SEP_28);
    expect(parseTimeInput("2026-09-28T05:30:00+05:30", "start_time")).toBe(SEP_28);
  });

  it("rejects datetimes with trailing junk or out-of-range parts", () => {
    expect(() => parseTimeInput("2026-09-28T10:00 garbage", "start_time")).toThrow(/Invalid start_time/);
    expect(() => parseTimeInput("2026-09-28T25:00:00Z", "start_time")).toThrow(/Invalid start_time/);
  });

  it("throws on invalid input instead of dropping it", () => {
    expect(() => parseTimeInput("sept 28", "start_time")).toThrow(/Invalid start_time/);
    expect(() => parseTimeInput("2026-02-31", "start_time")).toThrow(/Invalid start_time/);
    expect(() => parseTimeInput("20260928", "start_time")).toThrow(/Invalid start_time/);
    expect(() => parseTimeInput(-5, "start_time")).toThrow(/Invalid start_time/);
    expect(() => parseTimeInput({}, "end_time")).toThrow(/Invalid end_time/);
  });
});

describe("parseCustomWindow", () => {
  it("returns empty when neither bound is set", () => {
    expect(parseCustomWindow({})).toEqual({ startMs: undefined, endMs: undefined });
  });

  it("regression CCM-37122: date strings produce the requested window, not a fallback", () => {
    expect(parseCustomWindow({ start_time: "2026-09-26", end_time: "2026-09-30" })).toEqual({
      startMs: SEP_28 - 2 * DAY,
      endMs: SEP_28 + 3 * DAY - 1,
    });
  });

  it("requires both bounds", () => {
    expect(() => parseCustomWindow({ start_time: "2026-09-28" })).toThrow(/together/);
    expect(() => parseCustomWindow({ end_time: "2026-09-28" })).toThrow(/together/);
  });

  it("rejects start after end", () => {
    expect(() => parseCustomWindow({ start_time: "2026-09-30", end_time: "2026-09-28" })).toThrow(/must not be after/);
  });

  it("supports a single-day window", () => {
    expect(parseCustomWindow({ start_time: "2026-09-29", end_time: "2026-09-29" })).toEqual({
      startMs: SEP_28 + DAY,
      endMs: SEP_28 + 2 * DAY - 1,
    });
  });
});

describe("toUtcDateString", () => {
  it("maps CCM daily bucket epochs to the right UTC date", () => {
    expect(toUtcDateString(1790553600000)).toBe("2026-09-28");
    expect(toUtcDateString(1790640000000)).toBe("2026-09-29");
    expect(toUtcDateString(1790726400000)).toBe("2026-09-30");
  });
});
