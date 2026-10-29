import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, gunzipSync, inflateRawSync } from "node:zlib";
import type { HarnessClient } from "../client/harness-client.js";
import { HarnessApiError } from "./errors.js";
import { createLogger } from "./logger.js";

const log = createLogger("log-resolver");

// Log files are prepared asynchronously. Poll until they are ready or
// maxPollAttempts is exhausted. Tests override maxPollAttempts.
const DEFAULT_POLL_ATTEMPTS = 5;
const DEFAULT_POLL_INTERVAL_MS = 3000;
/**
 * After streaming GET /blob (gzip/plain with a sliding window; zip buffered
 * with a high wire safety cap), keep only this many trailing decompressed
 * bytes per key. Replaces the old 2MB hard reject so large unit logs still
 * yield a useful tail. Override via {@link LogResolveOptions.maxLogSizeBytes}.
 */
const DEFAULT_BLOB_TAIL_BYTES = 500 * 1024; // 500 KB
/** Absolute compressed-size safety limit while buffering a ZIP /blob body. */
const ABSOLUTE_ZIP_WIRE_BYTES = 32 * 1024 * 1024;
/**
 * Max extra GET /blob calls after an empty base logBaseKey, one per
 * command-unit key. When over the cap, the **last** keys are kept (failures
 * and the last unit that logged tend to be late). Happy path stays 1 request;
 * unit keys are fetched only when the base key is empty.
 */
const MAX_COMMAND_UNIT_KEYS = 10;
/** Default unit name used by Harness UI for script/command steps. */
const DEFAULT_COMMAND_UNIT_NAMES = ["Execute"];
/** Default diagnose / snippet tail when callers omit {@link LogResolveOptions.snippetLines}. */
const DEFAULT_SNIPPET_LINES = 120;
/** Per-unit line budget in `full` mode before soft-trimming the overall result. */
const DEFAULT_FULL_UNIT_LINES = 500;
/** Soft overall line budget for labeled `full` mode (trim earliest sections). */
const DEFAULT_FULL_TOTAL_LINES = 2000;

export type LogResolveMode = "snippet" | "full";

export interface LogResolveOptions {
  signal?: AbortSignal;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
  /**
   * Max trailing decompressed bytes kept per GET /blob after streaming
   * (default 500KB). Not a wire reject — oversized blobs are tailed, not thrown.
   */
  maxLogSizeBytes?: number;
  /**
   * Command-unit names from the execution graph (`unitProgresses`).
   * Fetched as `${logBaseKey}-commandUnit:${name}` only if the base key
   * returns empty and no exact {@link logKeys} are known.
   */
  commandUnitNames?: string[];
  /**
   * Exact log keys from the node's `executableResponses[*].*.logKeys`.
   * Preferred over {@link commandUnitNames} because `unitProgresses` can list
   * fewer units than were actually logged.
   */
  logKeys?: string[];
  /**
   * `snippet` — prefer failed units then last non-empty (diagnose). `full` —
   * labeled sections for every non-empty unit (harness_get). Default `full`.
   */
  mode?: LogResolveMode;
  /** Tail line count for `snippet` mode (and safety trim). Default 120. */
  snippetLines?: number;
  /**
   * From `unitProgresses` entries with failed/error status. Snippet mode tries
   * these keys first (then reverse last-non-empty).
   */
  failedUnitNames?: string[];
}

/** Build UI-style command-unit blob key from a step logBaseKey. */
export function commandUnitLogKey(baseKey: string, unitName: string): string {
  if (baseKey.includes("-commandUnit:")) return baseKey;
  return `${baseKey}-commandUnit:${unitName}`;
}

/**
 * Ordered keys for GET /blob: base logBaseKey first, then command-unit keys
 * (capped at {@link MAX_COMMAND_UNIT_KEYS}, keeping the **last** keys when over).
 *
 * Unit keys come from exact graph `logKeys` when available; otherwise from
 * `unitProgresses` names plus the default {@link DEFAULT_COMMAND_UNIT_NAMES}
 * (`Execute`), which is always kept inside the cap.
 */
