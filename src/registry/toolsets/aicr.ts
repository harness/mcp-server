import { buildDeepLink } from "../../utils/deep-links.js";
import { HarnessApiError } from "../../utils/errors.js";
import { encodePathSegment } from "../../utils/path.js";
import { parseHarnessUrl } from "../../utils/url-parser.js";
import type {
  BodyFieldSpec,
  EndpointSpec,
  PathBuilderConfig,
  PreflightContext,
  ToolsetDefinition,
} from "../types.js";
import {
  AICR_FINDINGS_KEY,
  AICR_LINK_KEY,
  AICR_OVERVIEW_KEY,
  aicrArchiveExtract,
  aicrConventionCompact,
  aicrConventionCreateExtract,
  aicrConventionExtract,
  aicrConventionListExtract,
  aicrDisableExtract,
  aicrDismissExtract,
  aicrEnableExtract,
  aicrFindingCompact,
  aicrFindingsExtract,
  aicrGateExtract,
  aicrGateNoRepoConfig,
  aicrPolicyNoRepoConfig,
  aicrPullRequestCompact,
  aicrPullRequestListExtract,
  aicrRepositoryCompact,
  aicrRepositoryListExtract,
  aicrReviewExtract,
  aicrReviewStatusExtract,
  aicrRuleCompact,
  aicrRuleCreateExtract,
  aicrRuleExtract,
  aicrRuleListExtract,
  aicrSettingExtract,
  aicrSettingSetExtract,
  aicrRunCompact,
  aicrRunGetExtract,
  aicrRunListExtract,
  aicrUndoDismissExtract,
  AICR_GATE_CATEGORIES,
} from "../extractors.js";

/**
 * AI Code Review (AICR): the review, findings, and runs the AI Code Review
 * agent produced for a Harness Code pull request.
 *
 * Repo routes take `repo_path` (`<account>/<org>/<project>/<repo>`) as a query
 * param instead of an org/project pair; space routes take `space_path`. It is built from the account plus the
 * explicitly passed org_id / project_id / repo_id. As with `pull_request`, org
 * and project are optional (account- and org-level repos), and ambient
 * HARNESS_ORG / HARNESS_PROJECT are never used to fill them in.
 *
 * Opt-in while AI Code Review is in beta: HARNESS_TOOLSETS=aicr.
 */

const AICR_BASE = "/gateway/aicr/api/v1";
/** Onboarding v2 also records the repo's AICR config row, which gates, rules and conventions hang off. */
const AICR_V2_BASE = "/gateway/aicr/api/v2";

/** Findings fetched for aicr_review.get; also the API's max `limit`. */
const REVIEW_FINDINGS_LIMIT = 100;

