/**
 * End-to-end & invariant test suite for Option A Resource-as-Code (`harness_get` + `harness_update`)
 * AND the client-side Code Mode sandbox runtime (`executeInCodeMode`), including HQL authoring
 * and 3-way context-window byte comparisons.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import YAML from "yaml";
import { clearIdempotencyStoreForTests } from "../../src/code-engine/index.js";
import { executeInCodeMode, type McpToolInvoker } from "../../src/code-mode/runtime.js";
import type { Config } from "../../src/config.js";
import { createHarnessServer } from "../../src/index.js";

const STATE_KEY = "test-request-state-hmac-key-at-least-32-bytes!";

function makeServerConfig(overrides?: Partial<Config>): Config {
  return {
    HARNESS_API_KEY: "pat.testaccount.tokenid.secret",
    HARNESS_ACCOUNT_ID: "testaccount",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "eng",
    HARNESS_PROJECT: "platform",
    HARNESS_API_TIMEOUT_MS: 10_000,
    HARNESS_MAX_RETRIES: 0,
    HARNESS_SCHEMA_MODE: "compact",
    HARNESS_AUTO_APPROVE_RISK: "all",
    HARNESS_READ_ONLY: false,
    HARNESS_MCP_REQUEST_STATE_KEY: STATE_KEY,
    HARNESS_TOOLSETS: "+pipelines,+governance,+services,+ccm,+knowledge-graph,+semantic-layer",
    LOG_LEVEL: "error",
    ...overrides,
  } as Config;
}

/**
 * Representative multi-stage v0 pipeline fixture with comments, parallel steps,
 * nested stepGroups, duplicate step IDs across stages, `<+input>` runtime expression,
 * template-backed steps (both fixed and `templateInputs`), loop strategy, and YAML anchors.
 */
const COMPLEX_V0_PIPELINE_YAML = `# Production CI/CD Pipeline — owned by Platform Team
pipeline:
  name: Platform Build and Deploy
  identifier: platform_ci_cd
  projectIdentifier: platform
  orgIdentifier: eng
  variables:
    - name: deploy_env
      type: String
      value: <+input>
  stages:
    - stage:
        # Stage 1: Continuous Integration
        name: CI Build
        identifier: CI
        type: CI
        spec:
          cloneCodebase: true
          execution:
            steps:
              - stepGroup:
                  name: Test Suite
                  identifier: Tests
                  steps:
                    - parallel:
                        - step:
                            # Integration test runner — keep inline comment intact!
                            type: Run
                            name: Integration Tests
                            identifier: integration_tests
                            timeout: 10m
                            spec:
                              shell: Bash
                              command: |
                                echo "Running integration tests"
                                npm run test:integration
                        - step:
                            type: Run
                            name: Dynamic Smoke Check
                            identifier: dynamic_smoke
                            timeout: <+input>
                            spec:
                              shell: Bash
                              command: npm run smoke
                    - step:
                        type: Run
                        name: MatrixShards
                        identifier: shard_runner
                        timeout: 15m
                        strategy:
                          matrix:
                            shard: [1, 2, 3]
                        spec:
                          shell: Bash
                          command: echo "shard"
                    - step:
                        name: Shared Security Scan
                        identifier: sec_scan_fixed
                        template:
                          templateRef: org.trivy_locked
                          versionLabel: v2
                    - step:
                        name: Configurable Perf Test
                        identifier: perf_tmpl_step
                        template:
                          templateRef: org.k6_runner
                          versionLabel: v1
                          templateInputs:
                            type: Run
                            spec:
                              timeout: 5m
            rollbackSteps:
              - step:
                  type: Run
                  name: Cleanup CI Artifacts
                  identifier: integration_tests
                  timeout: 5m
                  spec:
                    shell: Bash
                    command: rm -rf /tmp/ci
    - stage:
        name: Staging Verification
        identifier: Staging
        type: Custom
        spec:
          execution:
            steps:
              - step:
                  type: ShellScript
                  name: Staging Integration Tests
                  identifier: integration_tests
                  timeout: 12m
                  spec:
                    shell: Bash
                    source:
                      type: Inline
                      spec:
                        script: echo "staging"
`;

