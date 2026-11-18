import type { DeepLinkParamResolverContext } from "./types.js";
import { encodePathSegment } from "../utils/path.js";
import { asRecord } from "../utils/type-guards.js";

/**
 * Deep-link support for Harness Code resources (repository, branch, file_content, pull_request).
 *
 * The Code API accepts a numeric repository ID anywhere it accepts a repo ref, but the Harness UI
 * route (`.../repos/:repoId/...`) only resolves the repository identifier. Pull request responses
 * carry only numeric `source_repo_id` / `target_repo_id`, so a link built from the caller's `repo_id`
 * input is broken whenever the caller passed the numeric ID.
 */

/** Pure digits can only be a repository ID: repository identifiers must start with a letter or underscore. */
const NUMERIC_REPO_REF = /^\d+$/;

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Derive org/project from a repository `path` of the form `<account>[/<org>[/<project>]]/<identifier>`.
 * Returns undefined (leave caller-supplied scope alone) unless the path is unambiguous: it must start
 * with the root space and end with the repository identifier.
 */
function scopeFromRepoPath(
  repo: Record<string, unknown>,
  identifier: string,
): { orgIdentifier: string; projectIdentifier: string } | undefined {
  const path = nonEmptyString(repo.path);
  const rootSpace = nonEmptyString(repo.root_space_identifier);
  if (!path || !rootSpace) return undefined;

  const segments = path.split("/").filter((segment) => segment !== "");
  if (segments[0] !== rootSpace || segments[segments.length - 1] !== identifier) return undefined;

  const scope = segments.slice(1, -1);
  if (scope.length === 0) return { orgIdentifier: "", projectIdentifier: "" };
  if (scope.length === 1) return { orgIdentifier: scope[0]!, projectIdentifier: "" };
  if (scope.length === 2) return { orgIdentifier: scope[0]!, projectIdentifier: scope[1]! };
  return undefined;
}

/** Deep-link placeholder overrides for a repository record, or undefined when it has no identifier. */
function linkParamsFromRepo(repo: Record<string, unknown>): Record<string, string> | undefined {
  const identifier = nonEmptyString(repo.identifier);
  if (!identifier) return undefined;
  return { repoIdentifier: identifier, ...scopeFromRepoPath(repo, identifier) };
}

/**
 * `ResourceDefinition.deepLinkParamResolver` for Harness Code resources.
 *
 * - Slug refs are returned untouched (`undefined`), so the common path costs no extra request.
 * - Numeric refs are replaced with the repository identifier and the org/project the repo really
 *   lives in. A `repository` response already carries both; everything else needs one
 *   `GET /code/api/v1/repos/<id>` per dispatch.
 * - If the lookup yields no identifier the link is suppressed (`null`); a request failure rejects and
 *   is handled the same way by the registry.
 */
export async function resolveCodeRepoLinkParams(
  ctx: DeepLinkParamResolverContext,
): Promise<Record<string, string> | null | undefined> {
  const repoRef = ctx.linkParams.repoIdentifier;
  if (!repoRef || !NUMERIC_REPO_REF.test(repoRef)) return undefined;

  if (String(ctx.result.id) === repoRef) {
    const fromResult = linkParamsFromRepo(ctx.result);
    if (fromResult) return fromResult;
  }

  // Raw requests bypass registry scope injection (§17.1), so forward the scope the primary call carried.
  // Code resolves a numeric repo ID globally, so a missing or mismatched scope still returns the repo.
  const scopeParams: Record<string, string> = {};
  if (ctx.linkParams.orgIdentifier) scopeParams.orgIdentifier = ctx.linkParams.orgIdentifier;
  if (ctx.linkParams.projectIdentifier) scopeParams.projectIdentifier = ctx.linkParams.projectIdentifier;

  const repo = await ctx.client.request<unknown>({
    method: "GET",
    path: `/code/api/v1/repos/${encodePathSegment(repoRef)}`,
    params: scopeParams,
    retryPolicy: "safe",
    signal: ctx.signal,
  });
  return linkParamsFromRepo(asRecord(repo) ?? {}) ?? null;
}

/**
 * `deepLinkParamResolver` for `pull_request`: everything `resolveCodeRepoLinkParams` does, plus the
 * PR number. Most responses carry `number`, but `merge` returns only the merge result, which would
 * otherwise leave a literal `{number}` in the link; fall back to the `pr_number` the caller passed.
 */
export async function resolvePullRequestLinkParams(
  ctx: DeepLinkParamResolverContext,
): Promise<Record<string, string> | null | undefined> {
  const repoParams = await resolveCodeRepoLinkParams(ctx);
  if (repoParams === null) return null;

  const prNumber = ctx.result.number === undefined ? ctx.input.pr_number : undefined;
  if (typeof prNumber !== "string" && typeof prNumber !== "number") return repoParams;
  const number = String(prNumber);
  return number === "" ? repoParams : { ...repoParams, number };
}
