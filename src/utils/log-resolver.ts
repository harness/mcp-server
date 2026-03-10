import { gunzipSync } from "node:zlib";
import type { HarnessClient } from "../client/harness-client.js";
import { createLogger } from "./logger.js";

const log = createLogger("log-resolver");

const DEFAULT_POLL_ATTEMPTS = 3;
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_MAX_LOG_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 30_000;

export interface LogResolveOptions {
  signal?: AbortSignal;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
  maxLogSizeBytes?: number;
}

interface BlobResponse {
  link?: string;
  status?: string;
}

// ─── ANSI / log parsing helpers ─────────────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/**
 * Parse Harness JSON log lines into human-readable text.
 * Each line may be `{"level":"INFO","time":"...","out":"actual text"}`.
 * Non-JSON lines are passed through as-is.
 */
function parseLogLines(raw: string): string {
  const lines = raw.split("\n");
  const parsed: { time: string; text: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("{")) {
      try {
        const entry = JSON.parse(trimmed) as Record<string, unknown>;
        const out = String(entry.out ?? entry.message ?? entry.msg ?? "");
        const time = String(entry.time ?? entry.timestamp ?? entry.ts ?? "");
        const level = String(entry.level ?? "");
        const prefix = time ? `[${time}]${level ? ` ${level.toLowerCase()}:` : ""}` : "";
        parsed.push({ time, text: stripAnsi(`${prefix} ${out}`.trim()) });
      } catch {
        parsed.push({ time: "", text: stripAnsi(trimmed) });
      }
    } else {
      parsed.push({ time: "", text: stripAnsi(trimmed) });
    }
  }

  // Sort by timestamp if available
  parsed.sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : 0));

  return parsed.map((p) => p.text).join("\n");
}

// ─── ZIP extraction (minimal reader) ────────────────────────────────────────

const ZIP_MAGIC = 0x04034b50; // PK\x03\x04
const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

interface ZipEntry {
  fileName: string;
  data: Buffer;
}

/**
 * Minimal ZIP reader — extracts all files from a ZIP archive.
 * Only supports DEFLATE (method 8) and STORED (method 0) entries.
 */
function extractZipEntries(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== ZIP_MAGIC) break;

    const method = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const uncompressedSize = buf.readUInt32LE(offset + 22);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const fileName = buf.subarray(offset + 30, offset + 30 + nameLen).toString("utf-8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const compressedData = buf.subarray(dataStart, dataStart + compressedSize);

    let fileData: Buffer;
    if (method === 0) {
      // STORED
      fileData = compressedData;
    } else if (method === 8) {
      // DEFLATE — use inflateRaw
      const { inflateRawSync } = require("node:zlib") as typeof import("node:zlib");
      fileData = inflateRawSync(compressedData, { maxOutputLength: uncompressedSize || undefined });
    } else {
      log.warn("Unsupported ZIP compression method", { method, fileName });
      offset = dataStart + compressedSize;
      continue;
    }

    entries.push({ fileName, data: fileData });
    offset = dataStart + compressedSize;
  }

  return entries;
}

/**
 * Decompress a downloaded blob — handles gzip, zip, or plain text.
 */
function decompressBlob(buf: Buffer): string {
  if (buf.length === 0) return "";

  // Gzip
  if (buf[0] === GZIP_MAGIC_0 && buf[1] === GZIP_MAGIC_1) {
    const decompressed = gunzipSync(buf);
    return decompressed.toString("utf-8");
  }

  // ZIP
  if (buf.length >= 4 && buf.readUInt32LE(0) === ZIP_MAGIC) {
    const entries = extractZipEntries(buf);
    // Sort by filename (typically contains timestamps)
    entries.sort((a, b) => a.fileName.localeCompare(b.fileName));
    return entries.map((e) => e.data.toString("utf-8")).join("\n");
  }

  // Plain text
  return buf.toString("utf-8");
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve execution log content from the Harness log-service.
 *
 * Full pipeline: initiate blob download → poll until ready → download zip →
 * extract → parse JSON log entries → return clean text.
 */
export async function resolveLogContent(
  client: HarnessClient,
  prefix: string,
  options?: LogResolveOptions,
): Promise<string> {
  const maxAttempts = options?.maxPollAttempts ?? DEFAULT_POLL_ATTEMPTS;
  const pollInterval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxBytes = options?.maxLogSizeBytes ?? DEFAULT_MAX_LOG_BYTES;
  const signal = options?.signal;

  // Step 1 & 2: Initiate and poll until status is "success"
  let blob: BlobResponse | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error("Log download cancelled");

    log.debug("Requesting log blob", { prefix, attempt });
    blob = await client.request<BlobResponse>({
      method: "POST",
      path: "/log-service/blob",
      params: { prefix },
      signal,
    });

    if (blob?.status === "success" && blob.link) {
      break;
    }

    if (attempt < maxAttempts - 1) {
      log.debug("Log blob not ready, polling", { status: blob?.status, attempt });
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  if (!blob?.link) {
    throw new Error(
      `Log blob not ready after ${maxAttempts} attempts (status: ${blob?.status ?? "unknown"}). Logs may still be processing or have expired.`,
    );
  }

  // Step 3: Download the zip/gzip from the signed URL
  log.debug("Downloading log blob", { link: blob.link.slice(0, 100) });
  const downloadSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(DEFAULT_DOWNLOAD_TIMEOUT_MS)])
    : AbortSignal.timeout(DEFAULT_DOWNLOAD_TIMEOUT_MS);

  const response = await fetch(blob.link, { signal: downloadSignal });
  if (!response.ok) {
    throw new Error(`Log download failed: HTTP ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new Error(`Log file too large (${Math.round(contentLength / 1024 / 1024)}MB). Maximum: ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }

  const arrayBuf = await response.arrayBuffer();
  if (arrayBuf.byteLength > maxBytes) {
    throw new Error(`Log file too large (${Math.round(arrayBuf.byteLength / 1024 / 1024)}MB). Maximum: ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }
  const buf = Buffer.from(arrayBuf);

  // Step 4 & 5: Extract and parse
  const rawText = decompressBlob(buf);
  const parsed = parseLogLines(rawText);

  if (!parsed.trim()) {
    return "(empty log output)";
  }

  return parsed;
}