const ALIAS_PIPELINE_YAML = `pipeline:
  name: Anchored Pipeline
  identifier: anchored_pipe
  orgIdentifier: eng
  projectIdentifier: platform
  stages:
    - stage:
        name: Build
        identifier: build
        type: Custom
        spec:
          execution:
            steps:
              - step: &shared_step
                  type: ShellScript
                  name: Step A
                  identifier: step_a
                  timeout: 10m
                  spec:
                    shell: Bash
                    source:
                      type: Inline
                      spec:
                        script: echo a
              - step: *shared_step
`;

const SAMPLE_REGO_POLICY = `package pipeline_governance

import future.keywords.in

# Block steps without explicit timeout
deny[msg] {
  some stage in input.pipeline.stages
  stage.stage.type == "CI"
  msg := "CI stage must enforce image pinning"
}

warn[msg] {
  input.pipeline.allowStageExecutions == true
  msg := "Stage-level execution is enabled"
}
`;

const SAMPLE_HQL_GRAMMAR = `grammar HQL;

// Core query pipeline
query
  : withClause? findClause (PIPE pipeStage)* EOF
  ;

withClause
  : WITH cteDefinition (COMMA cteDefinition)*
  ;

findClause
  : FIND objectKind? IDENTIFIER (AS IDENTIFIER)?
  ;

pipeStage
  : filterClause
  | selectClause
  | joinClause
  | groupByClause
  | orderByClause
  | limitClause
  ;

joinClause
  : JOIN joinType? IDENTIFIER (AS IDENTIFIER)? ON expression
  ;

joinType
  : INNER | LEFT | RIGHT | FULL
  ;

filterClause
  : FILTER expression
  ;

selectClause
  : SELECT LBRACE selectItem (COMMA selectItem)* RBRACE
  ;

groupByClause
  : GROUP_BY LBRACE expression (COMMA expression)* RBRACE
  ;

orderByClause
  : ORDER_BY expression (ASC | DESC)? (COMMA expression (ASC | DESC)?)*
  ;

havingClause
  : HAVING expression
  ;

limitClause
  : LIMIT INTEGER_LITERAL (OFFSET INTEGER_LITERAL)?
  ;

windowFunction
  : IDENTIFIER LPAREN expression? RPAREN OVER LPAREN PARTITION_BY expression ORDER_BY expression RPAREN
  ;

caseExpression
  : CASE (WHEN expression THEN expression)+ (ELSE expression)? END
  ;

unnestClause
  : UNNEST expression AS IDENTIFIER
  ;

IDENTIFIER : [a-zA-Z_][a-zA-Z0-9_:]* ;
INTEGER_LITERAL : [0-9]+ ;
PIPE : '|' ;
`;

/** Create an in-process MCP tool invoker backed by a real `createHarnessServer` instance. */
function buildDirectInvoker(config: Config): {
  invoker: McpToolInvoker;
} {
  const { server } = createHarnessServer(config);
  // Access registered tool handlers via lightweight InMemory / internal map shim:
  // Better yet, intercept `registerTool` or drive via `@modelcontextprotocol/client` + `InMemoryTransport`!
  return {
    invoker: {
      async callTool(name, args) {
        const { Client } = await import("@modelcontextprotocol/client");
        const { InMemoryTransport } = await import("@modelcontextprotocol/server");
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await server.connect(serverTransport);
        const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
        await mcpClient.connect(clientTransport);
        try {
          const res = await mcpClient.callTool({ name, arguments: args });
          return res as Awaited<ReturnType<McpToolInvoker["callTool"]>>;
        } finally {
          await mcpClient.close();
        }
      },
    },
  };
}

async function createConnectedMcpSession(config: Config) {
  const { Client } = await import("@modelcontextprotocol/client");
  const { InMemoryTransport } = await import("@modelcontextprotocol/server");
  const { server } = createHarnessServer(config);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcpClient = new Client({ name: "code-mode-eval", version: "1.0.0" });
  await mcpClient.connect(clientTransport);

  const invoker: McpToolInvoker = {
    callTool: async (name, args) =>
      (await mcpClient.callTool({ name, arguments: args })) as Awaited<ReturnType<McpToolInvoker["callTool"]>>,
  };

  return {
    invoker,
    callJson: async <T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<{ isError: boolean; data: T; rawText: string }> => {
      const res = await invoker.callTool(name, args);
      const text = (res.content ?? []).map((c) => c.text ?? "").join("");
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Error string or JSON error envelope
      }
      return { isError: Boolean(res.isError), data: parsed as T, rawText: text };
    },
    close: () => mcpClient.close(),
  };
}

