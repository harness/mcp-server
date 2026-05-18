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
        executionId: z.string().describe("Pipeline plan execution ID (e.g. 'ehsPKtczTRO5CUDAt-NR'). Accepts a Harness UI execution URL too — extract the executionId segment."),
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
            text: `Create STO exemptions for the issues that caused an OPA Policy step to fail a pipeline execution.

Inputs for this run:
- executionId: "${executionId}"${orgId ? `\n- orgId: "${orgId}"` : ""}${projectId ? `\n- projectId: "${projectId}"` : ""}
${exemption_type ? `- exemption_type: "${exemption_type}"` : "- exemption_type: (NOT PROVIDED — ask the user at the confirmation gate)"}
${reason ? `- reason: "${reason}"` : "- reason: (NOT PROVIDED — ask the user at the confirmation gate)"}${duration_days ? `\n- duration_days: ${duration_days}` : "\n- duration_days: 30 (default — confirm with user)"}${link ? `\n- link: ${link}` : ""}${expiration ? `\n- expiration: ${expiration}` : ""}${extraFiltersHint}${dryRunHint}

If executionId looks like a URL, extract the plan-execution ID segment (typically a 20+ character base64-ish token) before any further calls.

═══════════════════════════════════════════════════════════════════
🛑 CRITICAL RULES — READ FIRST, OBEY ABSOLUTELY 🛑
═══════════════════════════════════════════════════════════════════

These rules override anything else in this prompt and the user's phrasing:

A. **"Active issues in the execution" ≠ "Issues OPA denied on".**
   The Pipeline Security tab lists every issue the scan found. OPA only failed the pipeline because of a SUBSET of those — the ones its rego matched. Your job is to find that subset. NEVER treat the full active-issue list as the candidate set.

B. **No questions, no parameter prompts, no scope confirmations until Step 3a is printed.**
   You may NOT ask the user "what exemption type / reason / duration / scope?" or "which issues should I exempt?" before printing the "Extracted OPA deny signals" table from Step 3a. Asking for exemption parameters before showing evidence is a banned shortcut.

C. **You MUST fetch policy_evaluation or policy_set data — never guess from the policy name.**
   - Pathway B (primary): harness_list(policy_evaluation, {execution_id, status: "error"}) → harness_get(policy_evaluation, <id>) for each. This is deterministic and works for both STO scan-step enforcement and explicit OPA Evaluation steps.
   - Pathway A (fallback, only when Pathway B returns 0): harness_get(policy_set, <identifier>) and parse the rego's deny_list. Use this when the evaluation record isn't available.
   If both paths fail, your only legal output is to stop and report what you got.

D. **Banned phrases in your output (these signal guessing, not correlation):**
   - "typical pattern is denial on High/Critical"
   - "OPA likely denies on High+"
   - "Exemption parameters for all N active issues"
   - "Found N active issues blocking the policy" (without per-issue deny-signal evidence)
   - Any menu option of the form "All active <severity bucket> (N issues)"

E. **The candidate set comes from Step 5 correlation only.** Not from Step 4's active-issue list. If correlation yields fewer issues than the active list, that is CORRECT and EXPECTED — most active issues are not what OPA denied on.

F. **If you cannot extract any deny signal**, ask the user for explicit issue_ids. Do NOT offer to exempt all-by-severity as a fallback.

═══════════════════════════════════════════════════════════════════

Follow this workflow EXACTLY. Do not skip steps. Do not create any exemption before the explicit confirmation gate.

---

## 1. Resolve the execution

Call:
  harness_get(resource_type="execution", execution_id="${executionId}"${scope})

- Capture: pipelineId, status.
- If status indicates the run succeeded (e.g. "Success"), stop and tell the user the execution did NOT fail — exemptions are unnecessary. Suggest they re-check the executionId.
- If the execution does not exist, surface the error verbatim and stop.

## 2. Find the failing OPA evaluation(s) for this execution

The policy_evaluation resource indexes BOTH enforcement pathways:
  - Pipeline governance (action=onrun, type=pipeline) — pre-run policies.
  - STO scan-step enforcement (action=onstep, type=securityTests) — the \`enforce.policySets\` field on a Semgrep/Trivy/etc. step.
  - Explicit OPA Evaluation step (action=onstep, type=custom or type=securityTests).

The resource definition automatically sets \`created_date_from=0\` so older executions are not silently filtered out by policy-mgmt's default 7-day window.

### Pathway B (PRIMARY) — direct lookup by execution_id

Call:
  harness_list(resource_type="policy_evaluation",
               filters={ execution_id: "${executionId}", status: "error" }${scope})

- Paginate until exhausted.
- If the result is non-empty, proceed to Step 3 (read each evaluation's deny_messages — deterministic).
- If the result is empty, proceed to Pathway A below.

### Pathway A (FALLBACK) — derive from policy_set rego

Use this ONLY when Pathway B genuinely returned 0 items (e.g. policy-mgmt is degraded, the evaluation hasn't been persisted yet, or the upstream date-window override was bypassed). It produces a candidate set without any evaluation record, by reading the policy set definition directly:

1. Read the execution's failure message from Step 1. It is typically: \`"The following Policy Set was not adhered to: <display_name>"\`.
2. Extract the display name(s). Note: the *display* name (e.g. "anurag-set") may differ from the *identifier* (e.g. "anuragset").
3. Resolve display name → identifier: inspect the execution's pipeline YAML for \`enforce.policySets: ["<identifier>"]\`, OR call \`harness_list(resource_type="policy_set", filters={ search_term: "<display name>" }${scope})\` and match by name.
4. For each resolved identifier, call \`harness_get(resource_type="policy_set", resource_id="<identifier>"${scope})\`. The response includes each policy's \`rego\` source and per-policy \`severity\` ("error" = Error & Exit, "warning" = Warn & Continue — only the "error" policies can fail the pipeline).
5. Skip Step 3 entirely and jump to Step 3b (rego-based filter extraction).

If BOTH pathways fail to produce a candidate signal → stop and tell the user verbatim:
    "No failing OPA artifact found for execution ${executionId}. Pathway B (policy_evaluation list) returned 0 items and Pathway A (policy_set lookup from failure message) also produced no usable signal. This may be a non-OPA failure (e.g. an STO step 'Fail On' severity threshold). Try harness_diagnose(resource_type='execution', execution_id='${executionId}') to find the real cause."

## 3. Read each failing evaluation and classify

For each evaluation in the list, call:
  harness_get(resource_type="policy_evaluation", evaluation_id=<id>${scope})

This call is MANDATORY — you cannot proceed using only the list response. The list returns summary metadata; only the get response contains evaluation.details[].details[] with deny_messages, output, and policy_severity. If you skip this call you have no evidence and you must stop, not guess.

If harness_get returns an error or empty details for every evaluation_id, stop and tell the user verbatim: "Called harness_get(policy_evaluation, <id>) and received <actual response summary>. Cannot extract deny signals without evaluation details — please verify the evaluation exists or check permissions." Do NOT proceed to ask the user which severity to exempt — that is guessing.

The returned Evaluation has a TWO-LEVEL details structure (per policy-mgmt's schema):

  Evaluation
    .input                                   ← raw policy input (used in Shortcut 2 below)
    .details[]                               ← one entry per POLICY_SET (EvaluationDetail)
        .identifier                          ← the policy_set identifier (already embedded — no separate fetch needed)
        .name, .type, .action, .enabled
        .status: "error"|"warning"|"pass"|"pending"
        .details[]                           ← one entry per POLICY inside the set (EvaluatedPolicy)
            .status: "error"|"warning"|"pass"|"pending"
            .policy_severity: "Warn & Continue" | "Error & Exit"
            .policy: { identifier, name, rego, ... }
            .output: Any                     ← typically { "deny": [...] } (used in Shortcut 1 below)
            .deny_messages: string[]
            .error: string                   ← rego parse error, if any

For each evaluation, walk evaluation.details[] (the per-policy-set level) and classify by the embedded type/action (do NOT fetch the policy_set separately — its identifier, name, type, action are already on EvaluationDetail). Valid (type, action) combinations are fixed by policy-mgmt's ValidPolicySetTypeActions map:

- CASE A (REFUSE — pipeline governance) — set.type == "pipeline" AND set.action in ("onrun", "onsave", "onstepstart"):
    The OPA blocked the pipeline at run/save time, before any scan executed. There are no scan-issue findings to exempt. REFUSE this set: tell the user the failure is pipeline governance, not scan results — they need to amend the pipeline YAML or the governance policy itself. (Note: type=pipeline CANNOT have action=onstep — that combination is not valid in policy-mgmt.)

- CASE B (REFUSE — SBOM enforcement) — set.type == "sbom" AND set.action == "onstep":
    SBOM / SCS BOM enforcement — different domain (artifact components, not STO issues). REFUSE this set and route the user to:
      harness_list(resource_type="scs_bom_violation", filters={ enforcement_id: ... })

- CASE C (PROCEED — STO-driven OPA step) — EITHER:
    (i)  set.type == "securityTests" AND set.action == "onstep"   ← canonical STO policy step in a SecurityTests stage
    (ii) set.type == "custom"        AND set.action == "onstep"   ← Custom Stage OPA Evaluation step (may or may not be evaluating STO output)
    For (ii) the input shape is fully customer-defined; the skill still proceeds but should warn that correlation accuracy depends on what the customer's Rego consumes.

If a policy_set's (type, action) combination falls outside the cases above, treat it as CASE A by default (refuse, surface the unfamiliar type/action to the user).

If after classification ZERO policy_sets are in CASE C across all evaluations, stop and explain why — typically this means the failure is pipeline governance or SBOM enforcement, not STO scan denial.

For each remaining CASE C policy_set, walk its inner details[] (EvaluatedPolicy level) and KEEP ONLY entries where BOTH conditions hold:

    (1) policy.status == "error"                   — the policy actually denied this run
    (2) policy.policy_severity == "Error & Exit"   — this policy is configured to FAIL the pipeline on deny

Both checks are required. A policy with policy_severity = "Warn & Continue" that has status = "error" emits a warning but does NOT fail the pipeline — its deny messages must NOT be collected (otherwise we would over-exempt).

Collect from each kept EvaluatedPolicy:
- policy.identifier, policy.name (for display + Rego fallback)
- policy.rego (only if needed in correlation fallback when deny_messages are opaque)
- deny_messages (string[])
- output (typically { "deny": [...] } — used in Shortcut 1 below)
- parent policy_set identifier + name (for "Denied by policy set …" attribution in the candidate table)

Build a deduplicated set of deny_signals across all kept policies.

### 3b. Pathway A — extract filters directly from the policy_set rego

(Use this ONLY when you arrived from Pathway A in Step 2 — i.e. you have a policy_set object from harness_get(policy_set, …) but NO policy_evaluation record.)

The canonical Harness STO deny-list / allow-list rego template (used by 95%+ of customers) parses a structured \`deny_list\` block at the top of the rego. Extract it:

1. For each policy in \`policy_set.policies[]\` where \`policy.severity == "error"\` (= "Error & Exit"; "warning" policies don't fail the pipeline):
2. Parse the rego source. Locate the assignment of the form:
     deny_list := fill_defaults([
       { "severity": {"value": "High", "operator": "=="}, ... },
       { "title":    {"value": "log4j", "operator": "~"},  ... },
       ...
     ])
   Each entry is an object with keys: \`severity\`, \`title\`, \`refId\`, \`refType\`, \`year\`, \`maxOccurrences\`, \`epssScore\` (each with \`{value, operator}\`).
3. Translate each rule entry into a pipeline_security_issue filter:
     - \`severity == X\`            → severity_codes filter contains X
     - \`severity (>=|>) X\`        → severity_codes includes X and everything above (Critical > High > Medium > Low > Info)
     - \`title == X\` or \`~ X\`     → search="X" (or post-filter on title)
     - \`refId == CVE-…\`           → match against issue.key (post-filter)
     - \`refType == cve\`           → matches all CVE entries (use issue.key prefix "CVE-")
     - \`maxOccurrences >= N\`      → post-filter on issue.numOccurrences >= N
4. Print the **"Extracted OPA deny signals"** table from Step 3a, but with these rows:

| policy_set | policy | source | extracted_signal_type | extracted_signal_value |
|---|---|---|---|---|
| anurag-set | anuraghigh | rego deny_list | severity_eq | High |

The signal_type vocabulary is the same as Step 3a (\`bracketed_title\`, \`cve\`, \`component\`, \`severity_only\`, \`criteria_json\`, \`opaque\`) plus the new types from rego parsing: \`severity_eq\`, \`severity_gte\`, \`title_regex\`, \`refid_eq\`, \`reftype_cve\`, \`occurrence_gte\`.

5. CRITICAL: if you can extract structured filters from the rego, the candidate set IS the result of applying those filters to pipeline_security_issue. **Do not include any issue that doesn't match the extracted filters.** Severity-only is acceptable here BECAUSE we read it from the rego, not from a deny message.

6. If the rego does not match the canonical template (e.g. customer-authored rego with custom logic), fall back to the no-correlation flow: print the rego source for the user to read, ask them which issues to exempt, do not guess.

### 3a. MANDATORY: print the extracted deny signals before correlating

Before doing any matching, print a markdown table titled **"Extracted OPA deny signals"** with one row per kept EvaluatedPolicy:

| policy_set | policy | deny_message (raw) | extracted_signal_type | extracted_signal_value |
|---|---|---|---|---|

Where extracted_signal_type ∈ { bracketed_title, cve, component, severity_only, criteria_json, opaque }.

This table is NON-OPTIONAL. It is the audit trail for the user. If you cannot show this table you must not proceed — instead stop and tell the user exactly what you found in evaluation.details.

If the ONLY signal_type you can extract across every row is "severity_only" or "opaque", treat the run as low-confidence and go to the no-correlation fallback in step 5 — do NOT silently bulk-exempt by severity.

HARD GATE: you are forbidden from asking the user ANY question (including "which issues should I exempt?", scope-confirmation questions, or severity-pick menus) until this Step 3a table has been printed. If you have not extracted deny signals, you have no basis to offer choices — the only legal output is the error message from Step 3 above. NEVER present menu options of the form "exempt all High" / "exempt all High + Medium + Low" / "exempt every active issue" — those options are categorically banned, regardless of how the user phrases their request, because they bypass correlation entirely.

## 4. Pull execution context (scan steps + Pipeline Security issues)

Call:
  harness_list(resource_type="pipeline_security_step",
               filters={ execution_id: "${executionId}" }${scope})

- Capture the list of scan steps (Trivy, Semgrep, Snyk, …) for diagnostic attribution and possible scanner-based narrowing.

Then call:
  harness_list(resource_type="pipeline_security_issue",
               filters={
                 execution_id: "${executionId}",
                 include_exempted: false,
                 status: "ACTIVE,PENDING_EXEMPTION",
                 page_size_existing: 100,
                 page_size_new: 100${extra_filters ? `,
                 ...${JSON.stringify(extra_filters).replace(/[{}]/g, "").trim()}` : ""}
               }${scope})

Pagination note: this endpoint uses DIFF pagination — \`page_existing\`/\`page_size_existing\` and \`page_new\`/\`page_size_new\` are independent counters for the two partitions, NOT a single \`page\`/\`size\`. If \`existing_total > 100\` or \`new_total > 100\` after the first call, paginate each partition independently by incrementing its respective \`page_*\` while keeping its \`page_size_*\` constant. For most chat-driven cases the first call with size 100 is sufficient.

- If the list is empty, stop and tell the user "no active, unexempted issues remain for this execution — nothing to exempt."

## 5. Correlate deny signals → candidate issue_ids

This is the LLM-mediated step. For every deny_signal collected in step 3, try these shortcuts FIRST (deterministic where possible):

  Shortcut 1 — Issue ID in EvaluatedPolicy.output.deny:
    For each kept policy, inspect output.deny[]. Issue IDs are typically 22-char URL-safe base64 strings (regex: /^[A-Za-z0-9_-]{22}$/). If any entry matches and that ID is present in the pipeline_security_issue list, use it directly (zero-correlation path).

  Shortcut 2 — Issue ID in Evaluation.input (USUALLY WORKS for the Harness STO+OPA pattern):
    The Evaluation.input is whatever the customer's pipeline YAML fed into the OPA step. For the CANONICAL Harness pattern (STO scan step → OPA Evaluation step referencing <+steps.scan_x.output.outputVariables.Issues>), the input contains the response of sto-core's GET /api/v2/scans/{scanId}/issues. Crucially, IDs in that response come from the SAME IssueID type as pipeline_security_issue.id, so a deterministic join is possible.

    KNOWN INPUT SHAPES (do NOT give up after checking only one):
      Shape A — pipeline-service "aggregator" wrapping (very common for SecurityTests stage Policy steps):
          [
            { "name": "securityTestData",
              "outcome": { "issues": [ { "id": "abc...22", "title": "...", "severityCode": "High", ... }, ... ] } },
            ...
          ]
          The Rego identifies its own step block via input[i].name == "securityTestData", then reads input[i].outcome.issues[j].
      Shape B — direct passthrough (less common):
          { "issues": [ { "id": "abc...22", ... }, ... ]  }
      Shape C — Custom Stage policy where the customer wired the payload by hand:
          fully custom; could be anything.

    Strategy:
      1. Walk Evaluation.input RECURSIVELY (objects + arrays at any depth).
      2. Collect every object that has an "id" field matching /^[A-Za-z0-9_-]{22}$/ AND at least one other STO-like field (title, severityCode, scanId, key) — this filters out unrelated 22-char IDs.
      3. Intersect those .id values with the pipeline_security_issue list (match on .id).
      4. Any matches are deterministic candidates — use them directly.

    This works out of the box for customers who wire STO output variables into the Policy step the standard way. It does NOT work when:
      - The customer transforms the payload (e.g. extracts only counts / CVE strings before passing to OPA).
      - The customer feeds raw scanner JSON instead of going through STO output variables.
      - The OPA step is a Custom Stage policy step evaluating unrelated data.

    On no match, fall through silently to the fuzzy path below — do NOT raise an error.

If neither shortcut yields matches, fall back to fuzzy extraction from deny_messages and (when present) policy.rego. Extract signals in this priority order:

  (a) Bracketed/quoted substrings inside the deny message — these are usually the issue title.
      Common Harness deny-list template format:
        "Vulnerability ['<issue.title>'] matches the following item found on the deny list '<criteria>'"
      Regex: /\\['([^']+)'\\]|"([^"]+)"/g  — collect every captured substring.
      Match each captured substring against pipeline_security_issue.title (case-insensitive substring match).
      This is the SINGLE BIGGEST signal for the deny-list policy template; do NOT skip this step.
  (b) CVE pattern: /CVE-\\d{4}-\\d{4,}/   — match against pipeline_security_issue.key (IssueSummary has .key, NOT .cve).
  (c) Severity keyword: Critical / High / Medium / Low / Info   — match against pipeline_security_issue.severityCode.
      ⚠️ Severity-only is the WEAKEST signal and is the #1 source of over-exemption. Apply it ONLY when ALL of the following hold:
        - the deny message contains NO bracketed title, NO CVE, NO component name, and no parseable criteria JSON, AND
        - the deny message explicitly names a severity (e.g. "High severity vulnerabilities are not allowed"), AND
        - the severity-filtered candidate count is reasonable relative to the number of failing policies (a single deny message should not justify exempting dozens of unrelated issues).
      Do NOT infer "OPA probably denies on High+" from the policy name or rego — that is a guess, not a signal. If the deny message itself does not name a severity, this rule does not apply.
  (d) Issue type keyword: SAST / DAST / SCA / IAC / SECRET / MISCONFIG / EXTERNAL_POLICY   — match against pipeline_security_issue.type.
  (e) Target / variant identifier (e.g. image tag, repo name)   — match against pipeline_security_issue.targetVariantName.
  (f) Component / library name (e.g. "log4j", "openssl") not already captured by (a)   — fuzzy substring match against pipeline_security_issue.title.

  Note on the deny-list rule criteria (the second '%s' in the message — Harness deny-list template): the criteria string contains structured key-value pairs like:
    - {"severity": {"value": "High", "operator": "=="}}         → severity filter (exact / range)
    - {"title":    {"value": "log4j", "operator": "~"}}         → title is a REGEX (operator "~"); use as a case-insensitive title regex filter
    - {"refId":    {"value": "CVE-2021-44228", "operator": "=="}} → match against pipeline_security_issue.key
    - {"refType":  {"value": "cve", "operator": "=="}}          → narrows the kind of identifier
    - {"year":     {"value": 2021, "operator": ">="}}            → CVE year range (applies to refType="cve")
    - {"maxOccurrences": {"value": 5, "operator": ">="}}        → match against pipeline_security_issue.numOccurrences

  Operators: "==" exact, "!" not, "~" regex, "<=" "<" ">=" ">" numeric/semver ranges. Parse what you can and translate to pipeline_security_issue filters. For policies that emit ONE deny per matching issue, the bracketed title from signal (a) is usually enough on its own; the criteria parse is a useful cross-check.

For SCANNER-based narrowing, IssueSummary itself does NOT carry a scanner name. Use the matching_steps array returned alongside the issue list (each entry is { stageId, stepId }), or cross-reference the pipeline_security_step list from step 4 (each step has a productName / scanner identifier). If the deny message clearly implicates one scanner, re-list with steps="stageId.stepId" to tighten:
  harness_list(resource_type="pipeline_security_issue",
               filters={ execution_id, include_exempted=false, status="ACTIVE,PENDING_EXEMPTION", steps: "<stageId>.<stepId>" }${scope})

If after all of the above NO candidates are found, do NOT silently assume "exempt everything" and do NOT propose "exempt all N" as a default. Instead:
  1. Print the deny_signals table (from step 3a) AND the full pipeline_security_issue list as two separate tables.
  2. Ask the user verbatim: "I could not deterministically correlate the OPA deny signals above to specific issues in this execution. Please reply with the issue_ids (or a filter like severity=High) you want exempted. I will NOT default to exempting all issues."
  3. Wait for an explicit issue list or filter. Do not proceed otherwise.

### 5a. Sanity check the candidate set BEFORE step 6

Before rendering the candidate table, verify ALL of the following. If ANY check fails, stop and surface the discrepancy to the user instead of proceeding:

  - Every candidate issue_id was produced by AT LEAST ONE deny_signal from step 3a — record which signal in a \`matched_deny\` field. Issues with no matched signal MUST NOT be candidates.
  - The candidate count is plausible given the deny messages. Rough heuristic: for deny-list-template policies (one deny per matching issue), expect \`candidates ≈ deny_messages.length\`. If candidates exceeds deny_messages.length by more than 2× AND the extra issues were added by severity-only matching, drop the severity-only-only candidates and re-check.
  - You did NOT pull in issues whose only relationship to the deny signal is sharing a severity with the failing policies' rego — that is a guess.

If the candidate count differs substantially from the number of deny messages, state this explicitly in your reply (e.g. "3 deny messages → 3 candidates" or "3 deny messages but 17 candidates — flagging mismatch").

## 6. Present the candidate table

Render a markdown table with one row per candidate issue:

| issue_id | severity | cve / key | component / title | scanStep | partition | matched_deny |
|---|---|---|---|---|---|---|

Also print summary lines:
- "Denied by policy_set(s): <names from step 3>"
- "Total candidates: N"
- "Already exempted (will skip): M"
- "Created on this run: 0 (pending confirmation)"

## 7. Confirmation gate

If \`exemption_type\` or \`reason\` was NOT provided at invocation time, ask for them HERE (after the candidate table has been shown) with a single combined question:
  "Found <N> candidate exemption(s). To create them I need:
   - exemption_type: one of 'Compensating Controls' | 'Acceptable Use' | 'Acceptable Risk' | 'False Positive' | 'Fix Unavailable' | 'Other'
   - reason: a one-line justification
   - duration_days: number (default 30)
   Reply with these, or 'cancel' to abort."

Otherwise (both were provided), ask EXACTLY once:
  "Confirm creating <N> exemption(s) with type='${exemption_type ?? "<to be supplied>"}', reason='${reason ?? "<to be supplied>"}'${duration_days ? `, duration_days=${duration_days}` : ", duration_days=30 (default)"}? Reply 'yes' to proceed or list the issue_ids to keep."

DO NOT proceed without an affirmative reply AND a populated exemption_type + reason. If dry_run was true at the top of this run, STOP HERE and do not create anything regardless of the reply.

## 8. Bulk create exemptions

For every confirmed issue_id call:
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

DO NOT send requester_id. DO NOT send exempt_future_occurrences. The server enforces both.

## 9. Final summary

Render a results table:

| issue_id | status | exemption_id | failure_reason |
|---|---|---|---|

Where status is "created" | "skipped (already exempt)" | "failed".

Then totals:
- Total candidates: <N>
- Created: <created>
- Skipped: <skipped>
- Failed: <failed>

## 10. Suggested next steps

Append a section titled "## Suggested next steps" with 3–5 personalized, send-as-is sentences. Use real human-readable values (CVE / component / policy_set name); NEVER raw UUIDs in the visible text. Examples (shape only — use real values):

- Retry pipeline execution <execId> now that the blocking issues are exempted.
- Promote these exemptions to ORG scope so other projects benefit from the same waiver.
- Review the newly created Pending exemptions with the security-exemption-review prompt.
- Inspect the OPA policy_set <name> to consider tightening or relaxing its rules.

Rules:
- Bold imperative sentences only, one per bullet.
- Maximum 5 suggestions.
- Omit the section entirely if NOTHING was created and NOTHING is actionable.

---

Guardrails (must hold throughout):

1. NEVER create an exemption without an explicit affirmative reply from the user (or dry_run=true bypass — and dry_run=true means: stop, do not create).
2. NEVER collect deny signals from EvaluatedPolicy entries unless BOTH status == "error" AND policy_severity == "Error & Exit". A policy configured as "Warn & Continue" does not fail the pipeline even when its rego returns error — collecting from such policies over-exempts.
3. NEVER use harness_list(resource_type="security_issue") for this skill — that is the cross-execution Issues page. Use pipeline_security_issue (execution-scoped) only.
4. NEVER send requester_id or exempt_future_occurrences in the exemption body.
5. If correlation yields 0 candidates, ASK with an explicit issue-id / filter request — NEVER propose "exempt all N", "exempt all High", or any severity-bucket option as a menu choice. The user must supply the IDs.
6. Every candidate row in step 6 MUST cite at least one specific deny_signal from the step 3a table. "OPA likely denies on High+", "typical pattern is denial on High/Critical", or similar inferences from the policy name/rego are NOT valid signals and must not appear as \`matched_deny\` — nor may they appear anywhere in your reasoning shown to the user.
7. If the only signal type extracted is severity_only or opaque, you MUST go to the no-correlation fallback (step 5) and ask the user for explicit IDs — do not silently severity-filter and do not offer severity-based menu options.
8. You are FORBIDDEN from asking the user any question before printing the Step 3a deny-signals table. If you reach a state where you want to ask "which issues should I exempt?" or similar, that is a signal you skipped Step 3 — go back and call harness_get on each evaluation_id first.
9. Menu options of the form "All active High + Medium + Low (N issues)" or "High severity only (N issues)" are categorically banned. You may present a candidate table derived from extracted deny signals, or you may ask for explicit issue_ids — nothing else.`,
          },
        }],
      };
    },
  );
}
