import type { PreflightContext } from "./types.js";
import { asRecord } from "../utils/type-guards.js";

/**
 * Fields copied onto the internal get. `store_type` is intentionally absent:
 * the registry echoes a request storeType onto a response that omitted one,
 * which would let the caller's claim look like the stored store type.
 */
const READ_CONTEXT_KEYS = [
  "org_id",
  "project_id",
  "resource_scope",
  "branch",
  "branch_name",
  "repo_name",
  "connector_ref",
] as const;

export function firstGitString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value !== "") return value;
  }
  return undefined;
}

export function firstGitBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    // `params` values are untyped JSON and agents routinely quote booleans.
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return undefined;
}

export function inputGitDetails(input: Record<string, unknown>): Record<string, unknown> {
  return asRecord(asRecord(input.body)?.git_details) ?? {};
}

function setIfMissing(input: Record<string, unknown>, key: string, value: unknown): void {
  if ((input[key] === undefined || input[key] === "") && value !== undefined && value !== "") {
    input[key] = value;
  }
}

/** Branch, repo, file path, and both Git SHAs — enough for a remote update. */
function hasRemoteUpdateLockContext(input: Record<string, unknown>): boolean {
  const git = inputGitDetails(input);
  return !!firstGitString(input.branch_name, input.branch, git.branch_name, git.branch)
    && !!firstGitString(input.repo_name, git.repo_name)
    && !!firstGitString(input.file_path, git.file_path)
    && !!firstGitString(input.last_object_id, git.last_object_id, git.object_id)
    && !!firstGitString(input.last_commit_id, git.last_commit_id, git.commit_id);
}

function isExplicitlyInline(input: Record<string, unknown>): boolean {
  const storeType = firstGitString(input.store_type, inputGitDetails(input).store_type);
  return storeType?.toUpperCase() === "INLINE";
}

/**
 * V1 create/update send Git Experience fields in JSON `git_details`, not query params.
 * Accept params used by v0 agents (branch, commit_msg, last_object_id) and GET response
 * names (object_id, commit_id) so agents can copy git_details forward.
 */
export function collectV1GitDetails(input: Record<string, unknown>): Record<string, string | boolean> | undefined {
  const git = inputGitDetails(input);
  const details: Record<string, string | boolean> = {};
  const assign = (key: string, value: string | undefined) => {
    if (value) details[key] = value;
  };

  assign("branch_name", firstGitString(input.branch_name, input.branch, git.branch_name, git.branch));
  assign("file_path", firstGitString(input.file_path, git.file_path));
  assign("commit_message", firstGitString(input.commit_message, input.commit_msg, git.commit_message));
  assign("base_branch", firstGitString(input.base_branch, git.base_branch));
  assign("connector_ref", firstGitString(input.connector_ref, git.connector_ref));
  assign("store_type", firstGitString(input.store_type, git.store_type));
  assign("repo_name", firstGitString(input.repo_name, git.repo_name));
  const isHarnessCodeRepo = firstGitBoolean(input.is_harness_code_repo, git.is_harness_code_repo);
  if (isHarnessCodeRepo !== undefined) details.is_harness_code_repo = isHarnessCodeRepo;
  assign("last_object_id", firstGitString(input.last_object_id, git.last_object_id, git.object_id));
  assign("last_commit_id", firstGitString(input.last_commit_id, git.last_commit_id, git.commit_id));

  return Object.keys(details).length > 0 ? details : undefined;
}

export interface RemoteGitUpdatePreflightOptions {
  /** Resource whose get returns `gitDetails` / `git_details` for this entity. */
  resourceType: string;
  /** Identifier fields the get needs, such as `pipeline_id` or `template_id` + `version_label`. */
  idKeys: readonly string[];
  /** Static get inputs, such as `{ load_from_fallback_branch: true }` for v1 pipelines. */
  getDefaults?: Record<string, unknown>;
  /** Copy `current.name` onto this input field when the caller omitted it. */
  copyNameTo?: string;
}