function str(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/** One path segment (org, project, or repo identifier): no "/" and not "." or "..". */
function segment(
  input: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = str(input[field]);
  if (
    value !== undefined &&
    (value.includes("/") || value === "." || value === "..")
  ) {
    throw new Error(`${field} must be a single identifier, got "${value}".`);
  }
  return value;
}

/** `space_path` (`<account>[/<org>[/<project>]]`) from the account plus explicit org_id/project_id. */
export function aicrSpacePath(
  input: Record<string, unknown>,
  accountId: string | undefined,
): string {
  if (!accountId)
    throw new Error(
      "AI Code Review needs the account ID. Set HARNESS_ACCOUNT_ID or pass repo_path.",
    );
  const org = segment(input, "org_id");
  const project = segment(input, "project_id");
  if (project && !org)
    throw new Error(
      "project_id was passed without org_id. Pass both for a project.",
    );
  return [accountId, org, project].filter(Boolean).join("/");
}

/** `repo_path` from an explicit `repo_path`, or from `repo_id` plus optional explicit org/project. */
export function resolveAicrRepoPath(
  input: Record<string, unknown>,
  accountId: string | undefined,
): string {
  const explicit = str(input.repo_path);
  if (explicit) {
    const repoPath = explicit.replace(/^\/+|\/+$/g, "");
    // The token is bound to one account; another account's path fails as a bare "Unauthorized".
    const account = repoPath.split("/")[0];
    if (accountId && account !== accountId) {
      throw new Error(
        `repo_path is in account "${account}", but this server is connected to account "${accountId}".`,
      );
    }
    return repoPath;
  }

  const repo = segment(input, "repo_id");
  if (!repo) {
    throw new Error(
      "AI Code Review needs the repository: pass repo_id (with org_id/project_id for org- or project-level repos) " +
        "or repo_path. Reads also take a Harness pull request URL.",
    );
  }
  return `${aicrSpacePath(input, accountId)}/${repo}`;
}

/** Split a repo_path into its parent space and repo identifier. */
function splitAicrRepoPath(repoPath: string): {
  spacePath: string;
  repoIdentifier: string;
} {
  const cut = repoPath.lastIndexOf("/");
  if (cut <= 0)
    throw new Error(
      `repo_path must be <account>/[<org>/[<project>/]]<repo>, got "${repoPath}".`,
    );
  return {
    spacePath: repoPath.slice(0, cut),
    repoIdentifier: repoPath.slice(cut + 1),
  };
}

/** Validate `pr_number` as a positive integer and return it path-encoded. */
export function aicrPrNumber(input: Record<string, unknown>): string {
  const raw = str(input.pr_number);
  const n = Number(raw);
  if (raw === undefined || !Number.isInteger(n) || n <= 0) {
    throw new Error(
      `pr_number must be a positive integer${raw === undefined ? "" : `, got "${raw}"`}.`,
    );
  }
  return encodePathSegment(String(n));
}

const PR_LINK_TEMPLATE =
  "/ng/account/{accountId}/module/code/orgs/{org}/projects/{project}/repos/{repo}/pulls/{pr}";

/** Harness Code UI link to the PR, from repo_path segments `account/[org]/[project]/repo`. */
function aicrPrLink(
  baseUrl: string | undefined,
  repoPath: string,
  prNumber: unknown,
): string | undefined {
  const pr = str(prNumber);
  const parts = repoPath.split("/").filter(Boolean);
  if (!baseUrl || !pr || parts.length < 2 || parts.length > 4) return undefined;
  const [account, ...rest] = parts;
  const repo = rest.pop() ?? "";
  const [org = "", project = ""] = rest;
  // buildDeepLink drops the empty orgs/projects segments of account- and org-level repos.
  return buildDeepLink(baseUrl, account ?? "", PR_LINK_TEMPLATE, {
    org,
    project,
    repo,
    pr,
  });
}

/**
 * bodyBuilder for every AICR GET. Sends no body: hoists `repo_path` onto the
 * input for `queryParams` and records the PR deep link for the extractor.
 */
function hoistAicrRepoPath(
  input: Record<string, unknown>,
  config: PathBuilderConfig,
): undefined {
  const repoPath = resolveAicrRepoPath(input, config.HARNESS_ACCOUNT_ID);
  input.repo_path = repoPath;
  const link = aicrPrLink(config.HARNESS_BASE_URL, repoPath, input.pr_number);
  if (link) input[AICR_LINK_KEY] = link;
  return undefined;
}

/**
 * Preflight for the space-level lists: folds org_id/project_id into `space_path`
 * and drops them. Runs before scope params are added, so no orgIdentifier /
 * projectIdentifier is sent: with projectIdentifier set, qa0 returns an empty list.
 */
async function aicrSpacePreflight(ctx: PreflightContext): Promise<void> {
  ctx.input.space_path = aicrSpacePath(ctx.input, ctx.accountId);
  delete ctx.input.org_id;
  delete ctx.input.project_id;
}

/** `POST /pullreqs/{n}/findings/{key}/{verb}`: dismiss or undo a dismissal of one finding. */
function aicrFindingActionPath(verb: "dismiss" | "undo") {
  return (input: Record<string, unknown>): string => {
    const key = str(input.finding_key);
    if (!key)
      throw new Error(
        'Pass finding_key: the `key` of a finding from harness_list(resource_type="aicr_finding").',
      );
    return `${AICR_BASE}/pullreqs/${aicrPrNumber(input)}/findings/${encodePathSegment(key)}/${verb}`;
  };
}

/** Dismiss body `{reason, note}` from the caller's body; `repo_path` goes to the query. */
function aicrDismissBody(
  input: Record<string, unknown>,
  config: PathBuilderConfig,
): Record<string, unknown> {
  hoistAicrRepoPath(input, config);
  const body = (
    typeof input.body === "object" && input.body !== null ? input.body : {}
  ) as Record<string, unknown>;
  return {
    reason: body.reason,
    ...(body.note !== undefined ? { note: body.note } : {}),
  };
}

/** Whether the caller named a repository (repo_id or repo_path) rather than a space. */
function namesAicrRepo(input: Record<string, unknown>): boolean {
  return Boolean(str(input.repo_id) || str(input.repo_path));
}

/**
 * A space's or repository's own AICR config row (non-recursive `GET /config/space|repo`),
 * or undefined when it has none.
 */
async function aicrOwnConfig(
  ctx: PreflightContext,
  level: "space" | "repo",
  params: Record<string, string>,
): Promise<Record<string, unknown> | undefined> {
  let row: unknown;
  try {
    row = await ctx.client.request<unknown>({
      method: "GET",
      path: `${AICR_BASE}/config/${level}`,
      params,
      retryPolicy: "safe",
      signal: ctx.signal,
    });
  } catch (err) {
    // "Not Found" is a missing row; a cluster without the route answers "404 page not found".
    if (
      err instanceof HarnessApiError &&
      err.statusCode === 404 &&
      err.message.trim() === "Not Found"
    )
      return undefined;
    throw err;
  }
  return typeof row === "object" && row !== null
    ? (row as Record<string, unknown>)
    : {};
}

/** The id of a repository's own AICR config row. Gates, rules and conventions of a repository hang off it. */
async function aicrRepoConfigId(
  ctx: PreflightContext,
  repoPath: string,
): Promise<number | undefined> {
  const { spacePath, repoIdentifier } = splitAicrRepoPath(repoPath);
  const row = await aicrOwnConfig(ctx, "repo", {
    space_path: spacePath,
    repo_identifier: repoIdentifier,
  });
  if (row === undefined) return undefined;
  if (typeof row.id !== "number" || row.id <= 0)
    throw new Error(
      `AI Code Review returned no config for repository "${repoPath}". Run aicr_repository enable on it, then try again.`,
    );
  return row.id;
}

/**
 * A repository with no config row may not exist at all (the config routes do not check), so a typo
 * would read as "inherits everything". Ask Code; only its 404 counts, any other error is ignored.
 */
async function aicrCheckRepoExists(ctx: PreflightContext, repoPath: string): Promise<void> {
  const { spacePath, repoIdentifier } = splitAicrRepoPath(repoPath);
  const [, org, project] = spacePath.split("/");
  try {
    await ctx.client.request<unknown>({
      method: "GET",
      path: `/code/api/v1/repos/${encodePathSegment(repoIdentifier)}`,
      params: { ...(org ? { orgIdentifier: org } : {}), ...(project ? { projectIdentifier: project } : {}) },
      retryPolicy: "safe",
      signal: ctx.signal,
    });
  } catch (err) {
    if (err instanceof HarnessApiError && err.statusCode === 404) {
      throw new Error(
        `No repository "${repoIdentifier}" in Harness Code with ${aicrSpaceArgs(spacePath)}. ` +
          "Check repo_id and the repository's org_id/project_id.",
      );
    }
  }
}

/**
 * Reads named by repo_id (typed by the agent, or from a URL): AICR answers a wrong repo_id or org/project
 * like a repository with no review yet, so check the repository exists. A repo_path is taken as given.
 */
function aicrNamedRepoPreflight(validate: (input: Record<string, unknown>) => unknown) {
  return async (ctx: PreflightContext): Promise<void> => {
    validate(ctx.input); // bad input fails before any request
    const repoPath = resolveAicrRepoPath(ctx.input, ctx.accountId);
    if (!str(ctx.input.repo_path)) await aicrCheckRepoExists(ctx, repoPath);
  };
}

/**
 * Gates, rules and conventions are scoped by `space_path` or by the repo's config id, never both.
 * `repo_path` goes along with the id because auth reads the account from it (a 401 otherwise).
 * A repo without a config row is answered by `noRepoConfig`, the way reviews treat it.
 */
function aicrPolicyScopePreflight(noRepoConfig: (repoPath: string) => unknown) {
  return async (ctx: PreflightContext): Promise<void | { result: unknown }> => {
    const { input } = ctx;
    if (namesAicrRepo(input)) {
      const repoPath = resolveAicrRepoPath(input, ctx.accountId);
      const id = await aicrRepoConfigId(ctx, repoPath);
      if (id === undefined) {
        await aicrCheckRepoExists(ctx, repoPath);
        return { result: noRepoConfig(repoPath) };
      }
      input.repo_path = repoPath;
      input.repo_config_id = id;
    } else {
      input.space_path = aicrSpacePath(input, ctx.accountId);
    }
    delete input.org_id;
    delete input.project_id;
  };
}

function aicrNoRepoConfigError(repoPath: string): never {
  throw new Error(
    `Repository "${repoPath}" has no AI Code Review config of its own, so nothing can be set on it at repository level. ` +
      "Set it on the org or project instead, or run aicr_repository enable on the repository to create its config " +
      "(its reviews then also follow its org and project gates, rules and conventions).",
  );
}

/** `org_id="…", project_id="…"` for a space path, or "no org_id/project_id" for the account. */
function aicrSpaceArgs(spacePath: string): string {
  const [, org, project] = spacePath.split("/");
  if (!org) return "no org_id or project_id (the account)";
  return project
    ? `org_id="${org}", project_id="${project}"`
    : `org_id="${org}" and no project_id`;
}

/**
 * The server finds a rule or convention by id alone and edits it where it is set, whatever scope the
 * call names. So an edit is refused unless the caller named that scope: otherwise "update rule 5 on
 * repo A" could change a project rule for every repository, and the approval prompt would not say so.
 */
async function aicrCheckEditScope(
  ctx: PreflightContext,
  kind: "rule" | "convention",
  id: string,
): Promise<void> {
  const { input } = ctx;
  const Kind = kind === "rule" ? "Rule" : "Convention";
  const row = (await ctx.client.request<unknown>({
    method: "GET",
    path: `${AICR_BASE}/${kind}s/${encodePathSegment(id)}`,
    params: input.repo_path
      ? { repo_path: String(input.repo_path) }
      : { space_path: String(input.space_path) },
    retryPolicy: "safe",
    signal: ctx.signal,
  })) as Record<string, unknown> | undefined;
  if (typeof row !== "object" || row === null)
    throw new Error(`No ${kind} with id ${id}.`);

  if (row.overrides_id != null) {
    throw new Error(
      `Rule ${id} is a repository's override of rule ${String(row.overrides_id)}, not a rule of its own. ` +
        `Change it with execute override on rule_id "${String(row.overrides_id)}" and the same repository. ` +
        "An override cannot be updated or deleted on its own.",
    );
  }

  const rowSpace = str(row.space_path);
  const isRepoRow = row.repo_config_id != null && !rowSpace;
  const repoPath = str(input.repo_path);
  if (repoPath) {
    if (isRepoRow && row.repo_config_id === input.repo_config_id) return;
    if (isRepoRow) {
      throw new Error(
        `${Kind} ${id} is set on a different repository, not on "${repoPath}". ` +
          `List the ${kind}s of the repository it belongs to and pass that repo_id.`,
      );
    }
    const where = rowSpace ? `space "${rowSpace}"` : "a parent space";
    const change =
      kind === "rule"
        ? "To turn it off or on for this repository only, use execute override on it. "
        : "Conventions have no per-repository override. ";
    throw new Error(
      `${Kind} ${id} is set on ${where} and "${repoPath}" inherits it, so changing it here would change it for every repository under that space. ` +
        change +
        (rowSpace
          ? `To change it everywhere, pass ${aicrSpaceArgs(rowSpace)} and no repo_id.`
          : ""),
    );
  }

  const spacePath = String(input.space_path);
  if (rowSpace === spacePath) return;
  throw new Error(
    rowSpace
      ? `${Kind} ${id} is set on space "${rowSpace}", not on "${spacePath}". Pass ${aicrSpaceArgs(rowSpace)} to change it there.`
      : `${Kind} ${id} is set on a repository, not on space "${spacePath}". Pass that repository's repo_id (with its org_id/project_id).`,
  );
}

/**
 * Rules and conventions by id. The server checks access on the row's own space or repository, so the
 * caller's scope (the account if none) is sent only for auth. A named repository's config id is
 * looked up so the result can say whether a repository row is that repository's. Edits must name the
 * row's own scope (aicrCheckEditScope).
 */
function aicrPolicyByIdPreflight(
  kind: "rule" | "convention",
  edit: boolean,
  body?: { fields: readonly string[]; op: string },
) {
  return async (ctx: PreflightContext): Promise<void> => {
    const { input } = ctx;
    // A bad body fails before any request, not after the scope lookups.
    if (body) pickAicrBody(input, body.fields, body.op);
    if (namesAicrRepo(input)) {
      const repoPath = resolveAicrRepoPath(input, ctx.accountId);
      input.repo_path = repoPath;
      const configId = await aicrRepoConfigId(ctx, repoPath);
      if (configId !== undefined) input.repo_config_id = configId;
    } else {
      input.space_path = aicrSpacePath(input, ctx.accountId);
    }
    delete input.org_id;
    delete input.project_id;
    const id = str(input[`${kind}_id`]);
    if (edit && id) await aicrCheckEditScope(ctx, kind, id);
  };
}

async function aicrRuleOverridePreflight(ctx: PreflightContext): Promise<void> {
  if (!namesAicrRepo(ctx.input)) {
    throw new Error(
      "override applies to one repository: pass repo_id (with its org_id/project_id) or repo_path.",
    );
  }
  await aicrPolicyScopePreflight(aicrNoRepoConfigError)(ctx);
}

type AicrFieldKind = "string" | "boolean" | "strings" | "status";
const AICR_FIELD_KINDS: Record<string, AicrFieldKind> = {
  title: "string", description: "string", body: "string",
  enabled: "boolean", overridable: "boolean",
  paths: "strings", languages: "strings", repos: "strings",
  status: "status",
};
const AICR_KIND_COPY: Record<AicrFieldKind, string> = {
  string: "a string", boolean: "true or false", strings: "an array of strings", status: '"active" or "archived"',
};

function aicrFieldOk(kind: AicrFieldKind, v: unknown): boolean {
  switch (kind) {
    case "string": return typeof v === "string";
    case "boolean": return typeof v === "boolean";
    case "strings": return Array.isArray(v) && v.every((x) => typeof x === "string");
    case "status": return v === "active" || v === "archived";
  }
}

/** Only the named fields of the caller's body, each checked for its type; scope travels in the query. */
function pickAicrBody(
  input: Record<string, unknown>,
  fields: readonly string[],
  op: string,
): Record<string, unknown> {
  const body = (
    typeof input.body === "object" && input.body !== null ? input.body : {}
  ) as Record<string, unknown>;
  const out = Object.fromEntries(
    fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]),
  );
  if (Object.keys(out).length === 0)
    throw new Error(`${op} needs at least one of: ${fields.join(", ")}.`);
  for (const [k, v] of Object.entries(out)) {
    const kind = AICR_FIELD_KINDS[k];
    if (kind && !aicrFieldOk(kind, v)) throw new Error(`${k} must be ${AICR_KIND_COPY[kind]}.`);
  }
  return out;
}

