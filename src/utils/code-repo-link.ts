/**
 * Harness Code UI routes address a repository by its slug (`identifier`),
 * e.g. `/module/code/.../repos/dataops-platform/pulls/1272`.
 * The Code API also accepts the numeric repository id (`837`), and callers
 * often pass that id because list payloads expose `id`. Copying it into
 * `openInHarness` produces a link the UI does not resolve.
 */
import type { HarnessClient } from "../client/harness-client.js";
import { createLogger } from "./logger.js";
import { isRecord } from "./type-guards.js";

const log = createLogger("code-repo-link");

const CODE_SCOPE_QUERY_PARAMS = ["orgIdentifier", "projectIdentifier", "organizationIdentifier"] as const;

export function isNumericRepoRef(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export function repoRefString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function nonNumericSlug(value: unknown): string | undefined {
  const text = repoRefString(value);
  if (!text || isNumericRepoRef(text)) return undefined;
  return text;
}

function slugFromRepoPath(path: unknown): string | undefined {
  if (typeof path !== "string" || path.length === 0) return undefined;
  const last = path.split("/").filter(Boolean).pop();
  if (!last || isNumericRepoRef(last)) return undefined;
  return last;
}

function slugFromRepoCore(repo: Record<string, unknown>): string | undefined {
  return nonNumericSlug(repo.identifier) ?? slugFromRepoPath(repo.path);
}

function looksLikeCodeRepository(record: Record<string, unknown>): boolean {
  if ("default_branch" in record || "git_url" in record) return true;
  // RepositoryCore: numeric id plus the UI slug and repo path. Pull requests
  // don't carry this trio (their id is omitted; path lives on a nested repo).
  return typeof record.identifier === "string" && "path" in record && "id" in record;
}

/**
 * Slug the Code UI can put in `/repos/{slug}`.
 * Repository payloads carry `identifier`. Pull requests sometimes nest the
 * target repo as `repo` (or `source_repo` when it is the same repository).
 * A fork's `source_repo` is a different repository and must not be used.
 */
export function codeRepoSlugFromRecord(record: Record<string, unknown>): string | undefined {
  const nestedRepo = record.repo;
  if (isRecord(nestedRepo)) {
    const nestedSlug = slugFromRepoCore(nestedRepo);
    if (nestedSlug) return nestedSlug;
  }

  const sourceRepo = record.source_repo;
  if (isRecord(sourceRepo)) {
    const sourceSlug = slugFromRepoCore(sourceRepo);
    const sourceId = repoRefString(sourceRepo.id);
    const targetId = repoRefString(record.target_repo_id);
    if (sourceSlug && sourceId && targetId && sourceId === targetId) return sourceSlug;
  }

  if (looksLikeCodeRepository(record)) {
    return slugFromRepoCore(record);
  }

  return undefined;
}

/**
 * Prefer a UI slug over a numeric repository id already copied into the link.
 * An item's own slug wins so a cross-repo row is not labeled with the parent repo.
 */
export function applyCodeRepoSlug(
  linkParams: Record<string, string>,
  record: Record<string, unknown> | undefined,
  sharedSlug: string | undefined,
): void {
  const own = record ? codeRepoSlugFromRecord(record) : undefined;
  if (own) {
    linkParams.repoIdentifier = own;
    return;
  }
  if (!sharedSlug) return;
  const current = linkParams.repoIdentifier;
  if (!current || isNumericRepoRef(current)) {
    linkParams.repoIdentifier = sharedSlug;
  }
}

/**
 * Resolve a numeric Code repo ref to its identifier. Best-effort: a failed
 * lookup leaves the numeric id in the link rather than failing the original call.
 */
export async function lookupCodeRepoSlug(
  client: HarnessClient,
  repoRef: string,
  scopeParams: Record<string, string | number | boolean | string[] | undefined>,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const params: Record<string, string> = {};
  for (const key of CODE_SCOPE_QUERY_PARAMS) {
    const value = scopeParams[key];
    if (typeof value === "string" && value.length > 0) params[key] = value;
  }

  try {
    const raw = await client.request({
      method: "GET",
      path: `/code/api/v1/repos/${encodeURIComponent(repoRef)}`,
      params,
      signal,
      retryPolicy: "safe",
    });
    if (!isRecord(raw)) return undefined;
    return codeRepoSlugFromRecord(raw);
  } catch (err: unknown) {
    log.debug("Code repo slug lookup failed", {
      repoRef,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
