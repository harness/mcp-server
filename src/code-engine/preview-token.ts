/**
 * Stateless HMAC-signed preview tokens & bounded idempotency receipt cache.
 *
 * Design:
 *  - Preview tokens carry `{ v: 1, accountId, orgId, projectId, resourceScope,
 *    resourceType, resourceId, baseSha256, candidateSha256, operations, exp }`
 *    signed with HMAC-SHA256 (using `HARNESS_MCP_REQUEST_STATE_KEY` when >=32B,
 *    else a process-scoped 32-byte key — matching `src/utils/elicitation.ts`).
 *  - Zero server-side session state is required to verify and replay a preview
 *    across multi-replica HTTP pods: on `apply`, the server re-fetches the
 *    live resource, verifies `live.sha256 === baseSha256` (`REVISION_CONFLICT`
 *    otherwise), re-applies `operations` deterministically, and checks that the
 *    resulting digest equals `candidateSha256` (`PREVIEW_MISMATCH` otherwise).
 *  - Scoped `idempotency_key` receipts prevent duplicate commits on client retries
 *    after network timeouts and reject key reuse across different previews
 *    (`IDEMPOTENCY_KEY_CONFLICT`).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  CodeEngineError,
  type ApplyEditResponse,
  type PatchOperation,
} from "./types.js";

const DEFAULT_PREVIEW_TTL_SECONDS = 600; // 10 minutes
const MAX_IDEMPOTENCY_ENTRIES = 512;

let _signingKey: Buffer = randomBytes(32);

export function configurePreviewSigningKey(rawKey?: string): void {
  if (rawKey) {
    const buf = Buffer.from(rawKey, "utf8");
    if (buf.byteLength >= 32) {
      _signingKey = buf;
    }
  }
}

export interface PreviewTokenPayload {
  v: 1;
  accountId: string;
  orgId?: string;
  projectId?: string;
  resourceScope?: string;
  resourceType: string;
  resourceId: string;
  baseRevision: string;
  baseSha256: string;
  candidateSha256: string;
  operations: readonly PatchOperation[];
  iat: number;
  exp: number;
}

function signBytes(payloadB64: string, key: Buffer): Buffer {
  return createHmac("sha256", key).update(`pv1.${payloadB64}`, "utf8").digest();
}

export function issuePreviewToken(
  params: Omit<PreviewTokenPayload, "v" | "iat" | "exp">,
  opts?: { ttlSeconds?: number; signingKey?: string },
): { token: string; expiresAt: string } {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = opts?.ttlSeconds ?? DEFAULT_PREVIEW_TTL_SECONDS;
  const payload: PreviewTokenPayload = {
    v: 1,
    ...params,
    iat: nowSec,
    exp: nowSec + ttl,
  };
  const key =
    opts?.signingKey && Buffer.byteLength(opts.signingKey, "utf8") >= 32
      ? Buffer.from(opts.signingKey, "utf8")
      : _signingKey;

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sigB64 = signBytes(payloadB64, key).toString("base64url");
  return {
    token: `pv_${payloadB64}.${sigB64}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyPreviewToken(
  token: string,
  expectedContext: {
    accountId: string;
    orgId?: string;
    projectId?: string;
    resourceScope?: string;
    resourceType: string;
    resourceId: string;
  },
  opts?: { signingKey?: string; nowSec?: number },
): PreviewTokenPayload {
  if (!token.startsWith("pv_")) {
    throw new CodeEngineError("PREVIEW_MISMATCH", "Malformed preview_token (expected 'pv_' prefix).");
  }
  const rest = token.slice(3);
  const dot = rest.indexOf(".");
  if (dot <= 0 || dot === rest.length - 1) {
    throw new CodeEngineError("PREVIEW_MISMATCH", "Malformed preview_token structure.");
  }

  const payloadB64 = rest.slice(0, dot);
  const sigB64 = rest.slice(dot + 1);
  const key =
    opts?.signingKey && Buffer.byteLength(opts.signingKey, "utf8") >= 32
      ? Buffer.from(opts.signingKey, "utf8")
      : _signingKey;

  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(sigB64, "base64url");
  } catch {
    throw new CodeEngineError("PREVIEW_MISMATCH", "Invalid preview_token signature encoding.");
  }
  const expectedSig = signBytes(payloadB64, key);
  if (actualSig.byteLength !== expectedSig.byteLength || !timingSafeEqual(actualSig, expectedSig)) {
    throw new CodeEngineError(
      "PREVIEW_MISMATCH",
      "preview_token signature verification failed (invalid token or mismatched HARNESS_MCP_REQUEST_STATE_KEY across replicas).",
    );
  }

  let parsed: PreviewTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as PreviewTokenPayload;
  } catch {
    throw new CodeEngineError("PREVIEW_MISMATCH", "Corrupted preview_token payload.");
  }

  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  if (typeof parsed.exp !== "number" || nowSec > parsed.exp) {
    throw new CodeEngineError(
      "PREVIEW_EXPIRED",
      "preview_token has expired. Run dry_run: true again to generate a fresh preview.",
      [
        {
          code: "PREVIEW_EXPIRED",
          severity: "error",
          message: "Preview expired before apply.",
          remediation: "Re-run harness_update with dry_run: true to inspect current state and obtain a new preview_token.",
        },
      ],
    );
  }

  if (
    parsed.accountId !== expectedContext.accountId ||
    parsed.resourceType !== expectedContext.resourceType ||
    parsed.resourceId !== expectedContext.resourceId ||
    (parsed.orgId ?? "") !== (expectedContext.orgId ?? "") ||
    (parsed.projectId ?? "") !== (expectedContext.projectId ?? "") ||
    (parsed.resourceScope ?? "") !== (expectedContext.resourceScope ?? "")
  ) {
    throw new CodeEngineError(
      "PREVIEW_MISMATCH",
      `preview_token is bound to ${parsed.resourceType}/${parsed.resourceId} (${parsed.accountId}/${parsed.orgId ?? "-"}/${parsed.projectId ?? "-"}, scope ${parsed.resourceScope ?? "default"}), which does not match this request.`,
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Scoped Idempotency Receipt Cache
// ---------------------------------------------------------------------------

interface IdempotencyRecord {
  previewFingerprint: string;
  response: ApplyEditResponse;
  recordedAtMs: number;
}

const idempotencyStore = new Map<string, IdempotencyRecord>();

function scopeIdempotencyKey(params: {
  accountId: string;
  orgId?: string;
  projectId?: string;
  resourceScope?: string;
  resourceType: string;
  resourceId: string;
  idempotencyKey: string;
}): string {
  return [
    params.accountId,
    params.orgId ?? "",
    params.projectId ?? "",
    params.resourceScope ?? "",
    params.resourceType,
    params.resourceId,
    params.idempotencyKey,
  ].join("\0");
}

export function checkIdempotencyReceipt(params: {
  accountId: string;
  orgId?: string;
  projectId?: string;
  resourceScope?: string;
  resourceType: string;
  resourceId: string;
  idempotencyKey: string;
  previewFingerprint: string;
}): ApplyEditResponse | undefined {
  const compositeKey = scopeIdempotencyKey(params);
  const existing = idempotencyStore.get(compositeKey);
  if (!existing) return undefined;

  if (existing.previewFingerprint !== params.previewFingerprint) {
    throw new CodeEngineError(
      "IDEMPOTENCY_KEY_CONFLICT",
      `idempotency_key "${params.idempotencyKey}" was already used with a different preview or patch payload.`,
      [
        {
          code: "IDEMPOTENCY_KEY_CONFLICT",
          severity: "error",
          message: "Cannot reuse an idempotency_key across different edits.",
          remediation: "Generate a fresh idempotency_key for each distinct apply request.",
        },
      ],
    );
  }

  return { ...existing.response, replayed: true };
}

export function recordIdempotencyReceipt(params: {
  accountId: string;
  orgId?: string;
  projectId?: string;
  resourceScope?: string;
  resourceType: string;
  resourceId: string;
  idempotencyKey: string;
  previewFingerprint: string;
  response: ApplyEditResponse;
}): void {
  const compositeKey = scopeIdempotencyKey(params);
  if (idempotencyStore.size >= MAX_IDEMPOTENCY_ENTRIES) {
    const oldest = idempotencyStore.keys().next().value;
    if (oldest !== undefined) idempotencyStore.delete(oldest);
  }
  idempotencyStore.set(compositeKey, {
    previewFingerprint: params.previewFingerprint,
    response: params.response,
    recordedAtMs: Date.now(),
  });
}

export function clearIdempotencyStoreForTests(): void {
  idempotencyStore.clear();
}
