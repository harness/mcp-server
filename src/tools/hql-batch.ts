import * as z from "zod/v4";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { toMcpError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HarnessClient } from "../client/harness-client.js";

const dynamicObject = z.object({}).catchall(z.unknown());

const validateOutputSchema = z.object({
  results: z.array(z.object({
    query_string: z.string().describe("The HQL query that was validated"),
    is_valid: z.boolean().describe("Whether the query is valid"),
    errors: z.array(dynamicObject).describe("Validation errors, if any"),
  })).describe("Validation results per query"),
  summary: z.object({
    total: z.number().describe("Total number of queries validated"),
    valid: z.number().describe("Number of valid queries"),
    invalid: z.number().describe("Number of invalid queries"),
  }).describe("Summary counts"),
});

const executeOutputSchema = z.object({
  results: z.array(z.object({
    query_string: z.string().describe("The HQL query that was executed"),
    success: z.boolean().describe("Whether execution succeeded"),
    columns: z.array(dynamicObject).optional().describe("Column definitions"),
    rows: z.array(dynamicObject).optional().describe("Result rows"),
    stats: dynamicObject.optional().describe("Execution statistics"),
    error: z.string().optional().describe("Error message if execution failed"),
  })).describe("Execution results per query"),
  summary: z.object({
    total: z.number().describe("Total number of queries executed"),
    succeeded: z.number().describe("Number of successful executions"),
    failed: z.number().describe("Number of failed executions"),
  }).describe("Summary counts"),
});

const log = createLogger("hql-batch");

const VALIDATE_PATH =
  "/query-service/grpc/io.harness.platform.query.service.api.v1.QueryServiceGrpc/validateQuery";
const EXECUTE_PATH =
  "/query-service/grpc/io.harness.platform.query.service.api.v1.QueryServiceGrpc/executeQuery";

// ─── Batch Validate ──────────────────────────────────────────────────────────

interface ValidationResponse {
  is_valid: boolean;
  errors?: Array<{ message: string; location?: string; code?: string; hint?: string }>;
}

interface ValidationResult {
  query_string: string;
  is_valid: boolean;
  errors: Array<{ message: string; location?: string; code?: string; hint?: string }>;
}

function registerBatchValidateHql(server: McpServer, client: HarnessClient): void {
  server.registerTool(
    "harness_batch_validate_hql",
    {
      description:
        "Validate multiple HQL queries in a single call. Returns validation results for each query. " +
        "Use this instead of calling harness_execute(action='validate') multiple times — " +
        "much faster for dashboards with many widgets.",
      inputSchema: {
        queries: z.array(z.string()).describe("Array of HQL query strings to validate"),
      },
      outputSchema: validateOutputSchema,
      annotations: {
        title: "Batch Validate HQL Queries",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const { queries } = args;

        if (!queries || queries.length === 0) {
          return errorResult("queries array cannot be empty. Provide at least one HQL query string.");
        }

        if (queries.length > 20) {
          return errorResult(
            "queries array cannot contain more than 20 queries. Split into multiple batches.",
          );
        }

        log.info("Batch validating HQL queries", { count: queries.length });

        const validationPromises = queries.map((query: string) =>
          client.request<ValidationResponse>({
            method: "POST",
            path: VALIDATE_PATH,
            body: { query_string: query },
          }),
        );

        const settledResults = await Promise.allSettled(validationPromises);

        const results: ValidationResult[] = settledResults.map(
          (result: PromiseSettledResult<ValidationResponse>, index: number) => {
            const query_string = queries[index] ?? "";

            if (result.status === "fulfilled") {
              return {
                query_string,
                is_valid: result.value.is_valid,
                errors: result.value.errors ?? [],
              };
            } else {
              const error = result.reason;
              const errorMessage = error instanceof Error ? error.message : String(error);
              return {
                query_string,
                is_valid: false,
                errors: [{ message: errorMessage }],
              };
            }
          },
        );

        const total = results.length;
        const valid = results.filter((r) => r.is_valid).length;
        const invalid = total - valid;

        log.info("Batch validation complete", { total, valid, invalid });

        return jsonResult({ results, summary: { total, valid, invalid } });
      } catch (err) {
        log.error("Batch validation failed", { error: String(err) });
        if (err instanceof Error && err.message.includes("queries")) {
          return errorResult(err.message);
        }
        throw toMcpError(err);
      }
    },
  );
}