const AICR_RULE_CREATE_FIELDS = [
  "title",
  "description",
  "enabled",
  "overridable",
  "paths",
] as const;
const AICR_RULE_UPDATE_FIELDS = [...AICR_RULE_CREATE_FIELDS, "status"] as const;
const AICR_CONVENTION_CREATE_FIELDS = [
  "title",
  "body",
  "enabled",
  "languages",
  "repos",
  "paths",
] as const;
const AICR_CONVENTION_UPDATE_FIELDS = [
  ...AICR_CONVENTION_CREATE_FIELDS,
  "status",
] as const;

const AICR_GATE_FAIL_AT = ["never", "critical", "major_and_above", "any"];

/**
 * `PUT /gates` saves each entry whole, and a missing `reported` is false (off, and at a space,
 * off for everything under it), so each entry must name all three fields.
 */
function aicrGateBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = (
    typeof input.body === "object" && input.body !== null ? input.body : {}
  ) as Record<string, unknown>;
  const categories = body.categories;
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error(
      "set needs body.categories: [{category, reported, fail_at}, ...] for the categories to change.",
    );
  }
  return {
    categories: categories.map((entry, i) => {
      const c = (
        typeof entry === "object" && entry !== null ? entry : {}
      ) as Record<string, unknown>;
      const category = typeof c.category === "string" ? c.category.trim().toLowerCase() : "";
      const failAt = typeof c.fail_at === "string" ? c.fail_at.trim().toLowerCase() : "";
      if (
        !AICR_GATE_CATEGORIES.includes(category) ||
        typeof c.reported !== "boolean" ||
        !AICR_GATE_FAIL_AT.includes(failAt)
      ) {
        throw new Error(
          `categories[${i}] needs category (${AICR_GATE_CATEGORIES.join(", ")}), reported (true or false) ` +
            `and fail_at (${AICR_GATE_FAIL_AT.join(", ")}).`,
        );
      }
      return { category, reported: c.reported, fail_at: failAt };
    }),
  };
}

/**
 * Config routes take a space as `space_path`, and a repository as its parent `space_path` plus
 * `repo_identifier` (not repo_path or a config id).
 */
async function aicrConfigScopePreflight(ctx: PreflightContext): Promise<void> {
  const { input } = ctx;
  if (namesAicrRepo(input)) {
    const repoPath = resolveAicrRepoPath(input, ctx.accountId);
    const { spacePath, repoIdentifier } = splitAicrRepoPath(repoPath);
    Object.assign(input, {
      repo_path: repoPath,
      space_path: spacePath,
      repo_identifier: repoIdentifier,
    });
  } else {
    input.space_path = aicrSpacePath(input, ctx.accountId);
  }
  delete input.org_id;
  delete input.project_id;
}

function aicrConfigPath(input: Record<string, unknown>): string {
  return `${AICR_BASE}/config/${namesAicrRepo(input) ? "repo" : "space"}`;
}

/** The merged config the set preflight builds; the bodyBuilder sends it. */
const AICR_SETTING_BODY_KEY = "_aicr_setting_body";
const AICR_SETTING_FIELDS = [
  "review_triggers",
  "dismissable",
  "llm_connector_ref",
  "add_paths",
  "remove_paths",
];
const AICR_TRIGGERS = ["on_pr_open", "on_push", "drafts"];

interface AicrConfigPath {
  pattern: string;
  type: string;
  source?: string;
}

const aicrPathKey = (p: AicrConfigPath) => `${p.type}:${p.pattern}`;

function aicrPathList(value: unknown, field: string): AicrConfigPath[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error(`${field} must be an array of {pattern, type}.`);
  return value.map((entry, i) => {
    const p = (
      typeof entry === "object" && entry !== null ? entry : {}
    ) as Record<string, unknown>;
    if (typeof p.pattern !== "string" || !p.pattern || (p.type !== "excluded" && p.type !== "tests")) {
      throw new Error(
        `${field}[${i}] needs pattern (a glob from the repository root) and type (excluded or tests).`,
      );
    }
    return { pattern: p.pattern, type: p.type };
  });
}

/** The caller's change, checked before any request. null on a trigger, dismissable or llm_connector_ref inherits. */
function aicrSettingChange(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const body = (
    typeof input.body === "object" && input.body !== null ? input.body : {}
  ) as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length === 0)
    throw new Error(
      `set needs at least one of: ${AICR_SETTING_FIELDS.join(", ")}.`,
    );
  const unknown = keys.filter((k) => !AICR_SETTING_FIELDS.includes(k));
  if (unknown.length > 0)
    throw new Error(
      `set does not take ${unknown.join(", ")}. It takes: ${AICR_SETTING_FIELDS.join(", ")}.`,
    );

  const boolOrNull = (v: unknown) => typeof v === "boolean" || v === null;
  if (body.review_triggers !== undefined) {
    const t = body.review_triggers;
    if (
      typeof t !== "object" ||
      t === null ||
      Array.isArray(t) ||
      Object.entries(t).some(
        ([k, v]) => !AICR_TRIGGERS.includes(k) || !boolOrNull(v),
      )
    ) {
      throw new Error(
        `review_triggers takes ${AICR_TRIGGERS.join(", ")}, each true, false or null (inherit).`,
      );
    }
  }
  if (body.dismissable !== undefined && !boolOrNull(body.dismissable)) {
    throw new Error("dismissable must be true, false or null (inherit).");
  }
  if (
    body.llm_connector_ref !== undefined &&
    body.llm_connector_ref !== null &&
    typeof body.llm_connector_ref !== "string"
  ) {
    throw new Error(
      "llm_connector_ref must be a connector reference string, or null (inherit).",
    );
  }
  aicrPathList(body.add_paths, "add_paths");
  aicrPathList(body.remove_paths, "remove_paths");
  return body;
}

/**
 * `PUT /config/space|repo` saves the scope whole: a field left out is cleared and then inherits.
 * So the change is applied to the scope's own row. Inherited values are not copied onto it, and a
 * space's model connector and the review agent's MCP servers stay as they are unless changed.
 */
function mergeAicrSetting(
  own: Record<string, unknown>,
  change: Record<string, unknown>,
  scope: string,
  isRepo: boolean,
): Record<string, unknown> {
  const ownTriggers = (own.review_triggers ?? {}) as Record<string, unknown>;
  const newTriggers = (change.review_triggers ?? {}) as Record<string, unknown>;
  const review_triggers = Object.fromEntries(
    AICR_TRIGGERS.map((k) => [
      k,
      k in newTriggers ? newTriggers[k] : (ownTriggers[k] ?? null),
    ]),
  );
  const dismissable =
    "dismissable" in change ? change.dismissable : (own.dismissable ?? null);

  const paths: AicrConfigPath[] = (
    Array.isArray(own.paths) ? own.paths : []
  ).map((entry) => {
    const p = entry as Record<string, unknown>;
    return {
      pattern: String(p.pattern),
      type: String(p.type),
      ...(p.source ? { source: String(p.source) } : {}),
    };
  });
  aicrPathList(change.remove_paths, "remove_paths").forEach((p, i) => {
    const at = paths.findIndex((q) => aicrPathKey(q) === aicrPathKey(p));
    if (at < 0) {
      throw new Error(
        `remove_paths[${i}] (${p.type} "${p.pattern}") is not set on ${scope}. ` +
          "If get shows it from a parent space, remove it there (paths add up down the chain, so a repository " +
          "cannot drop a parent's path); otherwise it is not set anywhere.",
      );
    }
    paths.splice(at, 1);
  });
  for (const p of aicrPathList(change.add_paths, "add_paths")) {
    if (!paths.some((q) => aicrPathKey(q) === aicrPathKey(p))) paths.push(p);
  }

  const body = { review_triggers, dismissable, paths };
  if (isRepo) return body;
  const llmConnectorRef =
    "llm_connector_ref" in change
      ? (change.llm_connector_ref ?? "")
      : (own.llm_connector_ref ?? "");
  return {
    llm_connector_ref: llmConnectorRef,
    mcp_servers: own.mcp_servers ?? {},
    ...body,
  };
}

async function aicrSettingSetPreflight(ctx: PreflightContext): Promise<void> {
  const { input } = ctx;
  const change = aicrSettingChange(input);
  await aicrConfigScopePreflight(ctx);
  const repoPath =
    typeof input.repo_path === "string" ? input.repo_path : undefined;
  const spacePath = String(input.space_path);
  if (repoPath && "llm_connector_ref" in change) {
    throw new Error(
      "llm_connector_ref is set on a space (the account, an org or a project), not on a repository.",
    );
  }
  const own = repoPath
    ? await aicrOwnConfig(ctx, "repo", {
        space_path: spacePath,
        repo_identifier: String(input.repo_identifier),
      })
    : await aicrOwnConfig(ctx, "space", { space_path: spacePath });
  // A space without a row gets one on PUT; a repository's is created by enable.
  if (own === undefined && repoPath) {
    await aicrCheckRepoExists(ctx, repoPath);
    aicrNoRepoConfigError(repoPath);
  }
  input[AICR_SETTING_BODY_KEY] = mergeAicrSetting(
    own ?? {},
    change,
    repoPath ?? spacePath,
    Boolean(repoPath),
  );
}

/**
 * Enable/disable address the repo by `repo_path`, and enable also by its parent `space_path`
 * (as the Harness Code repo setting does). org_id/project_id go into those paths only.
 */
async function aicrRepoActionPreflight(ctx: PreflightContext): Promise<void> {
  const { input } = ctx;
  const repoPath = resolveAicrRepoPath(input, ctx.accountId);
  input.repo_path = repoPath;
  input.space_path = splitAicrRepoPath(repoPath).spacePath;
  delete input.org_id;
  delete input.project_id;
}