/**
 * Before a Git-backed update, load missing branch, repo, file path, connector,
 * and optimistic-lock SHAs from the current entity. A complete caller-supplied
 * lock is left as-is. Inline entities and a failed lookup do not block the write.
 */
export function remoteGitUpdatePreflight(options: RemoteGitUpdatePreflightOptions) {
  const { resourceType, idKeys, getDefaults, copyNameTo } = options;
  return async ({ client, input, registry, signal }: PreflightContext): Promise<void> => {
    if (isExplicitlyInline(input) || hasRemoteUpdateLockContext(input)) return;

    const currentGit = inputGitDetails(input);
    const getInput: Record<string, unknown> = {};
    for (const key of [...idKeys, ...READ_CONTEXT_KEYS]) {
      if (input[key] !== undefined) getInput[key] = input[key];
    }
    setIfMissing(getInput, "branch", firstGitString(currentGit.branch_name, currentGit.branch));
    setIfMissing(getInput, "repo_name", firstGitString(currentGit.repo_name));
    setIfMissing(getInput, "connector_ref", firstGitString(currentGit.connector_ref));
    if (getDefaults) {
      for (const [key, value] of Object.entries(getDefaults)) {
        if (getInput[key] === undefined) getInput[key] = value;
      }
    }

    // A failed lookup must not block inline updates. A remote entity whose get
    // fails still fails on the write with the Git branch/SHA error.
    let current: Record<string, unknown> | undefined;
    try {
      current = asRecord(await registry.dispatch(client, resourceType, "get", getInput, signal));
    } catch {
      return;
    }

    // v1 template GET returns `{ template: { git_details, store_type, name } }`.
    // Pipeline GET returns those fields on the top-level object.
    const wrapped = asRecord(current?.template);
    const git = asRecord(
      current?.git_details ?? current?.gitDetails ?? wrapped?.git_details ?? wrapped?.gitDetails,
    );
    const currentStoreType = firstGitString(
      current?.store_type,
      current?.storeType,
      wrapped?.store_type,
      wrapped?.storeType,
      git?.store_type,
      git?.storeType,
    );
    const hasRemoteMetadata = !!git && Object.keys(git).length > 0;
    if (currentStoreType?.toUpperCase() === "INLINE") return;
    if (currentStoreType?.toUpperCase() !== "REMOTE" && !hasRemoteMetadata) return;

    setIfMissing(input, "store_type", currentStoreType ?? "REMOTE");
    setIfMissing(input, "branch", firstGitString(git?.branch_name, git?.branchName, git?.branch));
    setIfMissing(input, "repo_name", firstGitString(git?.repo_name, git?.repoName));
    setIfMissing(input, "file_path", firstGitString(git?.file_path, git?.filePath));
    setIfMissing(input, "connector_ref", firstGitString(git?.connector_ref, git?.connectorRef));
    setIfMissing(input, "last_object_id", firstGitString(
      git?.last_object_id,
      git?.object_id,
      git?.lastObjectId,
      git?.objectId,
    ));
    setIfMissing(input, "last_commit_id", firstGitString(
      git?.last_commit_id,
      git?.commit_id,
      git?.lastCommitId,
      git?.commitId,
    ));
    setIfMissing(input, "is_harness_code_repo", firstGitBoolean(
      git?.is_harness_code_repo,
      git?.isHarnessCodeRepo,
    ));
    if (copyNameTo) {
      setIfMissing(input, copyNameTo, firstGitString(current?.name, wrapped?.name));
    }

    if (!hasRemoteUpdateLockContext(input)) {
      throw new Error(
        `Unable to resolve Git branch and current object/commit IDs for remote ${resourceType} update. `
        + "Call harness_get with the repository/branch context and pass branch, last_object_id, and last_commit_id via params.",
      );
    }
  };
}
