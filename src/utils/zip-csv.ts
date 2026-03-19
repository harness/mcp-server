/**
 * Minimal ZIP+CSV parser for Harness dashboard data downloads.
 * Parses a ZIP ArrayBuffer containing CSV files into structured JSON tables.
 * No external dependencies — uses only built-in Node.js APIs.
 *
 * Uses the Central Directory (at end of ZIP) for reliable size info,
 * handling ZIPs that use data descriptors (bit 3 flag).
 */
import { inflateRawSync } from "node:zlib";

function readUint16LE(buf: Buffer, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

function readUint32LE(buf: Buffer, offset: number): number {
  return (buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16) | (buf[offset + 3]! << 24)) >>> 0;
}

interface CentralDirEntry {
  filename: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function findCentralDirectory(buf: Buffer): CentralDirEntry[] {
  // Find End of Central Directory record (scan backwards for signature 0x06054b50)
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (readUint32LE(buf, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return [];

  const cdOffset = readUint32LE(buf, eocdOffset + 16);
  const cdEntries = readUint16LE(buf, eocdOffset + 10);
  const entries: CentralDirEntry[] = [];
  let pos = cdOffset;

  for (let i = 0; i < cdEntries && pos < eocdOffset; i++) {
    if (readUint32LE(buf, pos) !== 0x02014b50) break; // Central directory file header signature

    const compressionMethod = readUint16LE(buf, pos + 10);
    const compressedSize = readUint32LE(buf, pos + 20);
    const uncompressedSize = readUint32LE(buf, pos + 24);
    const filenameLen = readUint16LE(buf, pos + 28);
    const extraLen = readUint16LE(buf, pos + 30);
    const commentLen = readUint16LE(buf, pos + 32);
    const localHeaderOffset = readUint32LE(buf, pos + 42);
    const filename = buf.subarray(pos + 46, pos + 46 + filenameLen).toString("utf-8");

    entries.push({ filename, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    pos += 46 + filenameLen + extraLen + commentLen;
  }

  return entries;
}

function extractFileData(buf: Buffer, entry: CentralDirEntry): Buffer {
  const offset = entry.localHeaderOffset;
  if (readUint32LE(buf, offset) !== 0x04034b50) {
    throw new Error(`Invalid local file header at offset ${offset}`);
  }
  const filenameLen = readUint16LE(buf, offset + 26);
  const extraLen = readUint16LE(buf, offset + 28);
  const dataStart = offset + 30 + filenameLen + extraLen;
  const rawData = buf.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return Buffer.from(rawData);
  } else if (entry.compressionMethod === 8) {
    return inflateRawSync(rawData);
  }
  throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a ZIP ArrayBuffer containing CSV files into a structured object.
 * Returns `{ tables: { "TableName": [ {col: val, ...}, ... ], ... } }`.
 */
export function parseZipCsv(buffer: ArrayBuffer): { tables: Record<string, Record<string, string>[]> } {
  const buf = Buffer.from(buffer);
  const entries = findCentralDirectory(buf);
  const tables: Record<string, Record<string, string>[]> = {};

  for (const entry of entries) {
    if (!entry.filename.endsWith(".csv") || entry.filename.endsWith("/")) continue;
    if (entry.uncompressedSize === 0) continue;

    const data = extractFileData(buf, entry);
    const tableName = entry.filename.replace(/\.csv$/, "");
    tables[tableName] = parseCSV(data.toString("utf-8"));
  }

  return { tables };
}