/** Findings of one run when `run_id` is given, else of the PR's latest successful run. */
function aicrFindingsPath(input: Record<string, unknown>): string {
  const runId = str(input.run_id);
  if (runId) return `${AICR_BASE}/runs/${encodePathSegment(runId)}/findings`;
  if (input.pr_number === undefined)
    throw new Error(
      "Pass pr_number (latest review) or run_id (one run) to list findings.",
    );
  return `${AICR_BASE}/pullreqs/${aicrPrNumber(input)}/findings`;
}

/**
 * aicr_review.get makes the `GET /review` call (criteria checks) itself; this
 * fetches the overview and findings alongside it. Either may fail on its own
 * (overview needs policy view at space level; a PR may have no overview yet)
 * without hiding the checks, so failures go to the extractor instead of throwing.
 */
async function aicrReviewPreflight(ctx: PreflightContext): Promise<void> {
  const { input } = ctx;
  const pr = aicrPrNumber(input);
  const typedRepo = !str(input.repo_path);
  const repoPath = resolveAicrRepoPath(input, ctx.accountId);
  input.repo_path = repoPath;

  const get = (path: string, params: Record<string, string | number>) =>
    ctx.client.request<unknown>({
      method: "GET",
      path,
      params,
      retryPolicy: "safe",
      signal: ctx.signal,
    });
  const settle = (r: PromiseSettledResult<unknown>) =>
    r.status === "fulfilled"
      ? { ok: true, value: r.value }
      : {
          ok: false,
          error:
            r.reason instanceof Error ? r.reason.message : String(r.reason),
        };

  const [exists, overview, findings] = await Promise.allSettled([
    typedRepo ? aicrCheckRepoExists(ctx, repoPath) : Promise.resolve(),
    get(`${AICR_BASE}/pullreqs/${pr}/overview`, { repo_path: repoPath }),
    get(`${AICR_BASE}/pullreqs/${pr}/findings`, {
      repo_path: repoPath,
      page: 1,
      limit: REVIEW_FINDINGS_LIMIT,
    }),
  ]);
  if (exists.status === "rejected") throw exists.reason;
  input[AICR_OVERVIEW_KEY] = settle(overview);
  input[AICR_FINDINGS_KEY] = settle(findings);
}

// ---------------------------------------------------------------------------
// Approval prompt notes: what a write changes and where, from the call's input
// (before preflight, no requests). A call the preflight will refuse may get a vague note.
// ---------------------------------------------------------------------------

const AICR_NOTE_MAX_CHARS = 600;

interface AicrNoteTarget {
  /** e.g. `project acme/web`, `repository demo in org acme`, `the account`. */
  where: string;
  repo: boolean;
  /** The space level the repository or space sits at. */
  level: "account" | "org" | "project";
}

function aicrNoteTarget(input: Record<string, unknown>): AicrNoteTarget {
  // Same precedence as resolveAicrRepoPath: repo_path wins over repo_id.
  const repoPath = str(input.repo_path)?.replace(/^\/+|\/+$/g, "");
  if (repoPath) {
    const depth = repoPath.split("/").length;
    return { where: `repository ${repoPath}`, repo: true, level: depth >= 4 ? "project" : depth === 3 ? "org" : "account" };
  }
  const org = str(input.org_id);
  const project = str(input.project_id);
  const level = project ? "project" : org ? "org" : "account";
  const space = project ? `project ${org ? `${org}/` : ""}${project}` : org ? `org ${org}` : "the account";
  const repo = str(input.repo_id);
  if (repo) return { where: `repository ${repo} ${level === "account" ? "at account level" : `in ${space}`}`, repo: true, level };
  return { where: space, repo: false, level };
}

function aicrNoteBody(input: Record<string, unknown>): Record<string, unknown> {
  return (typeof input.body === "object" && input.body !== null && !Array.isArray(input.body) ? input.body : {}) as Record<string, unknown>;
}