export function blobKeysToTry(
  baseKey: string,
  commandUnitNames?: string[],
  logKeys?: string[],
): string[] {
  if (baseKey.includes("-commandUnit:")) return [baseKey];

  const seen = new Set<string>([baseKey]);
  const unitKeys: string[] = [];
  const add = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    unitKeys.push(key);
  };

  if (logKeys?.length) {
    for (const raw of logKeys) {
      const key = raw.trim();
      if (key) add(key);
    }
    return [baseKey, ...unitKeys.slice(-MAX_COMMAND_UNIT_KEYS)];
  }

  const names: string[] = [];
  const nameSeen = new Set<string>();
  for (const raw of commandUnitNames ?? []) {
    const name = raw.trim();
    if (!name || nameSeen.has(name)) continue;
    nameSeen.add(name);
    names.push(name);
  }
  const defaults = DEFAULT_COMMAND_UNIT_NAMES.filter((n) => !nameSeen.has(n));
  // Keep the last graph names + defaults (Execute) so late units are not dropped.
  const graphSlots = Math.max(0, MAX_COMMAND_UNIT_KEYS - defaults.length);
  for (const name of [...names.slice(-graphSlots), ...defaults]) {
    add(commandUnitLogKey(baseKey, name));
  }

  return [baseKey, ...unitKeys];
}

/** Extract a human label from a blob key for section headers. */
export function commandUnitLabel(key: string): string {
  const marker = "-commandUnit:";
  const idx = key.indexOf(marker);
  return idx >= 0 ? key.slice(idx + marker.length) : "step";
}

/** Keep the last `n` lines of text (diagnose-style tail). */
export function tailLogLines(text: string, n: number): string {
  if (n <= 0) return text;
  const lines = text.split("\n");
  if (lines.length <= n) return text;
  return `... (${lines.length - n} lines omitted) ...\n` + lines.slice(-n).join("\n");
}

function formatUnitSection(key: string, body: string): string {
  return `--- commandUnit: ${commandUnitLabel(key)} ---\n${body}`;
}

/**
 * Map failed unit names to blob keys. Prefers matches already in `unitKeys`,
 * otherwise synthesizes `${base}-commandUnit:${name}` so a failed unit missing
 * from a truncated logKeys list is still tried.
 */
export function failedUnitKeysToTry(
  baseKey: string,
  unitKeys: string[],
  failedUnitNames?: string[],
): string[] {
  if (!failedUnitNames?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of failedUnitNames) {
    const name = raw.trim();
    if (!name) continue;
    const synthesized = commandUnitLogKey(baseKey, name);
    const match =
      unitKeys.find((k) => k === synthesized) ??
      unitKeys.find((k) => k.endsWith(`-commandUnit:${name}`)) ??
      synthesized;
    if (seen.has(match)) continue;
    seen.add(match);
    out.push(match);
  }
  return out;
}

/** Snippet fetch order: failed units first, then remaining keys from the end. */
export function snippetUnitKeyOrder(
  baseKey: string,
  unitKeys: string[],
  failedUnitNames?: string[],
): string[] {
  const failed = failedUnitKeysToTry(baseKey, unitKeys, failedUnitNames);
  const failedSet = new Set(failed);
  const restReversed = [...unitKeys].reverse().filter((k) => !failedSet.has(k));
  return [...failed, ...restReversed];
}

/** Soft-trim labeled sections so total lines stay under `maxLines` (drop from the start). */
function softTrimSections(sections: string[], maxLines: number): string {
  let combined = sections.join("\n\n");
  let lines = combined.split("\n");
  if (lines.length <= maxLines) return combined;
  while (sections.length > 1 && lines.length > maxLines) {
    sections.shift();
    combined = sections.join("\n\n");
    lines = combined.split("\n");
  }
  if (lines.length <= maxLines) return combined;
  return tailLogLines(combined, maxLines);
}

/** Only empty bodies and 404s should advance to the next blob key. */
function shouldTryNextBlobKey(err: unknown): boolean {
  return err instanceof HarnessApiError && err.statusCode === 404;
}

interface BlobResponse {
  link?: string;
  status?: string;
  error_msg?: string;
  message?: string;
}