// ─── Batch Execute ───────────────────────────────────────────────────────────

const QueryInputSchema = z
  .object({
    query_string: z.string().describe("HQL query string to execute"),
    timeout_ms: z.number().optional().describe("Per-query timeout in milliseconds"),
    max_results: z.number().optional().describe("Maximum rows to return per query"),
  })
  .describe("A single HQL query with optional execution options");

interface ExecuteResponse {
  columns?: unknown[];
  rows?: unknown[];
  stats?: unknown;
}

interface ExecutionResult {
  query_string: string;
  success: boolean;
  columns?: unknown[];
  rows?: unknown[];
  stats?: unknown;
  error?: string;
}

function registerBatchExecuteHql(server: McpServer, client: HarnessClient): void {
  server.registerTool(
    "harness_batch_execute_hql",
    {
      description:
        "Execute multiple HQL queries in a single call. Returns results (columns, rows, stats) for each query. " +
        "Use this for KG analysis workflows that need data from several queries — " +
        "much faster than sequential harness_execute(action='run') calls.",
      inputSchema: {
        queries: z.array(QueryInputSchema).describe("Array of HQL queries to execute"),
      },
      outputSchema: executeOutputSchema,
      annotations: {
        title: "Batch Execute HQL Queries",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const { queries } = args;

        if (!queries || queries.length === 0) {
          return errorResult("queries array cannot be empty. Provide at least one HQL query.");
        }

        if (queries.length > 10) {
          return errorResult(
            "queries array cannot contain more than 10 queries. Split into multiple batches.",
          );
        }

        log.info("Batch executing HQL queries", { count: queries.length });

        const executePromises = queries.map((q: z.infer<typeof QueryInputSchema>) => {
          const body: Record<string, unknown> = { query_string: q.query_string };
          if (q.timeout_ms != null || q.max_results != null) {
            body.options = {
              ...(q.timeout_ms ? { timeout_ms: q.timeout_ms } : {}),
              ...(q.max_results ? { max_results: q.max_results } : {}),
              include_stats: true,
            };
          }
          return client.request<ExecuteResponse>({ method: "POST", path: EXECUTE_PATH, body });
        });

        const settledResults = await Promise.allSettled(executePromises);

        const results: ExecutionResult[] = settledResults.map(
          (result: PromiseSettledResult<ExecuteResponse>, index: number) => {
            const query_string = queries[index]?.query_string ?? "";

            if (result.status === "fulfilled") {
              return {
                query_string,
                success: true,
                columns: result.value.columns,
                rows: result.value.rows,
                stats: result.value.stats,
              };
            } else {
              const error = result.reason;
              const errorMessage = error instanceof Error ? error.message : String(error);
              return { query_string, success: false, error: errorMessage };
            }
          },
        );

        const total = results.length;
        const succeeded = results.filter((r) => r.success).length;
        const failed = total - succeeded;

        log.info("Batch execution complete", { total, succeeded, failed });

        return jsonResult({ results, summary: { total, succeeded, failed } });
      } catch (err) {
        log.error("Batch execution failed", { error: String(err) });
        if (err instanceof Error && err.message.includes("queries")) {
          return errorResult(err.message);
        }
        throw toMcpError(err);
      }
    },
  );
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerHqlBatchTools(server: McpServer, client: HarnessClient): void {
  registerBatchValidateHql(server, client);
  registerBatchExecuteHql(server, client);
}
