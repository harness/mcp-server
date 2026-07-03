import { describe, it, expect } from "vitest";
import { svgToPngBase64, validateSvgInput } from "../../../src/utils/svg/render-png.js";

const VALID_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';

describe("validateSvgInput", () => {
  it("rejects empty input", () => {
    expect(() => validateSvgInput("")).toThrow(/empty/i);
  });

  it("rejects non-SVG input", () => {
    expect(() => validateSvgInput("<div>not svg</div>")).toThrow(/missing <svg>/i);
  });

  it("rejects zero or negative dimensions", () => {
    expect(() => validateSvgInput('<svg width="0" height="10"></svg>')).toThrow(/invalid width/i);
    expect(() => validateSvgInput('<svg width="10" height="-1"></svg>')).toThrow(/invalid height/i);
  });

  it("allows SVG without explicit width/height", () => {
    expect(() => validateSvgInput('<svg viewBox="0 0 10 10"></svg>')).not.toThrow();
  });
});

describe("svgToPngBase64", () => {
  it("renders valid SVG to base64 PNG via child process", { timeout: 15_000 }, async () => {
    const base64 = await svgToPngBase64(VALID_SVG);
    const buf = Buffer.from(base64, "base64");
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });

  it("rejects with a catchable error for invalid SVG without crashing the caller", async () => {
    await expect(svgToPngBase64("")).rejects.toThrow(/empty/i);
  });
});
