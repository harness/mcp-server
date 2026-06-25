import { describe, it, expect } from "vitest";
import { crc32, deflateRawSync } from "node:zlib";
import { parseZipCsv } from "../../src/utils/zip-csv.js";
import { dashboardDataExtract } from "../../src/registry/extractors.js";

function writeUint16LE(buf: Buffer, offset: number, value: number): void {
  buf.writeUInt16LE(value, offset);
}

function writeUint32LE(buf: Buffer, offset: number, value: number): void {
  buf.writeUInt32LE(value, offset);
}

function createZip(
  entries: Array<{ name: string; content: string; compression?: "store" | "deflate" | number }>,
): ArrayBuffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf-8");
    const rawData = Buffer.from(entry.content, "utf-8");
    const compressionMethod =
      typeof entry.compression === "number"
        ? entry.compression
        : entry.compression === "deflate"
          ? 8
          : 0;
    const compressed = compressionMethod === 8 ? deflateRawSync(rawData) : rawData;
    const checksum = crc32(rawData) >>> 0;

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    writeUint32LE(localHeader, 0, 0x04034b50);
    writeUint16LE(localHeader, 4, 20); // version needed
    writeUint16LE(localHeader, 6, 0); // flags
    writeUint16LE(localHeader, 8, compressionMethod);
    writeUint16LE(localHeader, 10, 0); // mod time
    writeUint16LE(localHeader, 12, 0); // mod date
    writeUint32LE(localHeader, 14, checksum);
    writeUint32LE(localHeader, 18, compressed.length);
    writeUint32LE(localHeader, 22, rawData.length);
    writeUint16LE(localHeader, 26, nameBuf.length);
    writeUint16LE(localHeader, 28, 0); // extra length
    nameBuf.copy(localHeader, 30);

    const localOffset = offset;
    localParts.push(localHeader, compressed);
    offset += localHeader.length + compressed.length;

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    writeUint32LE(centralHeader, 0, 0x02014b50);
    writeUint16LE(centralHeader, 4, 20); // version made by
    writeUint16LE(centralHeader, 6, 20); // version needed
    writeUint16LE(centralHeader, 8, 0); // flags
    writeUint16LE(centralHeader, 10, compressionMethod);
    writeUint16LE(centralHeader, 12, 0); // mod time
    writeUint16LE(centralHeader, 14, 0); // mod date
    writeUint32LE(centralHeader, 16, checksum);
    writeUint32LE(centralHeader, 20, compressed.length);
    writeUint32LE(centralHeader, 24, rawData.length);
    writeUint16LE(centralHeader, 28, nameBuf.length);
    writeUint16LE(centralHeader, 30, 0); // extra length
    writeUint16LE(centralHeader, 32, 0); // comment length
    writeUint16LE(centralHeader, 34, 0); // disk number start
    writeUint32LE(centralHeader, 42, localOffset);
    nameBuf.copy(centralHeader, 46);
    centralParts.push(centralHeader);
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  writeUint32LE(eocd, 0, 0x06054b50);
  writeUint16LE(eocd, 4, 0); // disk number
  writeUint16LE(eocd, 6, 0); // central dir disk
  writeUint16LE(eocd, 8, entries.length);
  writeUint16LE(eocd, 10, entries.length);
  writeUint32LE(eocd, 12, centralDir.length);
  writeUint32LE(eocd, 16, offset);
  writeUint16LE(eocd, 20, 0); // comment length
  const zipBuffer = Buffer.concat([...localParts, centralDir, eocd]);
  return zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength);
}

describe("parseZipCsv", () => {
  it("parses store-compressed CSV tables from a ZIP buffer", () => {
    const zip = createZip([
      {
        name: "deployments.csv",
        content: "service,count\napi,12\nweb,8\n",
      },
      {
        name: "notes.txt",
        content: "ignored non-csv entry",
      },
    ]);

    expect(parseZipCsv(zip)).toEqual({
      tables: {
        deployments: [
          { service: "api", count: "12" },
          { service: "web", count: "8" },
        ],
      },
    });
  });

  it("parses deflate-compressed CSV tables", () => {
    const zip = createZip([
      {
        name: "metrics.csv",
        content: "metric,value\nlatency_ms,42\n",
        compression: "deflate",
      },
    ]);

    expect(parseZipCsv(zip)).toEqual({
      tables: {
        metrics: [{ metric: "latency_ms", value: "42" }],
      },
    });
  });

  it("returns empty tables for ZIPs with no CSV entries", () => {
    const zip = createZip([{ name: "readme.txt", content: "no tables here" }]);
    expect(parseZipCsv(zip)).toEqual({ tables: {} });
  });

  it("parses nested path table names and strips outer quotes from simple CSV fields", () => {
    const zip = createZip([
      {
        name: "folder/summary.csv",
        content: '"service","count"\n"api","12"\n',
      },
    ]);

    expect(parseZipCsv(zip)).toEqual({
      tables: {
        "folder/summary": [{ service: "api", count: "12" }],
      },
    });
  });

  it("returns empty rows for CSV files with only a header line", () => {
    const zip = createZip([{ name: "empty.csv", content: "only,header\n" }]);
    expect(parseZipCsv(zip)).toEqual({ tables: { empty: [] } });
  });

  it("skips zero-byte CSV entries", () => {
    const zip = createZip([
      { name: "empty.csv", content: "" },
      { name: "data.csv", content: "k,v\na,1\n" },
    ]);
    expect(parseZipCsv(zip)).toEqual({
      tables: { data: [{ k: "a", v: "1" }] },
    });
  });

  it("throws for unsupported compression methods", () => {
    const zip = createZip([{ name: "bad.csv", content: "a,b\n1,2\n", compression: 1 }]);
    expect(() => parseZipCsv(zip)).toThrow(/Unsupported compression method: 1/);
  });
});

describe("dashboardDataExtract", () => {
  it("delegates ArrayBuffer responses to parseZipCsv", () => {
    const zip = createZip([
      {
        name: "summary.csv",
        content: "status,total\nsuccess,5\n",
      },
    ]);

    expect(dashboardDataExtract(zip)).toEqual({
      tables: {
        summary: [{ status: "success", total: "5" }],
      },
    });
  });

  it("passes through non-buffer responses unchanged", () => {
    const raw = { status: "ERROR", message: "not ready" };
    expect(dashboardDataExtract(raw)).toBe(raw);
  });
});