function aicrNoteValue(value: unknown): string {
  if (value === null) return "inherit";
  if (Array.isArray(value)) {
    return value
      .map((p) => (typeof p === "object" && p !== null ? `${String((p as Record<string, unknown>).pattern)} (${String((p as Record<string, unknown>).type)})` : String(p)))
      .join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k} ${v === null ? "inherit" : String(v)}`).join(", ");
  }
  return String(value);
}

function aicrNote(text: string): string {
  return text.length <= AICR_NOTE_MAX_CHARS ? text : `${text.slice(0, AICR_NOTE_MAX_CHARS)}...`;
}

/** Whose pull requests a space or repository setting reaches. */
function aicrNoteReach(t: AicrNoteTarget): string {
  return t.repo ? "its pull requests" : "pull requests of every repository under it";
}

function aicrGateSetNote(input: Record<string, unknown>): string {
  const t = aicrNoteTarget(input);
  const categories = aicrNoteBody(input).categories;
  const parts = (Array.isArray(categories) ? categories : [])
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => `${String(c.category)} ${c.reported === false ? "not reported" : `fails at ${String(c.fail_at)}`}`);
  return aicrNote(
    `Sets the merge gate of ${t.where}${parts.length ? `: ${parts.join("; ")}` : ""}. ` +
      `Categories not listed keep their setting. Applies to ${aicrNoteReach(t)}.`,
  );
}

function aicrSettingSetNote(input: Record<string, unknown>): string {
  const t = aicrNoteTarget(input);
  const body = aicrNoteBody(input);
  const parts = AICR_SETTING_FIELDS.filter((f) => body[f] !== undefined).map((f) => `${f}: ${aicrNoteValue(body[f])}`);
  return aicrNote(
    `Changes the AI Code Review settings of ${t.where}${parts.length ? `: ${parts.join("; ")}` : ""}. ` +
      `Other settings stay as they are. Applies to reviews of ${aicrNoteReach(t)}.`,
  );
}

function aicrPolicyCreateNote(kind: "rule" | "convention") {
  return (input: Record<string, unknown>): string => {
    const t = aicrNoteTarget(input);
    return kind === "rule"
      ? `Creates this rule on ${t.where}: reviews check ${aicrNoteReach(t)} against it, and a failed rule fails the Team rules check.`
      : `Creates this convention on ${t.where}: reviews follow it on ${aicrNoteReach(t)}.`;
  };
}

function aicrPolicyArchiveText(kind: "rule" | "convention", where: string): string {
  return `Archives the ${kind} on ${where}: reviews stop using it in every repository that inherits it. Update with status active restores it.`;
}

function aicrPolicyUpdateNote(kind: "rule" | "convention") {
  return (input: Record<string, unknown>): string => {
    const { where } = aicrNoteTarget(input);
    const status = aicrNoteBody(input).status;
    if (status === "archived") return aicrPolicyArchiveText(kind, where);
    if (status === "active") return `Restores the ${kind} on ${where}: reviews use it again in every repository that inherits it.`;
    return `Changes the ${kind} on ${where}; every repository that inherits it gets the change.`;
  };
}

function aicrPolicyDeleteNote(kind: "rule" | "convention") {
  return (input: Record<string, unknown>): string => aicrPolicyArchiveText(kind, aicrNoteTarget(input).where);
}

function aicrRuleOverrideNote(input: Record<string, unknown>): string | undefined {
  const t = aicrNoteTarget(input);
  if (!t.repo) return undefined;
  const enabled = aicrNoteBody(input).enabled;
  const rule = str(input.rule_id);
  const what = `rule${rule ? ` ${rule}` : ""}`;
  return typeof enabled === "boolean"
    ? `Turns ${what} ${enabled ? "on" : "off"} for ${t.where} only; other repositories keep the rule as it is.`
    : `Overrides ${what} for ${t.where} only.`;
}

function aicrEnableNote(input: Record<string, unknown>): string | undefined {
  const t = aicrNoteTarget(input);
  if (!t.repo) return undefined;
  const pipelines =
    t.level === "project"
      ? "its project's AI Code Review pipeline (creating the pipeline if missing)"
      : `the AI Code Review pipeline of every project under the ${t.level} (creating pipelines if missing)`;
  return `Enables AI Code Review on ${t.where}: adds a pull request trigger to ${pipelines}, so new pull request commits are reviewed.`;
}

function aicrDisableNote(input: Record<string, unknown>): string | undefined {
  const t = aicrNoteTarget(input);
  if (!t.repo) return undefined;
  return (
    `Disables AI Code Review on ${t.where}: deletes its pull request triggers and the gates, rules, rule overrides and conventions set on it. ` +
    "Enabling it again does not restore them."
  );
}

function aicrDismissNote(input: Record<string, unknown>): string | undefined {
  const t = aicrNoteTarget(input);
  if (!t.repo) return undefined;
  const key = str(input.finding_key);
  const pr = str(input.pr_number);
  const reason = str(aicrNoteBody(input).reason);
  return aicrNote(
    `Dismisses finding${key ? ` ${key}` : ""}${pr ? ` on pull request #${pr}` : ""} of ${t.where}${reason ? ` (reason: ${reason})` : ""}: ` +
      "it no longer fails the AI Code Review check. undo_dismiss reopens it.",
  );
}

const REPO_PARAM_FIELDS = [
  {
    name: "repo_id",
    required: false,
    description:
      "Repository identifier. Required unless repo_path is given (reads also take a Harness PR URL).",
  },
  {
    name: "org_id",
    required: false,
    description:
      "Org of an org- or project-level repository. The configured default (HARNESS_ORG/HARNESS_PROJECT) is not used.",
  },
  {
    name: "project_id",
    required: false,
    description:
      "Project of a project-level repository (needs org_id). The configured default (HARNESS_ORG/HARNESS_PROJECT) is not used.",
  },
  {
    name: "repo_path",
    required: false,
    description:
      "Full path <account>/<org>/<project>/<repo>; overrides repo_id/org_id/project_id.",
  },
];

const PR_PARAM_FIELDS = [
  ...REPO_PARAM_FIELDS,
  { name: "pr_number", required: true, description: "Pull request number." },
];

const FINDING_KEY_FIELD = {
  name: "finding_key",
  required: true,
  description: "The finding's `key` from aicr_finding.",
};

const SPACE_PARAM_FIELDS = [
  {
    name: "org_id",
    required: false,
    description:
      "Limit to an org. Omit for the whole account. The configured default (HARNESS_ORG/HARNESS_PROJECT) is not used.",
  },
  {
    name: "project_id",
    required: false,
    description:
      "Limit to a project (needs org_id). The configured default (HARNESS_ORG/HARNESS_PROJECT) is not used.",
  },
];

/** Gates, rules and conventions: a repository (repo_id/repo_path) or a space (org_id/project_id, or the account). */
const POLICY_SCOPE_FIELDS = [
  {
    name: "repo_id",
    required: false,
    description: "Repository identifier. Omit for a space.",
  },
  ...SPACE_PARAM_FIELDS,
  {
    name: "repo_path",
    required: false,
    description:
      "Full path <account>/<org>/<project>/<repo>; overrides repo_id/org_id/project_id.",
  },
];

const RULE_ID_FIELD = {
  name: "rule_id",
  required: true,
  description: 'Rule id from harness_list(resource_type="aicr_rule").',
};

const CONVENTION_ID_FIELD = {
  name: "convention_id",
  required: true,
  description:
    'Convention id from harness_list(resource_type="aicr_convention").',
};

const CONVENTION_BODY_FIELDS: BodyFieldSpec[] = [
  {
    name: "title",
    type: "string",
    required: false,
    description:
      'Short name, e.g. "Errors are wrapped with context". Required on create.',
  },
  {
    name: "body",
    type: "string",
    required: false,
    description:
      "The convention the reviewer follows, in plain text or markdown",
  },
  {
    name: "enabled",
    type: "boolean",
    required: false,
    description: "Given to reviews (default true)",
  },
  {
    name: "languages",
    type: "array",
    required: false,
    description: "Languages it is about, up to 50",
  },
  {
    name: "repos",
    type: "array",
    required: false,
    description: "Repositories it is about, up to 50",
  },
  {
    name: "paths",
    type: "array",
    required: false,
    description: "Path globs it is about, up to 50",
  },
];

const RULE_BODY_FIELDS: BodyFieldSpec[] = [
  {
    name: "title",
    type: "string",
    required: false,
    description:
      'What the rule requires, e.g. "Every handler logs the request id". Required on create.',
  },
  {
    name: "description",
    type: "string",
    required: false,
    description: "Details for the reviewer, up to 1000 characters",
  },
  {
    name: "enabled",
    type: "boolean",
    required: false,
    description: "Checked in reviews (default true)",
  },
  {
    name: "overridable",
    type: "boolean",
    required: false,
    description:
      "Repositories under the space may turn it off (default false: required)",
  },
  {
    name: "paths",
    type: "array",
    required: false,
    description: "Path globs, up to 50",
  },
];

const SPACE_LIST_QUERY = {
  space_path: "space_path",
  query: "query",
  page: "page",
  size: "limit",
};

const DIAGNOSTIC_HINT =
  "Not Found usually means a wrong repo_id, pr_number, or org_id/project_id: pass the repository's own org_id and project_id " +
  "(the configured default is not used), or its repo_path. AI Code Review must also be enabled on the repository, and the user needs view access to it. " +
  "A 'page not found' 404 means this Harness cluster's AI Code Review does not support the request yet.";

/** Rules and conventions belong to a space or repository; a 404 by id is just a missing row. */
const POLICY_DIAGNOSTIC_HINT =
  "Ids come from harness_list on the same resource type; Not Found means no row has that id. " +
  "To view or edit a space's rows the user needs AI Code Review policy access there, or repository view/edit for a repository's. " +
  "Pass the org_id/project_id or repo_id the row is set on; the configured default is not used.";

const RELATED_PR = {
  resourceType: "pull_request",
  relationship: "reviews",
  description:
    "The Harness Code pull request under review. Same repo_id and pr_number.",
};

const AICR_URL_WRITE_ERROR =
  "AI Code Review writes don't take a Harness URL: the URL's last id (e.g. the PR number) would land on the " +
  "wrong field (finding_key, rule_id, convention_id, repo_id). Pass the ids in params instead, e.g. " +
  "params: {repo_id, pr_number, finding_key} or {repo_id, rule_id}. To get the ids from a URL, read it first " +
  "(harness_get / harness_list accept url).";

/**
 * The ids the URL names, for the error message only (never used for the write): the agent copies them
 * instead of guessing (e.g. a PR read's numeric source_repo_id is not repo_id).
 */
function aicrIdsFromUrl(url: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = parseHarnessUrl(url) as unknown as Record<string, unknown>;
  } catch {
    return "";
  }
  const ids = ["org_id", "project_id", "repo_id", "pr_number"]
    .filter((field) => str(parsed[field]))
    .map((field) => `${field}=${String(parsed[field])}`);
  return ids.length
    ? ` From your URL: ${ids.join(", ")}. Retry without url: org_id and project_id as arguments, the rest in params (plus finding_key / rule_id / convention_id if the action needs one).`
    : "";
}

/**
 * Refuse a `url` on every AICR write (create, update, delete, execute actions).
 *
 * The shared URL parser sets resource_id to the URL's last id, and the write tools copy resource_id
 * onto this resource's identifier. A PR URL therefore turns into finding_key / rule_id / repo_id "7"
 * and the write hits the wrong item. Ids passed in params are never rewritten that way, so writes
 * take ids only through params. Reads keep accepting URLs.
 *
 * TODO(shared): remove this guard once the shared write tools stop trusting a URL's last id for a
 * different resource type: applyExecuteActionTargetRemap (src/tools/harness-execute.ts) must not
 * overwrite a field the caller set, and a URL-derived resource_id (execute, harness_update,
 * harness_delete) should only fill the identifier when the URL names the same resource type. That
 * fix touches pr_comment, pipeline run/import/retry and FME, so it needs their owners' sign-off.
 */
function refuseUrlOnAicrWrites(toolset: ToolsetDefinition): ToolsetDefinition {
  const guard = (spec: EndpointSpec | undefined): void => {
    if (!spec) return;
    const inner = spec.preflight;
    spec.preflight = async (ctx) => {
      const url = str(ctx.input.url);
      if (url) throw new Error(AICR_URL_WRITE_ERROR + aicrIdsFromUrl(url));
      return inner?.(ctx);
    };
  };
  for (const resource of toolset.resources) {
    guard(resource.operations.create);
    guard(resource.operations.update);
    guard(resource.operations.delete);
    // Read actions (review_status) change nothing, so they take a URL like the other reads.
    for (const action of Object.values(resource.executeActions ?? {})) {
      if (action.operationPolicy?.risk !== "read") guard(action);
    }
  }
  return toolset;
}

export const aicrToolset: ToolsetDefinition = refuseUrlOnAicrWrites({
  name: "aicr",
  displayName: "AI Code Review",
  description:
    "AI Code Review for Harness Code pull requests: review (get, request, status), findings (dismiss and undo), review runs, repositories, merge gates, team rules, coding conventions and settings",
  optIn: true,
  resources: [
    {
      resourceType: "aicr_review",
      displayName: "AI Code Review",
      description:
        "Latest AI Code Review of a pull request: criteria checks, overview (risk, status, summary), finding counts, and up to 100 open issues. " +
        "Pass repo_id + pr_number (with the repo's org_id/project_id) or a Harness PR URL. " +
        "Execute request_review to review the PR's current commit now, and review_status to follow it. " +
        "Grade, score, and per-issue gate results are not exposed by the API yet.",
      toolset: "aicr",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "pr_number"],
      diagnosticHint: DIAGNOSTIC_HINT,
      searchAliases: ["ai code review", "aicr"],
      relatedResources: [
        RELATED_PR,
        {
          resourceType: "aicr_finding",
          relationship: "contains",
          description: "All findings of the review, with filters and paging.",
        },
        {
          resourceType: "aicr_run",
          relationship: "produced_by",
          description: "Review runs and their status.",
        },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${AICR_BASE}/pullreqs/{prNumber}/review`,
          pathBuilder: (input) =>
            `${AICR_BASE}/pullreqs/${aicrPrNumber(input)}/review`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrReviewPreflight,
          bodyBuilder: hoistAicrRepoPath,
          queryParams: { repo_path: "repo_path" },
          responseExtractor: aicrReviewExtract,
          description:
            "Get the latest AI Code Review. If the overview or findings fail to load, the error is reported under `unavailable` and the checks are still returned.",
          paramsSchema: { fields: PR_PARAM_FIELDS },
        },
      },
      executeActions: {
        request_review: {
          method: "POST",
          path: `${AICR_BASE}/pullreqs/{prNumber}/review/start`,
          pathBuilder: (input) =>
            `${AICR_BASE}/pullreqs/${aicrPrNumber(input)}/review/start`,
          // Starts the repo's AI Code Review pipeline as the caller. A retry after a lost response
          // could start a second pipeline, so it is never retried.
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: aicrNamedRepoPreflight(aicrPrNumber),
          bodyBuilder: hoistAicrRepoPath,
          queryParams: { repo_path: "repo_path" },
          responseExtractor: aicrReviewStatusExtract,
          actionDescription:
            "Start an AI Code Review of the pull request's current commit, run by the repo's AI Code Review pipeline as you. " +
            "Works only for an open PR in a project repository with AI Code Review enabled. " +
            "If a review of that commit is already running, that one is returned and no new one starts. " +
            "Returns status running with the run; follow it with review_status.",
          paramsSchema: { fields: PR_PARAM_FIELDS },
        },
        review_status: {
          method: "GET",
          path: `${AICR_BASE}/pullreqs/{prNumber}/review/status`,
          pathBuilder: (input) =>
            `${AICR_BASE}/pullreqs/${aicrPrNumber(input)}/review/status`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrNamedRepoPreflight(aicrPrNumber),
          bodyBuilder: hoistAicrRepoPath,
          queryParams: { repo_path: "repo_path" },
          responseExtractor: aicrReviewStatusExtract,
          actionDescription:
            "Status of the pull request's latest review run: running, success, failure, or none. " +
            "Read-only, takes a Harness PR URL. run.head_sha is the commit reviewed; if the PR has newer commits, request_review again. " +
            "A running review whose pipeline has ended is marked failed here, when you can edit reviews.",
          paramsSchema: { fields: PR_PARAM_FIELDS },
        },
      },
    },
    {
      resourceType: "aicr_finding",
      displayName: "AI Code Review Finding",
      description:
        "Issues found by AI Code Review, with status open or dismissed: from a pull request's latest successful review (pr_number), " +
        "or from one review run (run_id, from aicr_run). List only; pass repo_id (with the repo's org_id/project_id) or a Harness PR URL.",
      toolset: "aicr",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "pr_number", "finding_key"],
      diagnosticHint: DIAGNOSTIC_HINT,
      relatedResources: [RELATED_PR],
      compactItem: aicrFindingCompact,
      listFilterFields: [
        {
          name: "severity",
          description: "Severity; comma-separate several",
          enum: ["critical", "major", "minor"],
        },
        {
          name: "category",
          description: "Category; comma-separate several",
          enum: ["reliability", "security", "complexity", "hygiene"],
        },
        {
          name: "source",
          description: "Finding source",
          enum: ["ai", "static"],
        },
        { name: "path", description: "A file path, or a directory for everything under it" },
        {
          name: "language",
          description: "Language (e.g. go, python); comma-separate several",
        },
        {
          name: "include_duplicates",
          description: "Include findings marked as duplicates (default false)",
          type: "boolean",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${AICR_BASE}/pullreqs/{prNumber}/findings`,
          pathBuilder: aicrFindingsPath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrNamedRepoPreflight(aicrFindingsPath),
          bodyBuilder: hoistAicrRepoPath,
          pageOneIndexed: true,
          queryParams: {
            repo_path: "repo_path",
            severity: "severity",
            category: "category",
            source: "source",
            path: "path",
            language: "language",
            include_duplicates: "include_duplicates",
            page: "page",
            size: "limit",
          },
          responseExtractor: aicrFindingsExtract,
          description:
            "List findings with key, severity, category, location, status, and dismissal. " +
            "A result with `note` means no review has completed yet; do not report it as 'no issues'.",
          paramsSchema: {
            fields: [
              ...REPO_PARAM_FIELDS,
              {
                name: "pr_number",
                required: false,
                description:
                  "Pull request number: findings of its latest successful review.",
              },
              {
                name: "run_id",
                required: false,
                description:
                  "Run ID from aicr_run: findings of that run. Used instead of pr_number.",
              },
            ],
          },
        },
      },
      executeActions: {
        dismiss: {
          method: "POST",
          path: `${AICR_BASE}/pullreqs/{prNumber}/findings/{findingKey}/dismiss`,
          pathBuilder: aicrFindingActionPath("dismiss"),
          // A dismissed finding no longer counts against the gate, so this can let a PR merge.
          operationPolicy: {
            risk: "medium_write",
            retryPolicy: "do_not_retry",
          },
          bodyBuilder: aicrDismissBody,
          skipScopeBodyInjection: true,
          queryParams: { repo_path: "repo_path" },
          responseExtractor: aicrDismissExtract,
          confirmNote: aicrDismissNote,
          actionDescription:
            "Dismiss one finding of a pull request's latest review. A dismissed finding no longer fails the AI Code Review check, " +
            "and the dismissal carries over to later runs. Fails if the finding is already dismissed or not in the latest review.",
          paramsSchema: { fields: [...PR_PARAM_FIELDS, FINDING_KEY_FIELD] },
          bodySchema: {
            description: "Why the finding is dismissed",
            fields: [
              {
                name: "reason",
                type: "string",
                required: true,
                description:
                  "not_a_real_problem, intended_behaviour, or accepted_risk",
              },
              {
                name: "note",
                type: "string",
                required: false,
                description: "Free-text note, up to 1000 characters",
              },
            ],
          },
        },
        undo_dismiss: {
          method: "POST",
          path: `${AICR_BASE}/pullreqs/{prNumber}/findings/{findingKey}/undo`,
          pathBuilder: aicrFindingActionPath("undo"),
          // Bodyless and reversible; reopening a finding can only make the gate stricter.
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: hoistAicrRepoPath,
          queryParams: { repo_path: "repo_path" },
          responseExtractor: aicrUndoDismissExtract,
          actionDescription:
            "Undo the dismissal of a finding, so it is open and counts against the check again. Fails if it is not dismissed.",
          paramsSchema: { fields: [...PR_PARAM_FIELDS, FINDING_KEY_FIELD] },
        },
      },
    },
    {
      resourceType: "aicr_run",
      displayName: "AI Code Review Run",
      description:
        "AI Code Review runs of a pull request (pending, running, success, error, cancelled). " +
        "List needs repo_id + pr_number; get needs repo_id + run_id. Token and cost usage is omitted.",
      toolset: "aicr",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "run_id"],
      diagnosticHint: DIAGNOSTIC_HINT,
      relatedResources: [RELATED_PR],
      compactItem: aicrRunCompact,
      operations: {
        list: {
          method: "GET",
          path: `${AICR_BASE}/pullreqs/{prNumber}/runs`,
          pathBuilder: (input) =>
            `${AICR_BASE}/pullreqs/${aicrPrNumber(input)}/runs`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrNamedRepoPreflight(aicrPrNumber),
          bodyBuilder: hoistAicrRepoPath,
          pageOneIndexed: true,
          headerPagination: true,
          queryParams: { repo_path: "repo_path", page: "page", size: "limit" },
          responseExtractor: aicrRunListExtract,
          description:
            "List review runs for a pull request with status, commit, diff type, and per-language stats.",
          paramsSchema: { fields: PR_PARAM_FIELDS },
        },
        get: {
          method: "GET",
          path: `${AICR_BASE}/runs/{runId}`,
          pathParams: { run_id: "runId" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: hoistAicrRepoPath,
          queryParams: { repo_path: "repo_path" },
          responseExtractor: aicrRunGetExtract,
          description:
            "Get one review run by run_id. To follow a review started with request_review, use aicr_review review_status.",
          paramsSchema: {
            fields: [
              ...REPO_PARAM_FIELDS,
              {
                name: "run_id",
                required: true,
                description:
                  'Run ID from harness_list(resource_type="aicr_run").',
              },
            ],
          },
        },
      },
    },
    {
      resourceType: "aicr_pull_request",
      displayName: "AI Code Reviewed Pull Request",
      description:
        "Pull requests AI Code Review has reviewed under an account, org, or project, newest review first, with risk and author. " +
        "Includes merged and closed PRs; only query filters the list. Has no PR state or branches (use pull_request for those). Pass an item's repo_path and number to aicr_review, aicr_finding, or aicr_run.",
      toolset: "aicr",
      scope: "account",
      scopeOptional: true,
      identifierFields: [],
      diagnosticHint: DIAGNOSTIC_HINT,
      relatedResources: [
        {
          resourceType: "aicr_review",
          relationship: "has",
          description: "The review of a listed PR. Same repo_path and number.",
        },
      ],
      compactItem: aicrPullRequestCompact,
      listFilterFields: [
        { name: "query", description: "Search by pull request title" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${AICR_BASE}/prs`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrSpacePreflight,
          pageOneIndexed: true,
          headerPagination: true,
          queryParams: SPACE_LIST_QUERY,
          responseExtractor: aicrPullRequestListExtract,
          description:
            "List reviewed pull requests with number, title, repo_path, risk, and author.",
          paramsSchema: { fields: SPACE_PARAM_FIELDS },
        },
      },
    },
    {
      resourceType: "aicr_repository",
      displayName: "AI Code Review Repository",
      description:
        "Repositories with AI Code Review enabled under an account, org, or project. " +
        "A repository missing from this list does not have AI Code Review enabled. " +
        "Execute enable or disable to turn it on or off for one Harness Code repository.",
      toolset: "aicr",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id"],
      diagnosticHint: DIAGNOSTIC_HINT,
      compactItem: aicrRepositoryCompact,
      listFilterFields: [
        {
          name: "query",
          description:
            "Match any part of the repository path (case-insensitive)",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${AICR_BASE}/repos`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrSpacePreflight,
          pageOneIndexed: true,
          headerPagination: true,
          queryParams: SPACE_LIST_QUERY,
          responseExtractor: aicrRepositoryListExtract,
          description:
            "List AI Code Review-enabled repositories with repo_path and SCM source (Harness Code or linked provider).",
          paramsSchema: { fields: SPACE_PARAM_FIELDS },
        },
      },
      executeActions: {
        enable: {
          method: "POST",
          path: `${AICR_V2_BASE}/onboard`,
          // Creates pipeline triggers (and the project's AICR pipeline and account service account if missing).
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          preflight: aicrRepoActionPreflight,
          bodyBuilder: (input) => ({
            type: "harness_code",
            repositories: [{ repo_path: input.repo_path }],
          }),
          skipScopeBodyInjection: true,
          queryParams: { space_path: "space_path" },
          responseExtractor: aicrEnableExtract,
          confirmNote: aicrEnableNote,
          actionDescription:
            "Enable AI Code Review on a Harness Code repository, the same as turning on its AI review setting in Harness. " +
            "Adds a pull request trigger to the project's AI Code Review pipeline (creating the pipeline, and the account's " +
            "AI Code Review service account, if missing) and turns the setting on; new pull request commits are then reviewed. " +
            "For an org- or account-level repository, the trigger and pipeline go into every project under that org or account; " +
            "a project that fails is reported only when every project failed. Enabling an enabled repository updates its trigger in place. " +
            "enabled is false, with a warning, when the trigger is in place but the setting could not be turned on.",
          paramsSchema: { fields: REPO_PARAM_FIELDS },
          bodySchema: { description: "No body", fields: [] },
        },
        disable: {
          method: "POST",
          path: `${AICR_V2_BASE}/offboard`,
          // Cascades to the repo's own gates, rules and conventions; enabling again does not bring them back.
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          preflight: aicrRepoActionPreflight,
          bodyBuilder: () => undefined,
          skipScopeBodyInjection: true,
          queryParams: { repo_path: "repo_path" },
          responseExtractor: aicrDisableExtract,
          confirmNote: aicrDisableNote,
          actionDescription:
            "Disable AI Code Review on a repository: deletes its pull request triggers, turns its AI review setting off, " +
            "and deletes the repository's own AI Code Review config with the gates, rules, rule overrides and conventions set on it. " +
            "Enabling it again does not restore them. Succeeds if it is already disabled.",
          paramsSchema: { fields: REPO_PARAM_FIELDS },
          bodySchema: { description: "No body", fields: [] },
        },
      },
    },
    {
      resourceType: "aicr_gate",
      displayName: "AI Code Review Gate",
      description:
        "Merge gate thresholds of AI Code Review per finding category (security, reliability, complexity, hygiene). " +
        "An open finding fails the check when its category is reported and its severity meets fail_at " +
        "(never, critical, major_and_above, any). Pass repo_id (with the repo's org_id/project_id) for the thresholds a repository uses, " +
        "or only org_id/project_id (or nothing, for the account) for a space. Change them with execute set.",
      toolset: "aicr",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id"],
      diagnosticHint: DIAGNOSTIC_HINT,
      relatedResources: [
        {
          resourceType: "aicr_finding",
          relationship: "gates",
          description: "Open findings are checked against these thresholds.",
        },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${AICR_BASE}/gates`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrPolicyScopePreflight(aicrGateNoRepoConfig),
          // The handler ignores repo_path, but auth resolves the account from space_path or repo_path;
          // with repo_config_id alone the request is a 401.
          queryParams: {
            space_path: "space_path",
            repo_config_id: "repo_config_id",
            repo_path: "repo_path",
          },
          responseExtractor: aicrGateExtract,
          description:
            "Get each category's reported flag and fail_at, the org floor (org_reported, org_fail_at), and set_by (organization or repository). " +
            "A repository without its own AI Code Review config is gated on nothing; the result says so in `note`.",
          paramsSchema: { fields: POLICY_SCOPE_FIELDS },
        },
      },
      executeActions: {
        set: {
          method: "PUT",
          path: `${AICR_BASE}/gates`,
          // Loosening a gate lets PRs under the scope pass with findings that failed them before.
          operationPolicy: {
            risk: "medium_write",
            retryPolicy: "do_not_retry",
          },
          preflight: aicrPolicyScopePreflight(aicrNoRepoConfigError),
          bodyBuilder: aicrGateBody,
          skipScopeBodyInjection: true,
          queryParams: {
            space_path: "space_path",
            repo_config_id: "repo_config_id",
            repo_path: "repo_path",
          },
          responseExtractor: aicrGateExtract,
          confirmNote: aicrGateSetNote,
          actionDescription:
            "Set the gate of the given categories on a space or repository; categories left out keep their setting. Returns all categories. " +
            "A space or repository cannot be looser than its parent spaces: it must report a category they report, at fail_at as strict or stricter, " +
            "and cannot report one a parent turned off. reported false at a space turns the category off for everything under it. " +
            "A repository needs its own AI Code Review config.",
          paramsSchema: { fields: POLICY_SCOPE_FIELDS },
          bodySchema: {
            description: "Gates to set",
            fields: [
              {
                name: "categories",
                type: "array",
                required: true,
                itemType:
                  "{category: security|reliability|complexity|hygiene, reported: boolean, fail_at: never|critical|major_and_above|any}",
                description:
                  "One entry per category to change; each needs all three fields",
              },
            ],
          },
        },
      },
    },
    {
      resourceType: "aicr_rule",
      displayName: "AI Code Review Team Rule",
      description:
        "Team rules AI Code Review checks each pull request against; a failed rule fails the Team rules check. " +
        "Set on a space (org_id/project_id, or nothing for the account) or on one repository (repo_id/repo_path). " +
        "Lists include rules inherited from parent spaces. A repository can turn an overridable space rule off or on for itself with execute override. " +
        "Delete archives a rule; update with status active restores it.",
      toolset: "aicr",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["rule_id"],
      diagnosticHint: POLICY_DIAGNOSTIC_HINT,
      compactItem: aicrRuleCompact,
      listFilterFields: [
        {
          name: "status",
          description: "active (default), archived, or all",
          enum: ["active", "archived", "all"],
        },
        {
          name: "query",
          description: "Match title or description (case-insensitive)",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${AICR_BASE}/rules`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrPolicyScopePreflight((repoPath) =>
            aicrPolicyNoRepoConfig("rules", repoPath),
          ),
          pageOneIndexed: true,
          headerPagination: true,
          queryParams: {
            space_path: "space_path",
            repo_config_id: "repo_config_id",
            repo_path: "repo_path",
            status: "status",
            query: "query",
            page: "page",
            size: "limit",
          },
          responseExtractor: aicrRuleListExtract,
          description:
            "List rules of a space or repository, oldest first. Each row has space_path (set on that space) or repo_path (set on the repository). " +
            "At a repository, a rule with repo_override is applied as repo_override.enabled says instead of its own enabled.",
          paramsSchema: { fields: POLICY_SCOPE_FIELDS },
        },
        get: {
          method: "GET",
          path: `${AICR_BASE}/rules/{ruleId}`,
          pathParams: { rule_id: "ruleId" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrPolicyByIdPreflight("rule", false),
          queryParams: { space_path: "space_path", repo_path: "repo_path" },
          responseExtractor: aicrRuleExtract,
          description: "Get one rule by id.",
          paramsSchema: { fields: [...POLICY_SCOPE_FIELDS, RULE_ID_FIELD] },
        },
        create: {
          method: "POST",
          path: `${AICR_BASE}/rules`,
          // Every PR under the scope is then checked against it, and can fail the Team rules check.
          operationPolicy: {
            risk: "medium_write",
            retryPolicy: "do_not_retry",
          },
          preflight: aicrPolicyScopePreflight(aicrNoRepoConfigError),
          bodyBuilder: (input) =>
            pickAicrBody(input, AICR_RULE_CREATE_FIELDS, "Creating a rule"),
          skipScopeBodyInjection: true,
          queryParams: {
            space_path: "space_path",
            repo_config_id: "repo_config_id",
            repo_path: "repo_path",
          },
          responseExtractor: aicrRuleCreateExtract,
          confirmNote: aicrPolicyCreateNote("rule"),
          description:
            "Create a rule on a space or repository. A repository needs its own AI Code Review config.",
          paramsSchema: { fields: POLICY_SCOPE_FIELDS },
          bodySchema: { description: "Rule", fields: RULE_BODY_FIELDS },
        },
        update: {
          method: "PATCH",
          path: `${AICR_BASE}/rules/{ruleId}`,
          pathParams: { rule_id: "ruleId" },
          // Can turn a rule off or archive it, so PRs stop failing on it.
          operationPolicy: {
            risk: "medium_write",
            retryPolicy: "do_not_retry",
          },
          preflight: aicrPolicyByIdPreflight("rule", true, { fields: AICR_RULE_UPDATE_FIELDS, op: "Updating a rule" }),
          bodyBuilder: (input) =>
            pickAicrBody(input, AICR_RULE_UPDATE_FIELDS, "Updating a rule"),
          skipScopeBodyInjection: true,
          queryParams: { space_path: "space_path", repo_path: "repo_path" },
          responseExtractor: aicrRuleExtract,
          confirmNote: aicrPolicyUpdateNote("rule"),
          description:
            "Change the given fields of a rule; status archived archives it and active restores it. Use execute override to turn an inherited rule off for one repository.",
          paramsSchema: { fields: [...POLICY_SCOPE_FIELDS, RULE_ID_FIELD] },
          bodySchema: {
            description: "Fields to change",
            fields: [
              ...RULE_BODY_FIELDS,
              {
                name: "status",
                type: "string",
                required: false,
                description: "active or archived",
              },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${AICR_BASE}/rules/{ruleId}`,
          pathParams: { rule_id: "ruleId" },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          preflight: aicrPolicyByIdPreflight("rule", true),
          confirmNote: aicrPolicyDeleteNote("rule"),
          queryParams: { space_path: "space_path", repo_path: "repo_path" },
          responseExtractor: aicrArchiveExtract("rule_id"),
          description:
            "Archive a rule: reviews stop checking it, in every repository that inherits it. Update with status active restores it.",
          paramsSchema: { fields: [...POLICY_SCOPE_FIELDS, RULE_ID_FIELD] },
        },
      },
      executeActions: {
        override: {
          method: "PUT",
          path: `${AICR_BASE}/rules/{ruleId}/override`,
          pathParams: { rule_id: "ruleId" },
          // Turning a rule off for a repo lets its PRs pass the Team rules check without it.
          operationPolicy: {
            risk: "medium_write",
            retryPolicy: "do_not_retry",
          },
          preflight: aicrRuleOverridePreflight,
          bodyBuilder: (input) => {
            const body = pickAicrBody(input, ["enabled"], "override");
            if (typeof body.enabled !== "boolean")
              throw new Error("override needs body.enabled: true or false.");
            return body;
          },
          skipScopeBodyInjection: true,
          queryParams: {
            repo_config_id: "repo_config_id",
            repo_path: "repo_path",
          },
          responseExtractor: aicrRuleExtract,
          confirmNote: aicrRuleOverrideNote,
          actionDescription:
            "Turn an overridable rule of a parent space off (enabled false) or back on for one repository, without changing it elsewhere. " +
            "Fails for a required (not overridable) or archived rule, and for a rule set on the repository itself. Calling it again updates the same override. " +
            "An override cannot be removed: to follow the rule again, set enabled to the rule's own value (it then keeps that value " +
            "even if the rule changes later). Update and delete do not take an override row.",
          paramsSchema: { fields: [...REPO_PARAM_FIELDS, RULE_ID_FIELD] },
          bodySchema: {
            description: "Override",
            fields: [
              {
                name: "enabled",
                type: "boolean",
                required: true,
                description: "Whether the rule applies to this repository",
              },
            ],
          },
        },
      },
    },
    {
      resourceType: "aicr_convention",
      displayName: "AI Code Review Coding Convention",
      description:
        "Coding conventions AI Code Review gives the reviewer for every pull request: how the team writes code, beyond the rules it checks. " +
        "Unlike team rules they have no check of their own; they shape the findings. " +
        "Set on a space (org_id/project_id, or nothing for the account) or on one repository (repo_id/repo_path); lists include those inherited from parent spaces. " +
        "Delete archives a convention; update with status active restores it.",
      toolset: "aicr",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["convention_id"],
      diagnosticHint: POLICY_DIAGNOSTIC_HINT,
      compactItem: aicrConventionCompact,
      listFilterFields: [
        {
          name: "status",
          description: "active (default), archived, or all",
          enum: ["active", "archived", "all"],
        },
        {
          name: "query",
          description: "Match title or body (case-insensitive)",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${AICR_BASE}/conventions`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrPolicyScopePreflight((repoPath) =>
            aicrPolicyNoRepoConfig("conventions", repoPath),
          ),
          pageOneIndexed: true,
          headerPagination: true,
          queryParams: {
            space_path: "space_path",
            repo_config_id: "repo_config_id",
            repo_path: "repo_path",
            status: "status",
            query: "query",
            page: "page",
            size: "limit",
          },
          responseExtractor: aicrConventionListExtract,
          description:
            "List conventions of a space or repository, oldest first. Each row has space_path (set on that space) or repo_path (set on the repository). " +
            "At a repository, reviews get the enabled ones.",
          paramsSchema: { fields: POLICY_SCOPE_FIELDS },
        },
        get: {
          method: "GET",
          path: `${AICR_BASE}/conventions/{conventionId}`,
          pathParams: { convention_id: "conventionId" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrPolicyByIdPreflight("convention", false),
          queryParams: { space_path: "space_path", repo_path: "repo_path" },
          responseExtractor: aicrConventionExtract,
          description: "Get one convention by id, with its body.",
          paramsSchema: {
            fields: [...POLICY_SCOPE_FIELDS, CONVENTION_ID_FIELD],
          },
        },
        create: {
          method: "POST",
          path: `${AICR_BASE}/conventions`,
          // Changes what reviews report on every PR under the scope, and so what can fail their gates.
          operationPolicy: {
            risk: "medium_write",
            retryPolicy: "do_not_retry",
          },
          preflight: aicrPolicyScopePreflight(aicrNoRepoConfigError),
          bodyBuilder: (input) =>
            pickAicrBody(
              input,
              AICR_CONVENTION_CREATE_FIELDS,
              "Creating a convention",
            ),
          skipScopeBodyInjection: true,
          queryParams: {
            space_path: "space_path",
            repo_config_id: "repo_config_id",
            repo_path: "repo_path",
          },
          responseExtractor: aicrConventionCreateExtract,
          confirmNote: aicrPolicyCreateNote("convention"),
          description:
            "Create a convention on a space or repository. A repository needs its own AI Code Review config.",
          paramsSchema: { fields: POLICY_SCOPE_FIELDS },
          bodySchema: {
            description: "Convention",
            fields: CONVENTION_BODY_FIELDS,
          },
        },
        update: {
          method: "PATCH",
          path: `${AICR_BASE}/conventions/{conventionId}`,
          pathParams: { convention_id: "conventionId" },
          operationPolicy: {
            risk: "medium_write",
            retryPolicy: "do_not_retry",
          },
          preflight: aicrPolicyByIdPreflight("convention", true, {
            fields: AICR_CONVENTION_UPDATE_FIELDS,
            op: "Updating a convention",
          }),
          bodyBuilder: (input) =>
            pickAicrBody(
              input,
              AICR_CONVENTION_UPDATE_FIELDS,
              "Updating a convention",
            ),
          skipScopeBodyInjection: true,
          queryParams: { space_path: "space_path", repo_path: "repo_path" },
          responseExtractor: aicrConventionExtract,
          confirmNote: aicrPolicyUpdateNote("convention"),
          description:
            "Change the given fields of a convention; a list given replaces the old one. status archived archives it and active restores it.",
          paramsSchema: {
            fields: [...POLICY_SCOPE_FIELDS, CONVENTION_ID_FIELD],
          },
          bodySchema: {
            description: "Fields to change",
            fields: [
              ...CONVENTION_BODY_FIELDS,
              {
                name: "status",
                type: "string",
                required: false,
                description: "active or archived",
              },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: `${AICR_BASE}/conventions/{conventionId}`,
          pathParams: { convention_id: "conventionId" },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          preflight: aicrPolicyByIdPreflight("convention", true),
          confirmNote: aicrPolicyDeleteNote("convention"),
          queryParams: { space_path: "space_path", repo_path: "repo_path" },
          responseExtractor: aicrArchiveExtract("convention_id"),
          description:
            "Archive a convention: reviews stop getting it, in every repository that inherits it. Update with status active restores it.",
          paramsSchema: {
            fields: [...POLICY_SCOPE_FIELDS, CONVENTION_ID_FIELD],
          },
        },
      },
    },
    {
      resourceType: "aicr_setting",
      displayName: "AI Code Review Settings",
      description:
        "AI Code Review settings of a space (org_id/project_id, or nothing for the account) or one repository (repo_id/repo_path): " +
        "excluded and test paths (reviews skip excluded files), the model connector reviews run with (llm_connector_ref, set on spaces), " +
        "review_triggers and dismissable. A value not set on a scope comes from the closest parent space, else the built-in default. " +
        "review_triggers are read only when a GitHub App repository is enabled, so changing them leaves existing triggers as they are; " +
        "drafts and dismissable are stored but not acted on yet. Change settings with execute set.",
      toolset: "aicr",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id"],
      diagnosticHint: POLICY_DIAGNOSTIC_HINT,
      operations: {
        get: {
          method: "GET",
          path: `${AICR_BASE}/config/space`,
          pathBuilder: aicrConfigPath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: aicrConfigScopePreflight,
          queryParams: {
            space_path: "space_path",
            repo_identifier: "repo_identifier",
          },
          staticQueryParams: { recursive: "true" },
          responseExtractor: aicrSettingExtract,
          description:
            "Get the settings in effect, each with the scope it is set on (*_scope, and scope on each path; default is the built-in value).",
          paramsSchema: { fields: POLICY_SCOPE_FIELDS },
        },
      },
      executeActions: {
        set: {
          method: "PUT",
          path: `${AICR_BASE}/config/space`,
          pathBuilder: aicrConfigPath,
          // Paths decide which files every review under the scope reads; the connector decides where their code goes.
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          preflight: aicrSettingSetPreflight,
          bodyBuilder: (input) => input[AICR_SETTING_BODY_KEY],
          skipScopeBodyInjection: true,
          queryParams: {
            space_path: "space_path",
            repo_identifier: "repo_identifier",
          },
          responseExtractor: aicrSettingSetExtract,
          confirmNote: aicrSettingSetNote,
          actionDescription:
            "Change the given settings of one space or repository; the others stay as they are. " +
            "add_paths and remove_paths change only paths set on this scope (get shows each path's scope). " +
            "null clears a trigger, dismissable or llm_connector_ref here, so it is inherited again. " +
            "Returns the scope's own settings, where null is inherited. A repository needs its own AI Code Review config.",
          paramsSchema: { fields: POLICY_SCOPE_FIELDS },
          bodySchema: {
            description: "Settings to change",
            fields: [
              {
                name: "review_triggers",
                type: "object",
                required: false,
                description:
                  "Review on PR open, on push, and of drafts: each true, false or null (inherit). " +
                  "Read only when a GitHub App repository is enabled; drafts is not acted on yet",
                fields: AICR_TRIGGERS.map((name) => ({
                  name,
                  type: "boolean" as const,
                  required: false,
                  description: name,
                })),
              },
              {
                name: "dismissable",
                type: "boolean",
                required: false,
                description: "Stored but not enforced yet (findings can still be dismissed); null inherits",
              },
              {
                name: "llm_connector_ref",
                type: "string",
                required: false,
                description:
                  "Model connector of a space, e.g. account.harnessAnthropic; null inherits",
              },
              {
                name: "add_paths",
                type: "array",
                required: false,
                itemType: "{pattern, type: excluded|tests}",
                description:
                  "Globs from the repository root, e.g. vendor/**. Paths add up down the chain: a repository cannot un-exclude a parent's path",
              },
              {
                name: "remove_paths",
                type: "array",
                required: false,
                itemType: "{pattern, type: excluded|tests}",
                description: "Paths set on this scope to remove",
              },
            ],
          },
        },
      },
    },
  ],
});
