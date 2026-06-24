/**
 * Unit tests for parseZipCsv and dashboardDataExtract — the hand-rolled ZIP+CSV
 * parser used by dashboard data downloads.
 */
import { describe, it, expect } from "vitest";
import { parseZipCsv } from "../../src/utils/zip-csv.js";
import { dashboardDataExtract } from "../../src/registry/extractors.js";

// Minimal valid ZIP fixtures (generated with Python zipfile — store + deflate).
const STORE_ZIP_B64 = "UEsDBBQAAAAAAOiM2FxUbyffFwAAABcAAAALAAAAbWV0cmljcy5jc3ZuYW1lLHZhbHVlCmZvbywxCmJhciwyClBLAQIUAxQAAAAAAOiM2FxUbyffFwAAABcAAAALAAAAAAAAAAAAAACAAQAAAABtZXRyaWNzLmNzdlBLBQYAAAAAAQABADkAAABAAAAAAAA=";
const DEFLATE_ZIP_B64 = "UEsDBBQAAAAIAOiM2FwUGITxFAAAABIAAAALAAAAc3VtbWFyeS5jc3bLTNEpLkksKS3mSjXUKUgsLuYCAFBLAQIUAxQAAAAIAOiM2FwUGITxFAAAABIAAAALAAAAAAAAAAAAAACAAQAAAABzdW1tYXJ5LmNzdlBLBQYAAAAAAQABADkAAAA9AAAAAAA=";

function zipFromBase64(b64: string): ArrayBuffer {
  const buf = Buffer.from(b64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("parseZipCsv", () => {
  it("parses a store-compressed ZIP with one CSV table", () => {
    const result = parseZipCsv(zipFromBase64(STORE_ZIP_B64));
    expect(result.tables.metrics).toEqual([
      { name: "foo", value: "1" },
      { name: "bar", value: "2" },
    ]);
  });

  it("parses a deflate-compressed ZIP with one CSV table", () => {
    const result = parseZipCsv(zipFromBase64(DEFLATE_ZIP_B64));
    expect(result.tables.summary).toEqual([
      { id: "e1", status: "pass" },
    ]);
  });
});

describe("dashboardDataExtract", () => {
  it("delegates ArrayBuffer responses to parseZipCsv", () => {
    const buffer = zipFromBase64(STORE_ZIP_B64);
    const result = dashboardDataExtract(buffer) as { tables: Record<string, unknown[]> };
    expect(result.tables.metrics).toHaveLength(2);
  });

  it("passes through non-ArrayBuffer responses unchanged", () => {
    const raw = { already: "parsed" };
    expect(dashboardDataExtract(raw)).toBe(raw);
  });
});