function zipErrorDetail(blob: BlobResponse | undefined): string | undefined {
  const raw = blob?.error_msg ?? blob?.message;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

/** Hosts that serve blob content directly — never rewrite. */
const EXTERNAL_STORAGE_HOSTS = new Set([
  "storage.googleapis.com",
  "storage.cloud.google.com",
  "s3.amazonaws.com",
  "s3.us-east-1.amazonaws.com",
  "s3.us-east-2.amazonaws.com",
  "s3.us-west-1.amazonaws.com",
  "s3.us-west-2.amazonaws.com",
  "s3.eu-west-1.amazonaws.com",
  "s3.eu-central-1.amazonaws.com",
  "s3.ap-southeast-1.amazonaws.com",
  "s3.ap-northeast-1.amazonaws.com",
]);

/** S3-style host pattern: bucket.s3.amazonaws.com or bucket.s3.region.amazonaws.com */
const S3_BUCKET_HOST_RE = /^[a-z0-9][a-z0-9.-]*\.s3([.-][a-z0-9-]+)?\.amazonaws\.com$/i;

function safeParseUrl(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

function isExternalStorageHost(host: string): boolean {
  const h = host.toLowerCase();
  if (EXTERNAL_STORAGE_HOSTS.has(h)) return true;
  if (S3_BUCKET_HOST_RE.test(h)) return true;
  if (h.endsWith(".storage.googleapis.com")) return true;
  return false;
}

/**
 * Detect Harness-internal hosts that are never publicly routable.
 * Even when these URLs carry pre-signed query params, they must route
 * through the client so internal deployments can rewrite the host.
 */
function isHarnessHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "harness.io" || h.endsWith(".harness.io");
}

/**
 * Detect pre-signed URLs that should be fetched directly without auth.
 * GCS and S3 signed URLs carry their credentials in query params — adding
 * extra auth headers or rewriting the host invalidates the signature.
 */
function isPresignedUrl(url: URL): boolean {
  if (url.searchParams.has("X-Goog-Signature")) return true;
  if (url.searchParams.has("X-Amz-Signature")) return true;
  return false;
}

/**
 * True when the URL's signature covers the HTTP `Host` header.
 * Rewriting the hostname for CDN fetch would invalidate the signature (401).
 */
function signedHeadersIncludeHost(url: URL): boolean {
  const goog = url.searchParams.get("X-Goog-SignedHeaders");
  if (goog) {
    return goog
      .split(";")
      .map((s) => s.trim().toLowerCase())
      .includes("host");
  }
  const amz = url.searchParams.get("X-Amz-SignedHeaders");
  if (amz) {
    return amz
      .split(";")
      .map((s) => s.trim().toLowerCase())
      .includes("host");
  }
  return false;
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

// ZIP format signature bytes (defined by the PKWARE ZIP specification).
// These are fixed binary markers present in every ZIP file — they identify
// the type of record, not file contents or directory structure.
const ZIP_MAGIC = 0x04034b50; // PK\x03\x04 — Local file header signature
const GZIP_MAGIC_0 = 0x1f;    // First byte of gzip magic number
const GZIP_MAGIC_1 = 0x8b;    // Second byte of gzip magic number

interface ZipEntry {
  fileName: string;
  data: Buffer;
}

const EOCD_SIG = 0x06054b50; // PK\x05\x06 — End of Central Directory record signature
const CD_SIG = 0x02014b50;   // PK\x01\x02 — Central Directory file header signature

/**
 * Minimal ZIP reader — extracts all files from a ZIP archive.
 *
 * Why Central Directory instead of local headers?
 * When a ZIP is created in streaming mode (as the Harness log-service does),
 * the compressor doesn't know sizes upfront. It sets bit 3 (data descriptor flag)
 * in local headers and writes compressedSize=0, uncompressedSize=0 as placeholders.
 * The real sizes are only available in the Central Directory at the end of the file.
 *
 * Only supports DEFLATE (method 8) and STORED (method 0) entries.
 */
function extractZipEntries(buf: Buffer): ZipEntry[] {
  // Step 1: Find the End of Central Directory (EOCD) record by scanning backwards.
  // The EOCD is always the last record in a ZIP. Its minimum size is 22 bytes:
  //   4 (signature) + 2 (disk#) + 2 (disk w/ CD) + 2 (CD entries this disk)
  //   + 2 (total CD entries) + 4 (CD size) + 4 (CD offset) + 2 (comment length)
  // So the earliest it can start is at buf.length - 22.
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    log.warn("ZIP EOCD not found, falling back to local-header-only parsing");
    return extractZipEntriesFromLocalHeaders(buf);
  }

  // Step 2: Read Central Directory location from the EOCD record.
  //   EOCD+12 = size of the Central Directory (4 bytes)
  //   EOCD+16 = offset where the Central Directory starts (4 bytes)
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);

  if (cdOffset + cdSize > buf.length) {
    log.warn("ZIP Central Directory extends beyond buffer", { cdOffset, cdSize, bufferLength: buf.length });
    return extractZipEntriesFromLocalHeaders(buf);
  }

  // Step 3: Parse Central Directory entries to get accurate sizes and local header offsets
  const entries: ZipEntry[] = [];
  let pos = cdOffset;

  // Each CD entry has a 46-byte fixed header followed by variable-length fields.
  // Key offsets within the CD entry:
  //   +10  compression method (2 bytes): 0 = STORED, 8 = DEFLATE
  //   +20  compressed size (4 bytes) — always accurate here, unlike local headers
  //   +24  uncompressed size (4 bytes)
  //   +28  file name length (2 bytes)
  //   +30  extra field length (2 bytes)
  //   +32  file comment length (2 bytes)
  //   +42  offset to corresponding local file header (4 bytes)
  //   +46  file name (variable length)
  while (pos + 46 <= cdOffset + cdSize) {
    const sig = buf.readUInt32LE(pos);
    if (sig !== CD_SIG) break;

    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const uncompressedSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const fileName = buf.subarray(pos + 46, pos + 46 + nameLen).toString("utf-8");

    // Advance past this CD entry (46-byte header + variable-length fields)
    pos += 46 + nameLen + extraLen + commentLen;

    // Read the local file header (30-byte fixed header) to compute where
    // the actual compressed data starts. We need the local header's own
    // nameLen and extraLen since they may differ from the CD entry's values.
    //   localHeader+26 = file name length (2 bytes)
    //   localHeader+28 = extra field length (2 bytes)
    //   data starts at: localHeader + 30 + nameLen + extraLen
    if (localHeaderOffset + 30 > buf.length) continue;
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;

    if (dataStart + compressedSize > buf.length) {
      log.warn("ZIP entry data extends beyond buffer", { fileName, dataStart, compressedSize, bufferLength: buf.length });
      continue;
    }

    const compressedData = buf.subarray(dataStart, dataStart + compressedSize);

    let fileData: Buffer;
    if (method === 0) {
      // STORED — data is uncompressed, use as-is
      fileData = compressedData;
    } else if (method === 8) {
      // DEFLATE — decompress using raw inflate (no zlib header)
      try {
        fileData = inflateRawSync(compressedData, { maxOutputLength: uncompressedSize || undefined });
      } catch (err) {
        log.warn("Failed to decompress ZIP entry", { fileName, method, compressedSize, uncompressedSize, error: String(err) });
        continue;
      }
    } else {
      log.warn("Unsupported ZIP compression method", { method, fileName });
      continue;
    }

    entries.push({ fileName, data: fileData });
  }

  return entries;
}

