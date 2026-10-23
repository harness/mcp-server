/**
 * System instructions sent to MCP clients on initialize.
 * Discovery must name `harness_describe(operation=...)`. A no-argument
 * describe call returns the full resource catalog.
 */
export function buildServerInstructions(config: { HARNESS_PIPELINE_VERSION?: string }): string {
  return [
    "Harness MCP server — manage CI/CD pipelines, code repos, PRs, services, environments, and more.",
    "",
    "URL SHORTCUT: All harness_ tools accept a `url` parameter. Paste any Harness UI URL and identifiers (org, project, resource type, ID) are auto-extracted. This works for nested resources too — a PR URL auto-extracts repo_id and pr_number.",
    "",
    "SCOPE: Project-scoped tools need org_id and project_id (or a Harness project URL) on the first call. Do not omit them expecting a default unless the field description names a configured default. resource_scope: account = account-level only, org = org_id, project = org_id+project; omit for the resource's default, and never use 'account' to skip a known org/project. Do not switch to resource_scope='account' just because a project-scoped lookup failed.",
    "",
    "COMMON PATTERNS:",
    "• Get PR details: harness_get(url='<Harness PR URL>')",
    "• List PR comments: harness_list(url='<Harness PR URL>', resource_type='pr_activity', filters={type: ['comment', 'code-comment']}) — comments are read from PR activity, not pr_comment",
    "• Add/update/delete PR comments: use resource_type='pr_comment' with harness_create/harness_update/harness_delete. Resolve or reopen a thread with harness_execute(resource_type='pr_comment', action='resolve' or 'unresolve', no body) — comment_id must be the parent comment, not a reply",
    "• List PR activity: harness_list(url='<Harness PR URL>', resource_type='pr_activity') — returns all comments, reviews, status changes",
    "• Get pipeline: harness_get(url='<Harness pipeline URL>')",
    "• Run pipeline: harness_execute(url='<Harness pipeline URL>', action='run', inputs={branch: 'main'})",
    "• Diagnose failure: harness_diagnose(url='<Harness execution URL>')",
    "",
    "DISCOVERY: Call harness_describe(operation='list'|'get'|'create'|'update'|'delete'|'execute') to list only the resource types that support that tool. execute includes each type's action names. Add search_term or toolset to narrow the list. Call harness_describe(resource_type='<type>') for operations and fields. Always search before telling the user a capability is unavailable.",
    "SCHEMA: Use harness_schema(resource_type='<type>') to fetch the exact JSON Schema for create/update body payloads.",
    "",
    "ENTITY SELECTION: When the user references an ordinal ('first repo', 'second artifact', 'latest execution'), pick the item at that index from the list response (0 = first, -1 = last). Do NOT substitute a different item or pick by name unless the user asks by name. If the list is empty, say so — never guess an ID.",
    "",
    "PR RESOURCES: pull_request, pr_activity, pr_reviewer, pr_check for reads; pr_comment for comment writes including resolve/unresolve. All accept URL or explicit repo_id + pr_number. To add a reviewer, pass body.reviewer_email from harness_list(user).",
    ...(config.HARNESS_PIPELINE_VERSION === "1"
      ? ["", "PIPELINES: Both v0 ('pipeline') and v1 ('pipeline_v1') are available. Default to v1. Use harness_describe for version detection hints."]
      : ["", "PIPELINES: Both v0 ('pipeline') and v1 ('pipeline_v1') are available. Default to v0 unless user explicitly requests v1 or 'agent pipeline'. Use harness_describe for version detection hints."]),
  ].join("\n");
}
