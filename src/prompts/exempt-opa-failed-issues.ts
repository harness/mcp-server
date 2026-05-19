import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Skill: exempt-opa-failed-issues
 *
 * Customer types into chat after observing an STO pipeline execution that was
 * denied by an OPA Policy step ("exempt the issues that failed OPA for
 * execution <id>"). This prompt orchestrates:
 *
 *   1. Resolve the execution and its OPA policy_evaluation(s).
 *   2. Read per-policy deny details (status='error' only; warnings don't fail).
 *   3. Read scan-step metadata + Pipeline Security issues for that execution.
 *   4. Correlate deny signals → candidate STO issue_ids (LLM-mediated).
 *   5. Show a candidate table; require explicit user confirmation.
 *   6. Loop create security_exemption per issue.
 *   7. Summary + suggested next steps.
 *
 * See docs/exempt-opa-failed-issues-design.md for the full design.
 */
export function registerExemptOpaFailedIssuesPrompt(server: McpServer): void {
  server.registerPrompt(
    "exempt-opa-failed-issues",
    {
      description:
        "Create STO security exemptions for the issues that caused an OPA Policy step to fail a "
        + "pipeline execution. Reads policy_evaluation results for the execution, pulls the "
        + "execution's Pipeline Security issues + scan steps, correlates the deny signals to "
        + "specific issue_ids, asks for confirmation, then bulk-creates exemptions.",
      argsSchema: {
        executionId: z.string().describe("Pipeline plan execution ID (e.g. 'ehsPKtczTRO5CUDAt-NR'), OR any Harness UI URL that contains '/executions/<executionId>/' in its path. Examples: the pipeline execution page, the Security Tests / vulnerabilities tab, the Policy Evaluations tab. If a URL is pasted, the prompt extracts the executionId segment automatically. orgId and projectId are also extracted from the URL if present."),
        projectId: z.string().describe("Project identifier (optional; defaults to configured project)").optional(),
        orgId: z.string().describe("Organization identifier (optional; defaults to configured org)").optional(),
        exemption_type: z.string().describe("Exemption type to apply: 'Compensating Controls' | 'Acceptable Use' | 'Acceptable Risk' | 'False Positive' | 'Fix Unavailable' | 'Other'. Optional — if omitted, the prompt will ask after showing the candidate table.").optional(),
        reason: z.string().describe("Business/security justification for the exemption. Optional — if omitted, the prompt will ask after showing the candidate table.").optional(),
        duration_days: z.number().describe("Exemption duration in days (defaults to 30 when omitted)").optional(),
        link: z.string().describe("Optional URL for Jira / ticket / reference").optional(),
        expiration: z.number().describe("Optional Unix timestamp at which exemptions expire").optional(),
        extra_filters: z.object({
          severity_codes: z.string().optional(),
          issue_types: z.string().optional(),
          target_ids: z.string().optional(),
          target_types: z.string().optional(),
          search: z.string().optional(),
          steps: z.string().optional(),
        }).describe("Optional additional pipeline_security_issue filters to narrow further (e.g. severity_codes='Critical').").optional(),
        dry_run: z.boolean().describe("When true, stop after the candidate table — do not create exemptions even on user confirmation. Useful for previewing.").optional(),
      },
    },
    async ({
      executionId,
      projectId,
      orgId,
      exemption_type,
      reason,
      duration_days,
      link,
      expiration,
      extra_filters,
      dry_run,
    }) => {
      const orgScope = orgId ? `, org_id="${orgId}"` : "";
      const projectScope = projectId ? `, project_id="${projectId}"` : "";
      const scope = `${orgScope}${projectScope}`;
      const extraFiltersHint = extra_filters
        ? `\n- extra_filters: ${JSON.stringify(extra_filters)}`
        : "";
      const dryRunHint = dry_run ? "\n- dry_run: true (STOP after the candidate table — do NOT create exemptions, even if user confirms)" : "";

      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Create STO exemptions for the issues that an OPA Policy step denied during a pipeline execution, using a PURE DETERMINISTIC join — no fuzzy correlation, no severity guessing.

Inputs for this run:
- executionId: "${executionId}"${orgId ? `\n- orgId: "${orgId}"` : ""}${projectId ? `\n- projectId: "${projectId}"` : ""}
${exemption_type ? `- exemption_type: "${exemption_type}"` : "- exemption_type: (NOT PROVIDED — ask at the confirmation gate)"}
${reason ? `- reason: "${reason}"` : "- reason: (NOT PROVIDED — ask at the confirmation gate)"}${duration_days ? `\n- duration_days: ${duration_days}` : "\n- duration_days: 30 (default — confirm with user)"}${link ? `\n- link: ${link}` : ""}${expiration ? `\n- expiration: ${expiration}` : ""}${extraFiltersHint}${dryRunHint}

═══════════════════════════════════════════════════════════════════
🛑 CRITICAL RULES — OBEY ABSOLUTELY 🛑
═══════════════════════════════════════════════════════════════════

1. The candidate set is produced ONLY by the deterministic title-join in Step 3.
   - Inputs to the join: \`evaluation.input\` (per-issue records with \`id\` + \`title\`) and \`evaluation.details[].details[].output.<package>.deny_list_violations[].issue.title\` (or, as fallback, bracketed-title regex on \`deny_messages\`).
   - There is no fuzzy matching, no severity inference, no CVE/component string-fuzz, no scanner narrowing. If the join cannot be performed, you STOP — you do NOT guess.

2. If \`evaluation.input\` has no \`{ name: "securityTestData", outcome: { issues: [...] } }\` segment OR \`output\` exposes no canonical \`deny_list_violations\` AND \`deny_messages\` do not match the canonical \`Vulnerability ['<title>'] …\` shape, REFUSE to produce candidates. Tell the user the rego is non-canonical and ask for explicit \`issue_ids\`. Never substitute severity / CVE / component heuristics.

3. Never use \`harness_list(resource_type="security_issue")\` (that's the cross-execution Issues page). Always use \`pipeline_security_issue\` (execution-scoped).

4. Never send \`requester_id\` or \`exempt_future_occurrences\` in the exemption body — server enforces both.

5. No exemption is created without explicit user confirmation at the gate in Step 5. If \`dry_run=true\`, Step 6 is skipped entirely.

═══════════════════════════════════════════════════════════════════

## 0. Normalize the input

If \`executionId\` contains \`/executions/\`, extract the segment immediately after it. Also extract \`orgId\` / \`projectId\` from \`/orgs/<id>/\` and \`/projects/<id>/\` when not provided as arguments. If the value is a bare ID, use it as-is. Print one line: \`Resolved: executionId=<id>, orgId=<...>, projectId=<...>\`. If executionId is empty after extraction, ask the user to repaste.

## 1. Resolve the execution

  harness_get(resource_type="execution", execution_id="${executionId}"${scope})

- Capture \`pipelineId\` and \`status\`. If status is "Success" (or any non-failure), stop — exemptions are unnecessary.
- If the execution does not exist, surface the error verbatim and stop.

## 2. Fetch the failing policy evaluation(s)

  harness_list(resource_type="policy_evaluation",
               filters={ execution_id: "${executionId}", status: "error" }${scope})

The resource definition sets \`created_date_from=0\` so older executions are not filtered by policy-mgmt's silent 7-day default. Paginate until exhausted.

If the result is empty, stop and report verbatim: "No failing OPA evaluation was recorded for execution ${executionId}. This is likely not an OPA failure — try \`harness_diagnose(resource_type='execution', execution_id='${executionId}')\` to find the real cause."

For every returned item, call:

  harness_get(resource_type="policy_evaluation", evaluation_id=<id>${scope})

The list response is summary metadata only; \`details[].details[]\` with \`deny_messages\`, \`output\`, \`policy_severity\`, and the top-level \`input\` come only from the get response. This call is MANDATORY.

The fetched Evaluation has this shape:

  Evaluation
    .input                                  ← entity input fed to OPA (the deterministic-join SOURCE)
    .details[]                              ← one per POLICY_SET (EvaluationDetail)
        .identifier, .name, .type, .action
        .status: "error" | "warning" | "pass" | "pending"
        .details[]                          ← one per POLICY (EvaluatedPolicy)
            .status: "error" | "warning" | "pass" | "pending"
            .policy_severity: "error" | "warning"     ← API value (NOT UI labels "Error & Exit"/"Warn & Continue")
            .policy: { identifier, name, rego, ... }
            .output                         ← OPA ResultSet: [{ expressions: [{ value: { <pkg>: { deny: [...], deny_list_violations: [[...]] } } }] }]
            .deny_messages: string[]

## 3. Classify each policy_set and perform the deterministic title-join

For each \`evaluation.details[]\` (per policy_set), classify by \`(type, action)\`:

- **REFUSE — pipeline governance**: \`type=="pipeline"\` AND \`action in ("onrun","onsave","onstepstart")\`. Pre-run block; nothing to exempt. Report verbatim and skip this set.
- **REFUSE — SBOM enforcement**: \`type=="sbom"\` AND \`action=="onstep"\`. Different domain. Route the user to \`harness_list(resource_type="scs_bom_violation", …)\` and skip this set.
- **PROCEED**: \`type=="securityTests"\` AND \`action=="onstep"\` (canonical STO step), OR \`type=="custom"\` AND \`action=="onstep"\` (Custom Stage OPA Evaluation step). For \`custom\`, the input shape is customer-defined — proceed only if the rules below detect the canonical \`securityTestData\` shape.
- **ANYTHING ELSE**: treat as REFUSE; surface the unfamiliar \`(type, action)\` to the user.

If zero policy_sets PROCEED, stop and explain why.

For each PROCEEDing policy_set, walk its inner \`details[]\` (per policy) and KEEP only entries where BOTH:

  policy.status == "error"             — the policy actually denied this run
  policy.policy_severity == "error"    — this policy is configured to fail the pipeline (Error & Exit), not just warn

Both checks are required. \`policy_severity == "warning"\` corresponds to the UI's "Warn & Continue" setting — such a policy emits messages but does NOT block the pipeline; collecting its deny strings would over-exempt.

For each kept \`EvaluatedPolicy\`, perform this deterministic title-join — do not perform any other matching:

### 3.1. Locate the issue-source segment in \`evaluation.input\`

Walk \`evaluation.input\` (it is typically a top-level array) and find the first element matching:

  { "name": "securityTestData",
    "outcome": { "issues": [ { "id": "<22-char>", "title": "<...>", "severityCode": "...", ... }, ... ] } }

This is the canonical pipeline-service "aggregator" shape emitted when STO scan outputs are referenced via \`<+steps.scan_x.output.outputVariables.Issues>\`. Build a map:

  titleToIds: Map<string, string[]>   // title → list of issue IDs (1:N safe; same title can appear on multiple targets)

iterating \`outcome.issues[]\` and pushing each \`{title -> id}\`.

If NO such segment exists in \`evaluation.input\`:

  → STOP for this policy. Report verbatim: "Policy '<policy.identifier>' under set '<set.identifier>' fed OPA a non-canonical input (no \`securityTestData\` segment). Cannot deterministically resolve deny messages to issue IDs. Please supply the \`issue_ids\` you want exempted explicitly." Do NOT fall back to fuzzy correlation. Do NOT severity-guess.

### 3.2. Extract the matched titles from the policy's output

Try, in order:

a) **Canonical**: read \`policy.output\`. It is an OPA ResultSet wrapped as \`output[].expressions[].value.<package>\` (e.g. \`output[0].expressions[0].value.securityTests\`). Inside that package object, find \`deny_list_violations\`. NOTE: it is a 2D array — \`[[{issue, violation}], [{issue, violation}], ...]\` — because the rego defines it via set comprehension that yields per-issue arrays. Flatten one level, then collect every \`issue.title\`. If you can't predict the package name, recurse the whole \`output\` tree looking for any \`deny_list_violations\` key — both work.

b) **Fallback**: regex over each entry in \`policy.deny_messages\`:

  /Vulnerability \\['([^']+)'\\] matches the following item found on the deny list/

  Capture group 1 is the title. If at least one deny_message matches this regex, use those titles.

If neither (a) nor (b) yields any titles:

  → STOP for this policy. Report verbatim: "Policy '<policy.identifier>' produced \`deny_messages\` whose format is non-canonical (no \`deny_list_violations\` block in \`output\` and no \`Vulnerability ['<title>']\` pattern in \`deny_messages\`). Cannot deterministically resolve them to issue IDs. Please supply \`issue_ids\` explicitly." Do NOT fall back to fuzzy correlation.

### 3.3. Join titles → issue IDs

For each extracted title, look up \`titleToIds[title]\`. If the title is not in the map, record it as an "unjoined deny" — surface this to the user in the table below but do NOT include any candidate for it. (This is rare; it means the rego matched something that wasn't in its own input segment, which indicates a customer-specific transformation.)

Accumulate the resulting \`issue_id\` set across all kept policies. De-duplicate.

Print this table BEFORE moving to the next step:

| policy_set | policy | deny_title | source | matched_issue_ids |
|---|---|---|---|---|

Where \`source\` ∈ { \`output.deny_list_violations\`, \`deny_messages_regex\` }, and \`matched_issue_ids\` is the comma-separated list from \`titleToIds\` (or \`(unjoined)\` if the title wasn't in the input map).

## 4. Verify candidates against Pipeline Security and present the table

  harness_list(resource_type="pipeline_security_issue",
               filters={
                 execution_id: "${executionId}",
                 include_exempted: false,
                 status: "ACTIVE,PENDING_EXEMPTION",
                 page_size_existing: 100,
                 page_size_new: 100${extra_filters ? `,
                 ...${JSON.stringify(extra_filters).replace(/[{}]/g, "").trim()}` : ""}
               }${scope})

Pagination note: this endpoint uses DIFF pagination — \`page_existing\`/\`page_size_existing\` and \`page_new\`/\`page_size_new\` are independent counters; if either total exceeds 100, paginate that partition independently.

Filter the deterministic candidate ID set from Step 3 to those present in this list. An ID that doesn't appear here is already exempted or remediated — keep its row in the table but mark it skipped.

Render:

| issue_id | severity | key | title | partition | status | matched_deny_title |
|---|---|---|---|---|---|---|

Then:
- "Denied by policy_set(s): <set.name list>"
- "Total candidates (deterministic join): N"
- "Already exempted / not active (will skip): M"
- "Ready to create: N - M"
- If any deny title is \`(unjoined)\`, append: "Unjoined deny titles: K — these were in deny_messages but not in \`evaluation.input.securityTestData.outcome.issues\`."

If \`N - M == 0\`, stop and tell the user nothing remains to be exempted.

## 5. Confirmation gate

If \`exemption_type\` or \`reason\` is missing, ask now in ONE combined message:

  "Found <N - M> candidate exemption(s). To create them I need:
   - exemption_type: 'Compensating Controls' | 'Acceptable Use' | 'Acceptable Risk' | 'False Positive' | 'Fix Unavailable' | 'Other'
   - reason: one-line justification
   - duration_days: number (default 30)
   Reply with these, or 'cancel' to abort."

If both were already provided, ask exactly once:

  "Confirm creating <N - M> exemption(s) with type='${exemption_type ?? "<…>"}', reason='${reason ?? "<…>"}'${duration_days ? `, duration_days=${duration_days}` : ", duration_days=30 (default)"}? Reply 'yes' to proceed or list \`issue_ids\` to drop."

If \`dry_run=true\`, STOP HERE regardless of reply. Do not create.

## 6. Bulk create

For every confirmed \`issue_id\`:

  harness_create(
    resource_type="security_exemption"${scope},
    body={
      issue_id: "<issue_id>",
      type: "${exemption_type}",
      reason: "${reason}"${duration_days ? `,
      duration_days: ${duration_days}` : ""}${link ? `,
      link: "${link}"` : ""}${expiration ? `,
      expiration: ${expiration}` : ""}
    }
  )

## 7. Final summary

| issue_id | status | exemption_id | failure_reason |
|---|---|---|---|

Status ∈ { \`created\`, \`skipped (already exempt)\`, \`failed\` }. Then totals (Total / Created / Skipped / Failed).

## 8. Suggested next steps

Append "## Suggested next steps" with 3–5 bold imperative sentences using real values (policy_set name, execution ID, etc.). Omit the section if nothing was created and nothing is actionable. Examples:

- **Retry pipeline execution <execId>** now that the blocking issues are exempted.
- **Promote these exemptions to ORG scope** so other projects benefit from the same waiver.
- **Review the newly created Pending exemptions** with the \`exemption-review\` prompt.
- **Inspect OPA policy_set <name>** to consider tightening or relaxing its rules.`,
          },
        }],
      };
    },
  );
}
