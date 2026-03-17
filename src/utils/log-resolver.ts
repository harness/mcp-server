import { gunzipSync, inflateRawSync } from "node:zlib";
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

function isExternalStorageHost(host: string): boolean {
  const h = host.toLowerCase();
  if (EXTERNAL_STORAGE_HOSTS.has(h)) return true;
  if (S3_BUCKET_HOST_RE.test(h)) return true;
  if (h.endsWith(".storage.googleapis.com")) return true;
  return false;
}

/**
 * Resolve the final download URL for a blob link.
 * - External storage (GCS, S3): use as-is — blob is served directly.
 * - Harness-hosted: rewrite host to configured base URL when self-managed.
 */
function resolveDownloadUrl(blobLink: string, harnessBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(blobLink);
  } catch {
    return blobLink;
  }
  if (isExternalStorageHost(url.host)) {
    return blobLink;
  }
  const base = new URL(harnessBaseUrl.replace(/\/$/, "") + "/");
  if (url.host === base.host) {
    return blobLink;
  }
  url.host = base.host;
  url.protocol = base.protocol;
  return url.toString();
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
      path: "/gateway/log-service/blob/download",
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
  // External storage (GCS, S3): use as-is. Harness-hosted: rewrite host when self-managed.
  const downloadUrl = resolveDownloadUrl(blob.link, client.baseURL);
  log.debug("Downloading log blob", { prefix, url: downloadUrl.slice(0, 80) });
  const downloadSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(DEFAULT_DOWNLOAD_TIMEOUT_MS)])
    : AbortSignal.timeout(DEFAULT_DOWNLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(downloadUrl, { signal: downloadSignal });
  } catch (err) {
    const cause =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err);
    throw new Error(`Log download fetch failed for ${new URL(downloadUrl).host}: ${cause}`);
  }
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Log download failed: HTTP ${response.status} — ${errBody.slice(0, 200)}`);
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

  log.debug("Downloaded blob", {
    bytes: buf.length,
    contentType: response.headers.get("content-type"),
    magic: buf.length >= 4 ? buf.subarray(0, 4).toString("hex") : "empty",
  });

  // Step 4 & 5: Extract and parse
  const rawText = decompressBlob(buf);
  const parsed = parseLogLines(rawText);

  if (!parsed.trim()) {
    return "(empty log output)";
  }

  return parsed;
}