/**
 * Fallback: parse ZIP using local file headers only (no data-descriptor support).
 */
function extractZipEntriesFromLocalHeaders(buf: Buffer): ZipEntry[] {
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

    if (dataStart + compressedSize > buf.length) break;
    const compressedData = buf.subarray(dataStart, dataStart + compressedSize);

    let fileData: Buffer;
    if (method === 0) {
      fileData = compressedData;
    } else if (method === 8) {
      try {
        fileData = inflateRawSync(compressedData, { maxOutputLength: uncompressedSize || undefined });
      } catch (err) {
        log.warn("Failed to decompress ZIP entry (fallback)", { fileName, error: String(err) });
        offset = dataStart + compressedSize;
        continue;
      }
    } else {
      offset = dataStart + compressedSize;
      continue;
    }

    entries.push({ fileName, data: fileData });
    offset = dataStart + compressedSize;
  }

  return entries;
}

/**
 * Decompress a fully-buffered blob — handles gzip, zip, or plain text.
 * Callers should pass {@link takeUtf8Tail} afterward when only a trailing window is needed.
 */
function decompressBlob(buf: Buffer): string {
  if (buf.length === 0) return "";

  // Gzip
  if (buf[0] === GZIP_MAGIC_0 && buf[1] === GZIP_MAGIC_1) {
    // Allow large inflate then tail — streaming path is preferred for gzip GET /blob.
    const decompressed = gunzipSync(buf, { maxOutputLength: ABSOLUTE_ZIP_WIRE_BYTES });
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

/** Sliding window of the last `maxBytes` of a byte stream. */
class ByteTail {
  private chunks: Buffer[] = [];
  private size = 0;

  constructor(private readonly maxBytes: number) {}

  push(chunk: Buffer): void {
    if (chunk.length === 0) return;
    if (chunk.length >= this.maxBytes) {
      this.chunks = [chunk.subarray(chunk.length - this.maxBytes)];
      this.size = this.maxBytes;
      return;
    }
    this.chunks.push(chunk);
    this.size += chunk.length;
    while (this.size > this.maxBytes && this.chunks.length > 0) {
      const overflow = this.size - this.maxBytes;
      const head = this.chunks[0]!;
      if (head.length <= overflow) {
        this.chunks.shift();
        this.size -= head.length;
      } else {
        this.chunks[0] = head.subarray(overflow);
        this.size = this.maxBytes;
        break;
      }
    }
  }

  toUtf8(): string {
    if (this.size === 0) return "";
    return takeUtf8Tail(Buffer.concat(this.chunks, this.size), this.size);
  }
}

/** Decode a byte window as UTF-8, dropping a leading partial multi-byte char if needed. */
function takeUtf8Tail(buf: Buffer, maxBytes: number): string {
  const slice = buf.length > maxBytes ? buf.subarray(buf.length - maxBytes) : buf;
  let start = 0;
  while (start < slice.length && start < 4 && (slice[start]! & 0xc0) === 0x80) start++;
  return slice.subarray(start).toString("utf-8");
}

async function readAtLeast(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  minBytes: number,
): Promise<Buffer> {
  const parts: Buffer[] = [];
  let total = 0;
  while (total < minBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;
    parts.push(Buffer.from(value));
    total += value.byteLength;
  }
  return parts.length ? Buffer.concat(parts, total) : Buffer.alloc(0);
}

async function readRemaining(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  prefix: Buffer,
  maxTotal: number,
): Promise<Buffer> {
  const parts: Buffer[] = prefix.length ? [prefix] : [];
  let total = prefix.length;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;
    total += value.byteLength;
    if (total > maxTotal) {
      await reader.cancel().catch(() => undefined);
      throw logTooLargeError(total, maxTotal);
    }
    parts.push(Buffer.from(value));
  }
  return parts.length ? Buffer.concat(parts, total) : Buffer.alloc(0);
}

function webReaderToNodeReadable(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  prefix: Buffer,
): Readable {
  let prefixSent = prefix.length === 0;
  return new Readable({
    async read() {
      try {
        if (!prefixSent) {
          prefixSent = true;
          this.push(prefix);
          return;
        }
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }
        this.push(value && value.byteLength ? Buffer.from(value) : Buffer.alloc(0));
      } catch (err) {
        this.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}

async function streamGunzipToTail(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  prefix: Buffer,
  tailBytes: number,
): Promise<string> {
  const tail = new ByteTail(tailBytes);
  const gunzip = createGunzip();
  gunzip.on("data", (chunk: Buffer) => tail.push(chunk));
  await pipeline(webReaderToNodeReadable(reader, prefix), gunzip);
  return tail.toUtf8();
}

async function streamPlainToTail(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  prefix: Buffer,
  tailBytes: number,
): Promise<string> {
  const tail = new ByteTail(tailBytes);
  tail.push(prefix);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;
    tail.push(Buffer.from(value));
  }
  return tail.toUtf8();
}

/**
 * Stream a GET /blob Response body: sliding 500KB (or `tailBytes`) for gzip/plain;
 * ZIP is buffered up to {@link ABSOLUTE_ZIP_WIRE_BYTES} then decompressed and tailed.
 */
async function streamBlobResponseToText(response: Response, tailBytes: number): Promise<string> {
  if (!response.body) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length === 0) return "";
    return takeUtf8Tail(Buffer.from(decompressBlob(buf), "utf-8"), tailBytes);
  }

  const reader = response.body.getReader();
  const peeked = await readAtLeast(reader, 4);
  if (peeked.length === 0) return "";

  if (peeked[0] === GZIP_MAGIC_0 && peeked[1] === GZIP_MAGIC_1) {
    return streamGunzipToTail(reader, peeked, tailBytes);
  }

  if (peeked.length >= 4 && peeked.readUInt32LE(0) === ZIP_MAGIC) {
    const full = await readRemaining(reader, peeked, ABSOLUTE_ZIP_WIRE_BYTES);
    return takeUtf8Tail(Buffer.from(decompressBlob(full), "utf-8"), tailBytes);
  }

  return streamPlainToTail(reader, peeked, tailBytes);
}

// ─── Public API ─────────────────────────────────────────────────────────────

async function requestLogBlobLink(
  client: HarnessClient,
  prefix: string,
  options?: LogResolveOptions,
): Promise<string> {
  const maxAttempts = options?.maxPollAttempts ?? DEFAULT_POLL_ATTEMPTS;
  const pollInterval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const signal = options?.signal;

  let blob: BlobResponse | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error("Log download cancelled");

    log.debug("Requesting log blob", { prefix, attempt });
    blob = await client.request<BlobResponse>({
      method: "POST",
      path: "/gateway/log-service/blob/download",
      params: { prefix },
      signal,
    });

    if (blob?.status === "error") {
      const detail = zipErrorDetail(blob);
      throw new Error(
        detail ? `Log download failed: ${detail}` : "Log download failed.",
      );
    }

    if (blob?.status === "success" && blob.link) {
      return blob.link;
    }

    if (attempt < maxAttempts - 1) {
      log.debug("Log blob not ready, polling", { status: blob?.status, attempt });
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  throw new Error(
    `Log blob not ready after ${maxAttempts} attempts (status: ${blob?.status ?? "unknown"}). Logs may still be processing or have expired.`,
  );
}

function rewriteDownloadUrlIfNeeded(client: HarnessClient, blobLink: string): string {
  const blobUrl = safeParseUrl(blobLink);
  if (!blobUrl || isExternalStorageHost(blobUrl.hostname)) {
    return blobLink;
  }

  if (isPresignedUrl(blobUrl) && isHarnessHost(blobUrl.hostname) && blobUrl.pathname.startsWith("/storage/")) {
    const baseUrl = safeParseUrl(client.baseURL);
    if (!baseUrl) {
      throw new Error(`Cannot rewrite Harness CDN blob URL: HARNESS_BASE_URL "${client.baseURL}" is not a valid URL`);
    }
    if (signedHeadersIncludeHost(blobUrl) && blobUrl.hostname === baseUrl.hostname) {
      return blobLink;
    }
    blobUrl.hostname = baseUrl.hostname;
    blobUrl.protocol = baseUrl.protocol;
    blobUrl.port = baseUrl.port;
    return blobUrl.toString();
  }

  return blobLink;
}

export async function resolveLogDownloadUrl(
  client: HarnessClient,
  prefix: string,
  options?: LogResolveOptions,
): Promise<string> {
  const blobLink = await requestLogBlobLink(client, prefix, options);
  return rewriteDownloadUrlIfNeeded(client, blobLink);
}

/**
 * GET /blob for one key via {@link HarnessClient.requestStream}.
 * Streams the body and keeps only the last `tailBytes` of decompressed text
 * (default 500KB) — no 2MB wire hard-reject.
 */
async function fetchBlobText(
  client: HarnessClient,
  key: string,
  tailBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  log.debug("Requesting log blob (stream)", { key, tailBytes });
  const response = await client.requestStream({
    method: "GET",
    path: "/gateway/log-service/blob",
    params: { key },
    signal,
    retryPolicy: "safe",
  });

  const text = await streamBlobResponseToText(response, tailBytes);
  log.debug("Streamed blob tail", {
    key,
    tailChars: text.length,
    magic: text.length >= 4 ? Buffer.from(text.slice(0, 4)).toString("hex") : "empty",
  });
  return text;
}

function logTooLargeError(bytes: number, maxBytes: number): Error {
  return new Error(
    `Log file too large (${Math.round(bytes / 1024 / 1024)}MB). Maximum: ${Math.round(maxBytes / 1024 / 1024)}MB.`,
  );
}

/**
 * Resolve execution log content from the Harness log-service.
 *
 * Uses GET /blob (single log key per request) via a streamed body read. Each
 * blob keeps only the last {@link LogResolveOptions.maxLogSizeBytes} (default
 * 500KB) of decompressed text — oversized units are tailed, not rejected.
 *
 * If the step `logBaseKey` has content (e.g. CI steps) it is returned after a
 * single request. Otherwise command-unit keys are resolved from `logKeys` or
 * `commandUnitNames` (else `Execute`):
 *
 * - **snippet** (diagnose): prefer `failedUnitNames` from graph status, else
 *   walk unit keys from the end; skip empty/404; return first hit (labeled +
 *   tailed). Covers marked failures, late failures, and early failures where
 *   later units never ran.
 * - **full** (harness_get): fetch non-empty units as labeled sections with a
 *   soft overall line budget (no hard merge-size throw).
 *
 * For a signed zip download URL only, use {@link resolveLogDownloadUrl}.
 *
 * @param key Log key / logBaseKey for a single step
 */
export async function resolveLogContent(
  client: HarnessClient,
  key: string,
  options?: LogResolveOptions,
): Promise<string> {
  const tailBytes = options?.maxLogSizeBytes ?? DEFAULT_BLOB_TAIL_BYTES;
  const mode: LogResolveMode = options?.mode ?? "full";
  const snippetLines = options?.snippetLines ?? DEFAULT_SNIPPET_LINES;
  const signal = options?.signal;

  if (signal?.aborted) throw new Error("Log download cancelled");

  const [baseKey, ...unitKeys] = blobKeysToTry(key, options?.commandUnitNames, options?.logKeys);
  let lastMissingError: unknown;
  let sawEmpty = false;

  /** Raw blob text, or "" when the key is empty or missing (404). */
  const fetchKey = async (candidate: string): Promise<string> => {
    if (signal?.aborted) throw new Error("Log download cancelled");
    try {
      const raw = await fetchBlobText(client, candidate, tailBytes, signal);
      if (raw.trim()) return raw;
      sawEmpty = true;
      log.debug("Log blob empty", { key: candidate });
    } catch (err) {
      // Only 404 (wrong/missing key) is skipped. Rate limits, auth, 5xx, and
      // size errors stop — the HTTP client already retries retryable statuses.
      if (!shouldTryNextBlobKey(err)) throw err;
      lastMissingError = err;
      log.debug("Log blob key not found", {
        key: candidate,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return "";
  };

  const baseRaw = await fetchKey(baseKey!);
  if (baseRaw) {
    const text = parseLogLines(baseRaw).trim();
    if (text) {
      return mode === "snippet" ? tailLogLines(text, snippetLines) : text;
    }
  }

  if (mode === "snippet") {
    const order = snippetUnitKeyOrder(baseKey!, unitKeys, options?.failedUnitNames);
    const failedSet = new Set(failedUnitKeysToTry(baseKey!, unitKeys, options?.failedUnitNames));
    for (const candidate of order) {
      const raw = await fetchKey(candidate);
      if (!raw) continue;
      const text = parseLogLines(raw).trim();
      if (!text) continue;
      log.info("Resolved logs via command-unit key", {
        baseKey: key,
        key: candidate,
        reason: failedSet.has(candidate) ? "failed_unit_status" : "last_non_empty",
      });
      return formatUnitSection(candidate, tailLogLines(text, snippetLines));
    }
  } else {
    const sections: string[] = [];
    for (const candidate of unitKeys) {
      const raw = await fetchKey(candidate);
      if (!raw) continue;
      const text = parseLogLines(raw).trim();
      if (!text) continue;
      sections.push(formatUnitSection(candidate, tailLogLines(text, DEFAULT_FULL_UNIT_LINES)));
    }
    if (sections.length > 0) {
      log.info("Resolved logs as labeled command-unit sections", {
        baseKey: key,
        keysFetched: unitKeys.length,
        keysWithContent: sections.length,
      });
      return softTrimSections(sections, DEFAULT_FULL_TOTAL_LINES);
    }
  }

  if (!sawEmpty && lastMissingError) throw lastMissingError;
  return "(empty log output)";
}
