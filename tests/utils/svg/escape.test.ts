import { describe, it, expect } from "vitest";
import { escapeXml, truncateLabel } from "../../../src/utils/svg/escape.js";

describe("escapeXml", () => {
  it("escapes all XML special characters", () => {
    expect(escapeXml('a & b < c > d "e" \'f\'')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;",
    );
  });

  it("returns plain strings unchanged", () => {
    expect(escapeXml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });

  it("escapes pipeline names with special chars", () => {
    expect(escapeXml("deploy <prod> & staging")).toBe(
      "deploy &lt;prod&gt; &amp; staging",
    );
  });
});

describe("truncateLabel", () => {
  it("returns short strings as-is", () => {
    expect(truncateLabel("hello", 10)).toBe("hello");
  });

  it("truncates with ellipsis at maxLen", () => {
    const result = truncateLabel("abcdefghij", 6);
    expect(result).toBe("abcde\u2026");
    expect(result.length).toBe(6);
  });

  it("returns exact-length strings unchanged", () => {
    expect(truncateLabel("abcde", 5)).toBe("abcde");
  });

  it("handles single character maxLen", () => {
    expect(truncateLabel("abcde", 1)).toBe("\u2026");
  });
});
