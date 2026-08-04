import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Prescriptive workflow for AIT Knowledge Base crawls/pages/artifacts.
 * Ships with the MCP server so every client (Claude Code, Cursor, etc.) gets
 * the same "use harness_* only" guidance without a per-repo CLAUDE.md.
 */
export function registerExploreKnowledgeBasePrompt(server: McpServer): void {
  server.registerPrompt(
    "explore-knowledge-base",
    {
      description:
        "Explore or crawl an AIT knowledge base via MCP only (kb_crawl / kb_crawl_page / kb_page_artifact). Use for list crawls, page Q&A, and screenshots.",
      argsSchema: {
        goal: z
          .string()
          .describe(
            "What the user wants (e.g. list pages from the latest crawl, share a screenshot of a URL, start a 10-page crawl)",
          ),
        test_environment_id: z
          .string()
          .optional()
          .describe("Test environment UUID when known (list kb_crawl history)"),
        crawl_run_id: z.string().optional().describe("Crawl run UUID when known"),
        page_id: z.string().optional().describe("Crawl page UUID when known"),
      },
    },
    async ({ goal, test_environment_id, crawl_run_id, page_id }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help with the AIT Knowledge Base using Harness MCP tools only.

## Goal
${goal}

## Known IDs (use when provided; otherwise discover via harness_list)
${test_environment_id ? `- test_environment_id=${test_environment_id}` : "- test_environment_id: unknown — list crawls only after the user gives an env id, or ask once"}
${crawl_run_id ? `- crawl_run_id=${crawl_run_id}` : "- crawl_run_id: discover from kb_crawl list (newest completed first)"}
${page_id ? `- page_id=${page_id}` : "- page_id: discover from kb_crawl_page list (filter with query=URL or title)"}

## HARD RULES (do not violate)
1. Use **only** \`harness_list\` / \`harness_get\` / \`harness_create\` / \`harness_execute\` / \`harness_describe\` with resource types \`kb_crawl\`, \`kb_crawl_page\`, \`kb_page_artifact\`. Use \`ait_app\` only if you must map an app name → app_id for create.
2. **Do not** use \`ait_test_environment\` to discover IDs for KB work. That list hits legacy Java (\`/ait/api/v1/testEnvironments\` → \`ait-java-api-service\`). On node-api-only local stacks it returns ENOTFOUND/500 even when KB is healthy. If \`test_environment_id\` is unknown, **ask the user once** — do not chase Java, curl, psql, or kubectl.
3. **Do not** use Bash curl, wget, psql, TypeORM, kubectl, aws/gcloud/gsutil, or open storage buckets for KB data.
4. **Do not** call \`/ait/api/apps\` or other unmatched paths. Unmatched node-api routes proxy to **ait-java-api-service** — unrelated to KB.
5. If a kb_* tool call fails, call \`harness_describe(resource_type=...)\` and retry. An \`ait_test_environment\` failure must not be reported as "AIT/KB is down."
6. Prefer calling \`harness_describe(toolset="ait")\` once at the start if unsure which resources exist.

## Steps
1. **Need test_environment_id** — use the argument if provided; otherwise ask the user. Do not list \`ait_test_environment\` for KB.
2. **Latest crawl** — \`harness_list(resource_type="kb_crawl", params={ test_environment_id, size: 5 })\`. Newest first; prefer \`completed\`.
3. **Pages** — \`harness_list(resource_type="kb_crawl_page", params={ crawl_run_id, query?: "<url or title>", size: 20 })\`.
4. **Page + screenshot** — \`harness_get(resource_type="kb_crawl_page", resource_id=<page_id>, params={ crawl_run_id, include: "screenshot" })\`.
5. **Single artifact** — \`harness_get(resource_type="kb_page_artifact", resource_id="screenshot"|..., params={ crawl_run_id, page_id })\`.
6. **Start a crawl** — \`harness_create(resource_type="kb_crawl", body={ app_id, test_environment_id, max_pages?, ... })\` then poll \`harness_get\` on \`kb_crawl\`.

## Notes
- Enable the opt-in toolset: \`HARNESS_TOOLSETS=+ait\`.
- Local relicx: \`HARNESS_BASE_URL=http://localhost:30082\` and \`HARNESS_ALLOW_HTTP=true\`. Cloud QA often needs a \`/prod1\` prefix on the base URL for AIT — still go through MCP, not curl.
- Screenshots expire (~5 minutes); re-get if the signed URL is stale.`,
          },
        },
      ],
    }),
  );
}
