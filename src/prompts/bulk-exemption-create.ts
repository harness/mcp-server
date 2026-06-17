import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBulkExemptionCreatePrompt(server: McpServer): void {
  server.registerPrompt(
    "bulk-exemption-create",
    {
      description: "Create STO security exemptions in bulk from issue filters or explicit issue IDs. Optimized for repeated component-level exemptions.",
      argsSchema: {
        projectId: z.string().describe("Project identifier where STO issues/exemptions are scoped"),
        orgId: z.string().describe("Organization identifier (optional; defaults to configured org)").optional(),
        issue_ids: z.string().describe("Optional comma-separated STO issue IDs. If supplied, issue search is skipped").optional(),
        issue_filter_input_set: z.object({
          search: z.string().optional(),
          severity_codes: z.string().optional(),
          issue_types: z.string().optional(),
          target_ids: z.string().optional(),
          target_types: z.string().optional(),
          pipeline_ids: z.string().optional(),
          scan_tools: z.string().optional(),
          exemption_statuses: z.string().optional(),
        }).describe("Optional security_issue filter input set. All fields are optional and map directly to harness_list(resource_type='security_issue') filters.").optional(),
        search: z.string().describe("Optional issue search term (component name, CVE, keyword)").optional(),
        severity_codes: z.string().describe("Optional comma-separated severities (Critical,High,Medium,Low,Info)").optional(),
        issue_types: z.string().describe("Optional comma-separated issue types (SAST,DAST,SCA,IAC,SECRET,MISCONFIG)").optional(),
        target_ids: z.string().describe("Optional comma-separated target IDs").optional(),
        target_types: z.string().describe("Optional comma-separated target types (configuration,container,instance,repository)").optional(),
        pipeline_ids: z.string().describe("Optional comma-separated pipeline IDs").optional(),
        scan_tools: z.string().describe("Optional comma-separated scan tools (for example, aqua-trivy, semgrep)").optional(),
        exemption_statuses: z.string().describe("Optional comma-separated exemption statuses (None,Pending,Approved,Rejected,Expired)").optional(),
        exemption_type: z.string().describe("Exemption type to apply: Compensating Controls | Acceptable Use | Acceptable Risk | False Positive | Fix Unavailable | Other"),
        reason: z.string().describe("Business/security justification for creating the exemption"),
        duration_days: z.number().describe("Optional exemption duration in days (defaults to 30 when omitted)").optional(),
        link: z.string().describe("Optional URL for Jira/ticket/reference").optional(),
        expiration: z.number().describe("Optional Unix timestamp when exemption expires").optional(),
      },
    },
    async ({
      projectId,
      orgId,
      issue_ids,
      issue_filter_input_set,
      search,
      severity_codes,
      issue_types,
      target_ids,
      target_types,
      pipeline_ids,
      scan_tools,
      exemption_statuses,
      exemption_type,
      reason,
      duration_days,
      link,
      expiration,
    }) => {
      const orgScope = orgId ? `, org_id="${orgId}"` : "";
      const projectScope = `, project_id="${projectId}"`;
      const issueIdsHint = issue_ids ? `\n- issue_ids input: "${issue_ids}"` : "";
      const inputSetHint = issue_filter_input_set
        ? `\n- issue_filter_input_set: ${JSON.stringify(issue_filter_input_set)}`
        : "";
      const searchHint = search ? `\n- search input: "${search}"` : "";
      const severityHint = severity_codes ? `\n- severity_codes input: "${severity_codes}"` : "";
      const issueTypeHint = issue_types ? `\n- issue_types input: "${issue_types}"` : "";
      const targetIdsHint = target_ids ? `\n- target_ids input: "${target_ids}"` : "";
      const targetTypesHint = target_types ? `\n- target_types input: "${target_types}"` : "";
      const pipelineIdsHint = pipeline_ids ? `\n- pipeline_ids input: "${pipeline_ids}"` : "";
      const scanToolsHint = scan_tools ? `\n- scan_tools input: "${scan_tools}"` : "";
      const exemptionStatusesHint = exemption_statuses ? `\n- exemption_statuses input: "${exemption_statuses}"` : "";

      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Create STO exemptions in bulk for repeated vulnerability findings.

Inputs for this run:
- projectId: "${projectId}"${orgId ? `\n- orgId: "${orgId}"` : ""}${issueIdsHint}${inputSetHint}${searchHint}${severityHint}${issueTypeHint}${targetIdsHint}${targetTypesHint}${pipelineIdsHint}${scanToolsHint}${exemptionStatusesHint}
- exemption_type: "${exemption_type}"
- reason: "${reason}"${duration_days ? `\n- duration_days: ${duration_days}` : ""}${link ? `\n- link: ${link}` : ""}${expiration ? `\n- expiration: ${expiration}` : ""}

Follow this workflow exactly:

1. Build the issue candidate list.
   - If issue_ids is provided, split by comma, trim whitespace, de-duplicate, and use those IDs directly.
   - Otherwise, construct a valid issue filter set from:
     - issue_filter_input_set (if present), plus
     - top-level optional filters: search, severity_codes, issue_types, target_ids, target_types, pipeline_ids, scan_tools, exemption_statuses.
   - Top-level filter args override overlapping keys from issue_filter_input_set.
   - Drop empty/undefined keys and keep only valid security_issue filters listed above.
   - Call harness_list with resource_type="security_issue"${orgScope}${projectScope} and this validated filter set.
   - Paginate as needed until all matching issues are collected.

2. Keep only non-exempt issues.
   - Exclude issues where exemption status is already set (anything other than "None"/empty).
   - If no candidate issues remain, return a short "nothing to create" summary and stop.

3. Create exemptions in bulk (one all-or-none transaction per chunk).
   - Use resource_type="security_exemption_bulk" — NOT a loop of single security_exemption creates.
     The bulk endpoint writes ONE audit row and ONE DB transaction for the whole chunk;
     looping the single endpoint produces N audit rows and N transactions and is the wrong shape here.
   - Chunk the de-duplicated issue_id list into batches of AT MOST 100 items.
   - For every chunk, call:
     harness_create(
       resource_type="security_exemption_bulk"${orgScope}${projectScope},
       body={
         type: "${exemption_type}",
         reason: "${reason}"${duration_days ? `,
         duration_days: ${duration_days}` : ""}${link ? `,
         link: "${link}"` : ""}${expiration ? `,
         expiration: ${expiration}` : ""},
         items: [
           { issue_id: "<issue_id_1>" },
           { issue_id: "<issue_id_2>" },
           ...
         ]
       }
     )
   - DO NOT send requester_id at the top level or per item.
   - DO NOT send exempt_future_occurrences.
   - The server enforces requesterId from the authenticated PAT and always sets exemptFutureOccurrences=true.
   - This prompt is the All Issues (project-scope) workflow — do NOT add target_id or pipeline_id
     to any item. Mixed-scope bulk batches are only valid from the per-execution Vuln tab flow.

4. Handle each chunk's response strictly per its top-level "status":
   - status = "ALL_SUCCEEDED" — record every results[i].id as a created exemption.
   - status = "ALL_FAILED"    — the WHOLE chunk was rolled back. Read results[0].error for the
     cause, record every issue_id in that chunk as failed with that error, and continue to the
     next chunk. DO NOT retry the chunk and DO NOT split it — re-running the same payload will
     hit the same error.
   - status = "MIXED_UNEXPECTED" — server-side contract violation. Surface raw results[] to the
     user, mark every item in the chunk as failed, and stop processing further chunks.
   - status = "EMPTY"          — treat as a failed chunk and surface the raw response.

5. Report results.
   - Return: total candidate issues, total skipped (already exempted), total created, total failed,
     and the number of bulk chunks that succeeded vs failed.
   - Include a compact table with issue_id, status (created/skipped/failed), exemption_id (if created),
     and failure reason (if failed).
   - If any chunk failed, end with a one-line recommendation: fix the root cause from
     results[0].error and re-run this prompt with the failed issue_ids — never retry mid-batch.

Pipeline Agent Integration Pattern:
- This prompt is designed for a downstream step after "Snyk Agent Security Scan".
- You can feed scan outputs such as:
  - <+steps.agent_security_scan.output.outputVariables.SCAN_STATUS>
  - <+steps.agent_security_scan.output.outputVariables.ISSUES_COUNT>
  - <+steps.agent_security_scan.output.outputVariables.RISK_LEVEL>
  - <+steps.agent_security_scan.output.outputVariables.REPORT_PATH>
- Example policy:
  - If SCAN_STATUS == "findings_found" and RISK_LEVEL in ["error", "warn"], run this prompt.
  - Build an input set with only the filters you need (all optional), then invoke this prompt.

Example input set pattern:
- issue_filter_input_set = {
    search: "<component-or-cve-filter>",
    severity_codes: "Critical,High",
    issue_types: "SCA,SECRET",
    target_ids: "<optional-target-ids>",
    target_types: "repository",
    pipeline_ids: "<optional-pipeline-ids>",
    scan_tools: "<optional-scan-tools>",
    exemption_statuses: "None"
  }

Then call bulk-exemption-create with:
- projectId (+ orgId if needed)
- issue_filter_input_set (all keys optional)
- exemption_type
- reason
- optional duration_days/link/expiration`,
          },
        }],
      };
    },
  );
}