describe("Resource-as-Code Option A (harness_get + harness_update) & Code Mode", () => {
  beforeEach(() => {
    clearIdempotencyStoreForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("completes the spec's pipeline timeout edit via scoped select -> dry_run preview -> preview_token apply while preserving YAML comments and keeping full YAML out of context", async () => {
    let storedYaml = COMPLEX_V0_PIPELINE_YAML;
    let putCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET" && url.includes("/pipeline/api/pipelines/platform_ci_cd")) {
          return new Response(
            JSON.stringify({
              status: "SUCCESS",
              data: {
                yamlPipeline: storedYaml,
                storeType: "REMOTE",
                gitDetails: {
                  objectId: "blob_sha_104",
                  commitId: "commit_sha_104",
                  branch: "main",
                  repoName: "platform-pipelines",
                  filePath: ".harness/platform_ci_cd.yaml",
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (method === "PUT" && url.includes("/pipeline/api/pipelines/v2/platform_ci_cd")) {
          putCalls++;
          // Verify Git CAS params were automatically forwarded from GET revision!
          expect(url).toContain("lastObjectId=blob_sha_104");
          expect(url).toContain("lastCommitId=commit_sha_104");
          storedYaml = String(init?.body ?? "");
          return new Response(
            JSON.stringify({
              status: "SUCCESS",
              data: { identifier: "platform_ci_cd", gitDetails: { objectId: "blob_sha_105", commitId: "commit_sha_105" } },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        throw new Error(`Unexpected HTTP call: ${method} ${url}`);
      }),
    );

    const session = await createConnectedMcpSession(makeServerConfig());
    try {
      // 1. Scoped inspection of matching step — NO full YAML enters context!
      const inspectRes = await session.callJson<{
        revision: { revision: string; source_kind: string; git_object_id: string };
        nodes: Array<{ selector: string; node_ref: string; fields: Record<string, { kind: string; value: unknown }> }>;
      }>("harness_get", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        select: "stage:CI/group:Tests/step:integration_tests",
      });

      expect(inspectRes.isError).toBe(false);
      expect(inspectRes.rawText).not.toContain("Staging Verification");
      expect(inspectRes.rawText).not.toContain("npm run smoke");
      expect(inspectRes.data.revision.source_kind).toBe("REMOTE");
      expect(inspectRes.data.nodes).toHaveLength(1);
      expect(inspectRes.data.nodes[0]!.selector).toBe("stage:CI/group:Tests/step:integration_tests");
      expect(inspectRes.data.nodes[0]!.fields.timeout).toEqual({ kind: "literal", value: "10m" });

      // 2. Preview (`dry_run: true`) — validates against bundled v0 pipeline schema, zero writes!
      const previewRes = await session.callJson<{
        status: string;
        preview_token: string;
        changes: Array<{ target: string; field: string; before: unknown; after: unknown; source: string }>;
      }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        dry_run: true,
        patches: [
          {
            op: "set",
            target: { node_ref: inspectRes.data.nodes[0]!.node_ref },
            field: "timeout",
            value: "20m",
          },
        ],
      });

      expect(previewRes.isError, previewRes.rawText).toBe(false);
      expect(putCalls).toBe(0);
      expect(previewRes.data.status).toBe("ready");
      expect(previewRes.data.preview_token).toMatch(/^pv_/);
      expect(previewRes.data.changes).toEqual([
        {
          target: "stage:CI/group:Tests/step:integration_tests",
          field: "timeout",
          op: "set",
          before: { kind: "literal", value: "10m" },
          after: { kind: "literal", value: "20m" },
          source: "authored",
        },
      ]);

      // 3. Apply via `preview_token` + `idempotency_key`
      const applyRes = await session.callJson<{
        status: string;
        replayed?: boolean;
        committed_revision: { git_object_id?: string };
      }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        preview_token: previewRes.data.preview_token,
        params: { idempotency_key: "idem-timeout-20m-1" },
      });

      expect(applyRes.isError).toBe(false);
      expect(applyRes.data.status).toBe("applied");
      expect(putCalls).toBe(1);

      // Verify round-trip YAML preserved comments, rollback `integration_tests` (5m), and Staging `integration_tests` (12m)!
      expect(storedYaml).toContain("# Production CI/CD Pipeline — owned by Platform Team");
      expect(storedYaml).toContain("# Integration test runner — keep inline comment intact!");
      const parsedAfter = YAML.parse(storedYaml);
      const ciGroupSteps = parsedAfter.pipeline.stages[0].stage.spec.execution.steps[0].stepGroup.steps;
      expect(ciGroupSteps[0].parallel[0].step.timeout).toBe("20m");
      expect(parsedAfter.pipeline.stages[0].stage.spec.execution.rollbackSteps[0].step.timeout).toBe("5m");
      expect(parsedAfter.pipeline.stages[1].stage.spec.execution.steps[0].step.timeout).toBe("12m");

      // 4. Retry with same `idempotency_key` + `preview_token` -> returns recorded outcome WITHOUT a second PUT!
      const replayRes = await session.callJson<{ status: string; replayed?: boolean }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        preview_token: previewRes.data.preview_token,
        params: { idempotency_key: "idem-timeout-20m-1" },
      });
      expect(replayRes.isError).toBe(false);
      expect(replayRes.data.replayed).toBe(true);
      expect(putCalls).toBe(1);

      // 5. Reusing `idempotency_key` with a different patch -> IDEMPOTENCY_KEY_CONFLICT!
      const conflictIdem = await session.callJson<{ code: string }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        patches: [{ op: "set", target: "stage:Staging/step:integration_tests", field: "timeout", value: "25m" }],
        params: { idempotency_key: "idem-timeout-20m-1" },
      });
      expect(conflictIdem.isError).toBe(true);
      expect(conflictIdem.data.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
      expect(putCalls).toBe(1);
    } finally {
      await session.close();
    }
  });

  it("enforces TARGET_AMBIGUOUS, DYNAMIC_VALUE_REPLACEMENT_REQUIRED, FIELD_OWNED_BY_TEMPLATE, MATRIX_INSTANCE_UNSUPPORTED, ALIAS_TARGET_UNSAFE, VALIDATION_FAILED, and REVISION_CONFLICT with zero writes", async () => {
    let activeYaml = COMPLEX_V0_PIPELINE_YAML;
    let putCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "PUT") {
          putCalls++;
        }
        return new Response(
          JSON.stringify({ status: "SUCCESS", data: { yamlPipeline: activeYaml, storeType: "INLINE" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const session = await createConnectedMcpSession(makeServerConfig());
    try {
      // 1. Ambiguous step selector (`step:integration_tests` exists in both CI and Staging!)
      const ambig = await session.callJson<{ code: string; diagnostics: Array<{ candidates?: string[] }> }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        dry_run: true,
        patches: [{ op: "set", target: "step:integration_tests", field: "timeout", value: "20m" }],
      });
      expect(ambig.isError).toBe(true);
      expect(ambig.data.code).toBe("TARGET_AMBIGUOUS");
      expect(ambig.data.diagnostics[0]?.candidates).toEqual([
        "stage:CI/group:Tests/step:integration_tests",
        "stage:Staging/step:integration_tests",
      ]);

      // 2. Dynamic `<+input>` value blocked unless `replace_dynamic: true`
      const dynBlocked = await session.callJson<{ code: string }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        dry_run: true,
        patches: [{ op: "set", target: "stage:CI/group:Tests/step:dynamic_smoke", field: "timeout", value: "15m" }],
      });
      expect(dynBlocked.isError).toBe(true);
      expect(dynBlocked.data.code).toBe("DYNAMIC_VALUE_REPLACEMENT_REQUIRED");

      // Succeeds when `replace_dynamic: true` is explicit and shows `runtime_input` in preview `before`
      const dynAllowed = await session.callJson<{
        status: string;
        changes: Array<{ before: { kind: string; expression?: string } }>;
      }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        dry_run: true,
        patches: [
          {
            op: "set",
            target: "stage:CI/group:Tests/step:dynamic_smoke",
            field: "timeout",
            value: "15m",
            replace_dynamic: true,
          },
        ],
      });
      expect(dynAllowed.isError).toBe(false);
      expect(dynAllowed.data.status).toBe("ready");
      expect(dynAllowed.data.changes[0]?.before.kind).toBe("runtime_input");

      // 3. Fixed template field -> FIELD_OWNED_BY_TEMPLATE
      const fixedTmpl = await session.callJson<{ code: string }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        dry_run: true,
        patches: [{ op: "set", target: "stage:CI/group:Tests/step:sec_scan_fixed", field: "timeout", value: "30m" }],
      });
      expect(fixedTmpl.isError).toBe(true);
      expect(fixedTmpl.data.code).toBe("FIELD_OWNED_BY_TEMPLATE");

      // Template-exposed input succeeds when `edit_scope: "template_input"` is specified!
      const editableTmpl = await session.callJson<{
        status: string;
        changes: Array<{ source: string; before: { kind: string; owning_template?: string } }>;
      }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        dry_run: true,
        patches: [
          {
            op: "set",
            target: "stage:CI/group:Tests/step:perf_tmpl_step",
            field: "timeout",
            value: "15m",
            edit_scope: "template_input",
          },
        ],
      });
      expect(editableTmpl.isError).toBe(false);
      expect(editableTmpl.data.changes[0]?.source).toBe("template_input");
      expect(editableTmpl.data.changes[0]?.before.owning_template).toBe("org.k6_runner");

      // 4. Expanded matrix instance rejected -> MATRIX_INSTANCE_UNSUPPORTED
      const matrixErr = await session.callJson<{ code: string }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        dry_run: true,
        patches: [{ op: "set", target: "stage:CI/group:Tests/step:shard_runner_0", field: "timeout", value: "25m" }],
      });
      expect(matrixErr.isError).toBe(true);
      expect(matrixErr.data.code).toBe("MATRIX_INSTANCE_UNSUPPORTED");

      // 5. Invalid duration rejected by synced v0 JSON Schema pattern -> VALIDATION_FAILED
      const badDuration = await session.callJson<{ code: string }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        dry_run: true,
        patches: [{ op: "set", target: "stage:Staging/step:integration_tests", field: "timeout", value: "twenty-minutes" }],
      });
      expect(badDuration.isError).toBe(true);
      expect(badDuration.data.code).toBe("VALIDATION_FAILED");

      // 6. Concurrent edit between preview and apply -> REVISION_CONFLICT
      const validPreview = await session.callJson<{ preview_token: string }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        dry_run: true,
        patches: [{ op: "set", target: "stage:Staging/step:integration_tests", field: "timeout", value: "25m" }],
      });
      activeYaml = COMPLEX_V0_PIPELINE_YAML.replace("timeout: 12m", "timeout: 45m"); // Concurrent external edit!

      const revConflict = await session.callJson<{ code: string }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "platform_ci_cd",
        preview_token: validPreview.data.preview_token,
      });
      expect(revConflict.isError).toBe(true);
      expect(revConflict.data.code).toBe("REVISION_CONFLICT");

      // 7. YAML anchor/alias mutation rejected -> ALIAS_TARGET_UNSAFE
      activeYaml = ALIAS_PIPELINE_YAML;
      const aliasBlocked = await session.callJson<{ code: string }>("harness_update", {
        resource_type: "pipeline",
        resource_id: "anchored_pipe",
        dry_run: true,
        patches: [{ op: "set", target: "stage:build/step:step_a", field: "timeout", value: "30m" }],
      });
      expect(aliasBlocked.isError).toBe(true);
      expect(aliasBlocked.data.code).toBe("ALIAS_TARGET_UNSAFE");

      expect(putCalls).toBe(0);
    } finally {
      await session.close();
    }
  });

  it("works across Policy-as-Code (Rego + policy_set JSON), Service-as-Code (auto-inferred YAML), and Cost Perspective (JSON)", async () => {
    let storedRego = SAMPLE_REGO_POLICY;
    let storedPolicySet = {
      identifier: "prod_guardrails",
      name: "Prod Guardrails",
      action: "onsave",
      type: "pipeline",
      enabled: true,
      policies: [
        { identifier: "require_timeout", severity: "warning" },
        { identifier: "block_latest_tag", severity: "error" },
      ],
    };
    let storedServiceYaml = `# Payment Service Definition\nservice:\n  name: Payment API\n  identifier: payment_api\n  orgIdentifier: eng\n  projectIdentifier: platform\n  serviceDefinition:\n    type: Kubernetes\n    spec:\n      variables:\n        - name: replicas\n          type: String\n          value: "2"\n`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        // OPA Policy (Rego)
        if (url.includes("/pm/api/v1/policies/require_timeout")) {
          if (method === "GET") {
            return new Response(
              JSON.stringify({ identifier: "require_timeout", name: "Require Timeout", rego: storedRego }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (method === "PATCH") {
            const body = JSON.parse(String(init?.body ?? "{}")) as { rego: string; name: string };
            expect(body.name).toBe("Require Timeout");
            storedRego = body.rego;
            return new Response(JSON.stringify({ identifier: "require_timeout", ...body }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
        }
        // OPA Policy Set (JSON)
        if (url.includes("/pm/api/v1/policysets/prod_guardrails")) {
          if (method === "GET") {
            return new Response(JSON.stringify(storedPolicySet), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (method === "PUT" || method === "PATCH") {
            storedPolicySet = JSON.parse(String(init?.body ?? "{}"));
            return new Response(JSON.stringify(storedPolicySet), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
        }
        // NG Service (auto-inferred live_bundled YAML)
        if (url.includes("/ng/api/servicesV2")) {
          if (method === "GET") {
            return new Response(
              JSON.stringify({
                status: "SUCCESS",
                data: {
                  service: {
                    identifier: "payment_api",
                    name: "Payment API",
                    yaml: storedServiceYaml,
                  },
                },
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (method === "PUT") {
            const body = JSON.parse(String(init?.body ?? "{}")) as { yaml: string };
            storedServiceYaml = body.yaml;
            return new Response(JSON.stringify({ status: "SUCCESS", data: { service: body } }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
        }
        throw new Error(`Unexpected call: ${method} ${url}`);
      }),
    );

    const session = await createConnectedMcpSession(makeServerConfig());
    try {
      // A. Rego Policy outline & rule replacement
      const regoOutline = await session.callJson<{ nodes: Array<{ selector: string; fields: { hash: { value: string } } }> }>(
        "harness_get",
        { resource_type: "policy", resource_id: "require_timeout", select: "outline" },
      );
      expect(regoOutline.data.nodes.map((n) => n.selector)).toEqual(["package", "imports", "rule:deny", "rule:warn"]);

      const denyHash = regoOutline.data.nodes.find((n) => n.selector === "rule:deny")!.fields.hash.value;
      const regoApply = await session.callJson<{ status: string }>("harness_update", {
        resource_type: "policy",
        resource_id: "require_timeout",
        patches: [
          {
            op: "replace_block",
            target: "rule:deny",
            expected_hash: denyHash,
            value: `deny[msg] {\n  some stage in input.pipeline.stages\n  msg := "Updated strict CI governance check"\n}`,
          },
        ],
      });
      expect(regoApply.isError).toBe(false);
      expect(regoApply.data.status).toBe("applied");
      expect(storedRego).toContain("Updated strict CI governance check");
      expect(storedRego).toContain("warn[msg]"); // Untouched rule preserved!

      // B. Policy Set JSON keyed item update (`policy:require_timeout` warning -> error)
      const psApply = await session.callJson<{ status: string }>("harness_update", {
        resource_type: "policy_set",
        resource_id: "prod_guardrails",
        patches: [{ op: "set", target: "policy:require_timeout", field: "severity", value: "error" }],
      });
      expect(psApply.isError, psApply.rawText).toBe(false);
      expect(storedPolicySet.policies[0]).toEqual({ identifier: "require_timeout", severity: "error" });
      expect(storedPolicySet.policies[1]).toEqual({ identifier: "block_latest_tag", severity: "error" });

      // C. NG Service YAML (zero-config auto-inferred `codeSpec`!)
      const svcApply = await session.callJson<{ status: string }>("harness_update", {
        resource_type: "service",
        resource_id: "payment_api",
        patches: [
          {
            op: "set",
            target: "serviceDefinition.spec.variables[name=replicas]",
            field: "value",
            value: "4",
          },
        ],
      });
      expect(svcApply.isError).toBe(false);
      expect(storedServiceYaml).toContain("# Payment Service Definition");
      expect(YAML.parse(storedServiceYaml).service.serviceDefinition.spec.variables[0].value).toBe("4");
    } finally {
      await session.close();
    }
  });

  it("supports HQL query authoring via scoped ANTLR4 grammar select + Code Mode programmatic discovery/validation, and quantifies 3-way context savings", async () => {
    // Generate a realistic 60-step pipeline (~18 KB YAML) to measure bounded context size!
    const extraStepsYaml = Array.from({ length: 55 }, (_, idx) => {
      return `                    - step:\n                        type: Run\n                        name: Generated Check ${idx}\n                        identifier: gen_check_${idx}\n                        timeout: 10m\n                        spec:\n                          shell: Bash\n                          command: |\n                            echo "Step ${idx} executing long boilerplate script line 1"\n                            echo "Step ${idx} executing long boilerplate script line 2"`;
    }).join("\n");
    const largePipelineYaml = COMPLEX_V0_PIPELINE_YAML.replace(
      "            rollbackSteps:",
      `${extraStepsYaml}\n            rollbackSteps:`,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/getGrammar")) {
          return new Response(JSON.stringify({ grammar: SAMPLE_HQL_GRAMMAR }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/getQueryableTypes")) {
          const queryable_types = Array.from({ length: 80 }, (_, idx) => ({
            type_reference: { object_kind: "OBJECT_KIND_VIEW" },
            connector_mapping_config: { connector_reference: { identifier: "clickhouse_main" } },
            type: {
              view_type: {
                id: idx === 17 ? "ci:pipeline_execution_summary_ci" : `mod:irrelevant_view_${idx}`,
                name: idx === 17 ? "CI Pipeline Execution Summary" : `Irrelevant View ${idx}`,
                description: idx === 17 ? "CI build durations and status" : "Unrelated telemetry table",
              },
            },
          }));
          return new Response(JSON.stringify({ queryable_types }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/getType")) {
          const fields = [
            { name: "pipeline_id", dataType: "STRING" },
            { name: "status", dataType: "STRING" },
            { name: "duration_ms", dataType: "INT64" },
            ...Array.from({ length: 60 }, (_, idx) => ({ name: `extra_col_${idx}`, dataType: "STRING" })),
          ];
          return new Response(
            JSON.stringify({ type: { view_type: { id: "ci:pipeline_execution_summary_ci", fields } } }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/validateQuery")) {
          const req = JSON.parse(String(init?.body ?? "{}")) as { query_string: string };
          const valid = req.query_string.includes("ci:pipeline_execution_summary_ci") && req.query_string.includes("duration_ms");
          return new Response(JSON.stringify({ is_valid: valid, errors: valid ? [] : ["Unknown column"] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/pipeline/api/pipelines/large_pipe")) {
          return new Response(
            JSON.stringify({ status: "SUCCESS", data: { yamlPipeline: largePipelineYaml, storeType: "INLINE" } }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/pipeline/api/pipelines/v2/large_pipe") && init?.method === "PUT") {
          return new Response(JSON.stringify({ status: "SUCCESS", data: { identifier: "large_pipe" } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const session = await createConnectedMcpSession(makeServerConfig());
    try {
      // 1. Scoped HQL grammar rule inspection (`select: "rule:joinClause"` fetches joinClause + 1-hop joinType)
      const fullGrammar = await session.callJson("harness_get", { resource_type: "kg_grammar" });
      const scopedGrammar = await session.callJson<{ nodes: Array<{ selector: string }> }>("harness_get", {
        resource_type: "kg_grammar",
        select: "rule:joinClause",
      });
      expect(scopedGrammar.isError).toBe(false);
      expect(scopedGrammar.data.nodes.map((n) => n.selector)).toEqual(["rule:joinClause", "rule:joinType"]);
      expect(scopedGrammar.rawText.length).toBeLessThan(fullGrammar.rawText.length);

      // 2. Code Mode HQL Authoring Loop: filters 80 types + 63 columns + validates query inside sandbox,
      //    emitting <250B into LLM context while consuming >12KB of schema/catalog data in sandbox!
      const hqlCodeMode = await executeInCodeMode<{ query: string; valid: boolean }>(
        session.invoker,
        `
          const catalog = await harness.list({ resource_type: "kg_queryable_type_summary" });
          const ciView = catalog.items.find((t) => t.identifier.includes("pipeline_execution_summary_ci"));
          const typeMeta = await harness.get({
            resource_type: "kg_type",
            resource_id: ciView.identifier,
            params: { kind: ciView.kind },
            select: "field:duration_ms,field:status"
          });
          const cols = typeMeta.nodes.map((n) => n.id);
          const query = \`find view "\${ciView.identifier}" | filter \${cols[1]} == "Failed" | select {\${cols[0]}}\`;
          const check = await harness.execute({
            resource_type: "hql_query",
            action: "validate",
            body: { query_string: query }
          });
          return { query, valid: Boolean(check.is_valid ?? check.valid ?? true), matchedColumns: cols };
        `,
      );
      expect(hqlCodeMode.ok, hqlCodeMode.error).toBe(true);
      expect(hqlCodeMode.result?.valid).toBe(true);
      expect(hqlCodeMode.metrics.modelVisibleBytes).toBeLessThan(260);
      expect(hqlCodeMode.metrics.sandboxConsumedBytes).toBeGreaterThan(hqlCodeMode.metrics.modelVisibleBytes * 10);

      // 3. Three-way Pipeline Edit Context Comparison on the 60-step (~18 KB) pipeline:
      //    (a) Full-YAML baseline (`harness_get` full + `harness_update` full YAML)
      const baselineGet = await session.callJson("harness_get", {
        resource_type: "pipeline",
        resource_id: "large_pipe",
      });
      const baselineContextBytes = Buffer.byteLength(baselineGet.rawText, "utf8") * 2; // GET output + LLM-emitted PUT input

      //    (b) Code Mode prototype over raw `harness_get` + CST patch
      const codeModeEdit = await executeInCodeMode<{ before: unknown; after: unknown }>(
        session.invoker,
        `
          const raw = await harness.get({ resource_type: "pipeline", resource_id: "large_pipe" });
          const doc = YAML.parseDocument(raw.yamlPipeline);
          const preview = await harness.update({
            resource_type: "pipeline",
            resource_id: "large_pipe",
            dry_run: true,
            patches: [{ op: "set", target: "stage:CI/group:Tests/step:integration_tests", field: "timeout", value: "20m" }]
          });
          return { status: preview.status, changes: preview.changes, docLoadedInSandboxBytes: raw.yamlPipeline.length };
        `,
      );
      expect(codeModeEdit.ok).toBe(true);

      //    (c) Option A Server-Side Scoped Inspect + Preview (`select` + `dry_run` patches)
      const serverInspect = await session.callJson("harness_get", {
        resource_type: "pipeline",
        resource_id: "large_pipe",
        select: "stage:CI/group:Tests/step:integration_tests",
      });
      const serverPreview = await session.callJson("harness_update", {
        resource_type: "pipeline",
        resource_id: "large_pipe",
        dry_run: true,
        patches: [{ op: "set", target: "stage:CI/group:Tests/step:integration_tests", field: "timeout", value: "20m" }],
      });
      const serverScopedBytes =
        Buffer.byteLength(serverInspect.rawText, "utf8") + Buffer.byteLength(serverPreview.rawText, "utf8");

      // Both Code Mode and Server-Side Option A keep model-visible context >90% smaller than Full-YAML baseline!
      expect(baselineContextBytes).toBeGreaterThan(30_000);
      expect(codeModeEdit.metrics.modelVisibleBytes).toBeLessThan(1_000);
      expect(serverScopedBytes).toBeLessThan(2_500);
    } finally {
      await session.close();
    }
  });
});
