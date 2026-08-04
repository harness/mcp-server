import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchImageContentBlock } from "../../src/utils/fetch-image-content.js";
import {
  collectKbScreenshotUrls,
  jsonResultWithKbScreenshots,
} from "../../src/utils/kb-screenshot-content.js";

describe("fetchImageContentBlock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a base64 image content block for a PNG response", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "image/png" : null) },
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      }),
    );

    const block = await fetchImageContentBlock("https://example.com/shot.png");
    expect(block).toEqual({
      type: "image",
      mimeType: "image/png",
      data: bytes.toString("base64"),
    });
  });

  it("returns undefined when the response is too large", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === "content-length" ? "99999999" : "image/png") },
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    );
    await expect(fetchImageContentBlock("https://example.com/big.png", { maxBytes: 1024 })).resolves.toBeUndefined();
  });

  it("returns undefined on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(fetchImageContentBlock("https://example.com/shot.png")).resolves.toBeUndefined();
  });
});

describe("collectKbScreenshotUrls", () => {
  it("collects signed_url from kb_page_artifact screenshots", () => {
    expect(
      collectKbScreenshotUrls("kb_page_artifact", {
        kind: "screenshot",
        signed_url: "https://storage.example/a.png",
      }),
    ).toEqual(["https://storage.example/a.png"]);
  });

  it("ignores non-screenshot artifacts", () => {
    expect(
      collectKbScreenshotUrls("kb_page_artifact", {
        kind: "accessibility",
        text: "{}",
      }),
    ).toEqual([]);
  });

  it("collects nested screenshot from kb_crawl_page included_artifacts", () => {
    expect(
      collectKbScreenshotUrls("kb_crawl_page", {
        page_id: "p1",
        included_artifacts: {
          screenshot: { kind: "screenshot", signed_url: "https://storage.example/b.png" },
        },
      }),
    ).toEqual(["https://storage.example/b.png"]);
  });
});

describe("jsonResultWithKbScreenshots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("appends an image content block when the signed URL is fetchable", async () => {
    const bytes = Buffer.from("png-bytes");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      }),
    );

    const payload = {
      kind: "screenshot",
      signed_url: "https://storage.example/c.png",
      expires_at: "2026-08-04T20:00:00.000Z",
    };
    const result = await jsonResultWithKbScreenshots("kb_page_artifact", payload);
    expect(result.structuredContent).toEqual(payload);
    expect(result.content[0]).toEqual({ type: "text", text: JSON.stringify(payload) });
    expect(result.content[1]).toEqual({
      type: "image",
      mimeType: "image/png",
      data: bytes.toString("base64"),
    });
  });

  it("still returns JSON when image fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const payload = { kind: "screenshot", signed_url: "https://storage.example/d.png" };
    const result = await jsonResultWithKbScreenshots("kb_page_artifact", payload);
    expect(result.content).toHaveLength(1);
    expect(result.structuredContent).toEqual(payload);
  });
});
