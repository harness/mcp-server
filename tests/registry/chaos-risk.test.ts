/**
 * Verifies scanned_risk, chaos_risk_rule, and chaos_risk_scan resource types:
 * request shape, scope params, query-param mapping, response extraction,
 * body builders (create/update for risk_scan), and execute actions.
 *
 * All three resources use the v3 chaos-manager API under /chaos/manager/api/v3/
 * with organizationIdentifier (not orgIdentifier) scope params and
 * identity-based path parameters.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

// ─── scanned_risk ──────────────────────────────────────────────────────────────

describe("scanned_risk list/get", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: builds correct path and chaos scope params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [
        { identity: "sr-1", name: "Missing resource limits", severity: "HIGH" },
      ],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "scanned_risk", "list", {
      org_id: "default",
      project_id: "chaos-proj",
    })) as { items: unknown[]; total: number };

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/scanned-risks");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "chaos-proj",
      page: "0",
      limit: "15",
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("list: maps all filter fields to correct query param names", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "scanned_risk", "list", {
      org_id: "org1",
      project_id: "proj1",
      search: "limits",
      sort_field: "severity",
      sort_ascending: true,
      severity: "HIGH",
      risk_rule_id: "rule-abc",
      validation_type: "Confirmed",
      service_identity: "svc-1",
      environment_identity: "env-1",
      agent_identity: "agent-1",
      start_time: 1700000000,
      end_time: 1700100000,
      include_all_scope: true,
      tags: "team:platform",
    });

    const params = mockRequest.mock.calls[0][0].params;
    expect(params.search).toBe("limits");
    expect(params.sortField).toBe("severity");
    expect(params.sortAscending).toBe(true);
    expect(params.severity).toBe("HIGH");
    expect(params.riskRuleId).toBe("rule-abc");
    expect(params.validationType).toBe("Confirmed");
    expect(params.serviceIdentity).toBe("svc-1");
    expect(params.environmentIdentity).toBe("env-1");
    expect(params.agentIdentity).toBe("agent-1");
    expect(params.startTime).toBe(1700000000);
    expect(params.endTime).toBe(1700100000);
    expect(params.includeAllScope).toBe(true);
    expect(params.tags).toBe("team:platform");
  });

  it("get: builds correct path with identity param and unwraps scannedRisk envelope", async () => {
    // Backend returns { scannedRisk: ScannedRisk } — extractor must unwrap so
    // callers see the entity at the root like every other *.get op.
    const mockRequest = vi.fn().mockResolvedValue({
      scannedRisk: {
        identity: "sr-1",
        name: "Missing resource limits",
        severity: "HIGH",
        riskRuleId: "rule-abc",
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "scanned_risk", "get", {
      identity: "sr-1",
      org_id: "default",
      project_id: "chaos-proj",
    })) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/scanned-risks/sr-1");
    expect(result.identity).toBe("sr-1");
    expect(result.severity).toBe("HIGH");
    expect(result.riskRuleId).toBe("rule-abc");
    expect(result.scannedRisk).toBeUndefined();
  });

  it("get: leaves already-unwrapped responses untouched (defensive)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      identity: "sr-2",
      severity: "MEDIUM",
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "scanned_risk", "get", {
      identity: "sr-2",
      org_id: "default",
      project_id: "chaos-proj",
    })) as Record<string, unknown>;

    expect(result.identity).toBe("sr-2");
    expect(result.severity).toBe("MEDIUM");
  });
});

describe("scanned_risk execute actions", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("occurrences: GETs occurrences sub-resource with query params and extracts paginated response", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [{ scanId: "scan-1", timestamp: 1700000000 }],
      pagination: { totalItems: 3 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatchExecute(client, "scanned_risk", "occurrences", {
      identity: "sr-1",
      org_id: "default",
      project_id: "chaos-proj",
      page: 0,
      limit: 10,
      scan_type: "PipelineExecution",
      start_time: 1700000000,
      end_time: 1700100000,
    })) as { items: unknown[]; total: number };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/scanned-risks/sr-1/occurrences");
    expect(call.params.scanType).toBe("PipelineExecution");
    expect(call.params.startTime).toBe(1700000000);
    expect(call.params.endTime).toBe(1700100000);
    // chaosPageExtract unwraps { data, pagination } into { items, total }
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(3);
    expect((result.items[0] as Record<string, unknown>).scanId).toBe("scan-1");
  });

  it("summary_by_service: POSTs to summary endpoint with query params and extracts paginated response", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [{ serviceIdentity: "svc-1", totalRisks: 5 }],
      pagination: { totalItems: 2 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatchExecute(client, "scanned_risk", "summary_by_service", {
      org_id: "default",
      project_id: "chaos-proj",
      service_type: "Kubernetes",
      environment_identity: "env-1",
      start_time: 1700000000,
      end_time: 1700100000,
    })) as { items: unknown[]; total: number };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/v3/scanned-risks/summary");
    expect(call.params.serviceType).toBe("Kubernetes");
    expect(call.params.environmentIdentity).toBe("env-1");
    // bodyBuilder returns {}, but the registry injects scope params into POST bodies
    expect(call.body).toMatchObject({});
    // chaosPageExtract unwraps { data, pagination } into { items, total }
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(2);
    expect((result.items[0] as Record<string, unknown>).serviceIdentity).toBe("svc-1");
  });
});

// ─── chaos_risk_rule ───────────────────────────────────────────────────────────

describe("chaos_risk_rule list/get", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: builds correct path and chaos scope params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [
        { identity: "rule-1", name: "No CPU limits", isSystem: true },
      ],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_risk_rule", "list", {
      org_id: "default",
      project_id: "chaos-proj",
    })) as { items: unknown[]; total: number };

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-rules");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "chaos-proj",
      page: "0",
      limit: "15",
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("list: maps all filter fields to correct query param names", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_risk_rule", "list", {
      org_id: "org1",
      project_id: "proj1",
      search: "cpu",
      sort_field: "name",
      sort_ascending: false,
      tags: "category:resource",
      is_system: true,
      data_source: "manifest",
      include_all_scope: false,
    });

    const params = mockRequest.mock.calls[0][0].params;
    expect(params.search).toBe("cpu");
    expect(params.sortField).toBe("name");
    expect(params.sortAscending).toBe(false);
    expect(params.tags).toBe("category:resource");
    expect(params.isSystem).toBe(true);
    expect(params.dataSource).toBe("manifest");
    expect(params.includeAllScope).toBe(false);
  });

  it("get: builds correct path with identity param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      identity: "rule-1",
      name: "No CPU limits",
      severity: "MEDIUM",
      isSystem: true,
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_risk_rule", "get", {
      identity: "rule-1",
      org_id: "default",
      project_id: "chaos-proj",
    })) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-rules/rule-1");
    expect(result.identity).toBe("rule-1");
    expect(result.isSystem).toBe(true);
  });
});

// ─── chaos_risk_scan ───────────────────────────────────────────────────────────

describe("chaos_risk_scan list/get", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: builds correct path and chaos scope params with defaults", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [
        { identity: "scan-1", name: "nightly-scan", status: "COMPLETED", scanType: "PipelineExecution" },
      ],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_risk_scan", "list", {
      org_id: "default",
      project_id: "chaos-proj",
    })) as { items: unknown[]; total: number };

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "chaos-proj",
      page: "0",
      limit: "15",
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("list: maps all filter fields to correct query param names", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_risk_scan", "list", {
      org_id: "org1",
      project_id: "proj1",
      search: "nightly",
      sort_field: "createdAt",
      sort_ascending: true,
      tags: "env:prod",
      scan_type: "PipelineExecution",
      status: "COMPLETED",
      pipeline_identity: "deploy-pipeline",
      agent_identity: "agent-1",
      environment_identity: "env-prod",
      start_time: 1700000000,
      end_time: 1700100000,
    });

    const params = mockRequest.mock.calls[0][0].params;
    expect(params.search).toBe("nightly");
    expect(params.sortField).toBe("createdAt");
    expect(params.sortAscending).toBe(true);
    expect(params.tags).toBe("env:prod");
    expect(params.scanType).toBe("PipelineExecution");
    expect(params.status).toBe("COMPLETED");
    expect(params.pipelineIdentity).toBe("deploy-pipeline");
    expect(params.agentIdentity).toBe("agent-1");
    expect(params.environmentIdentity).toBe("env-prod");
    expect(params.startTime).toBe(1700000000);
    expect(params.endTime).toBe(1700100000);
  });

  it("get: builds correct path with identity param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      identity: "scan-1",
      name: "nightly-scan",
      status: "COMPLETED",
      scanType: "PipelineExecution",
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_risk_scan", "get", {
      identity: "scan-1",
      org_id: "default",
      project_id: "chaos-proj",
    })) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans/scan-1");
    expect(result.identity).toBe("scan-1");
    expect(result.status).toBe("COMPLETED");
  });
});

describe("chaos_risk_scan create", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create: POSTs to /v3/risk-scans with correct body shape", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "new-scan", name: "New Scan" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_risk_scan", "create", {
      org_id: "default",
      project_id: "chaos-proj",
      body: {
        identity: "new-scan",
        name: "New Scan",
        description: "Weekly risk scan",
        tags: ["env:prod", "team:platform"],
        scanType: "DiscoveryAgent",
        source: { agentIdentity: "agent-1" },
      },
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "chaos-proj",
    });
    expect(call.body).toMatchObject({
      identity: "new-scan",
      name: "New Scan",
      description: "Weekly risk scan",
      tags: ["env:prod", "team:platform"],
      scanType: "DiscoveryAgent",
      source: { agentIdentity: "agent-1" },
    });
  });

  it("create: accepts scan_type snake_case alias", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "scan-2" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_risk_scan", "create", {
      org_id: "org1",
      project_id: "proj1",
      body: {
        identity: "scan-2",
        name: "Scan 2",
        scan_type: "PipelineExecution",
        source: { pipeline: { pipelineIdentity: "deploy" } },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.scanType).toBe("PipelineExecution");
  });

  it("create: omits optional fields when not provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "scan-3" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_risk_scan", "create", {
      org_id: "org1",
      project_id: "proj1",
      body: {
        identity: "scan-3",
        name: "Scan 3",
        scanType: "DiscoveryAgent",
        source: { discoveryAgent: { agentIdentity: "agent-1" } },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.identity).toBe("scan-3");
    expect(call.body.name).toBe("Scan 3");
    expect(call.body.description).toBeUndefined();
    expect(call.body.tags).toBeUndefined();
  });

  it("create: throws locally when required fields are missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "chaos_risk_scan", "create", {
        org_id: "org1",
        project_id: "proj1",
        body: { name: "incomplete" },
      }),
    ).rejects.toThrow(/Missing required field\(s\).*identity.*scanType.*source/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: throws when identity is missing", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "chaos_risk_scan", "create", {
        org_id: "org1",
        project_id: "proj1",
        body: {
          name: "scan",
          scanType: "DiscoveryAgent",
          source: { discoveryAgent: { agentIdentity: "a" } },
        },
      }),
    ).rejects.toThrow(/Missing required field\(s\).*identity/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: preserves explicit empty description and empty tags array (not dropped by truthiness)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "scan-empty" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_risk_scan", "create", {
      org_id: "org1",
      project_id: "proj1",
      body: {
        identity: "scan-empty",
        name: "Scan Empty",
        description: "",
        tags: [],
        scanType: "DiscoveryAgent",
        source: { discoveryAgent: { agentIdentity: "a" } },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.description).toBe("");
    expect(call.body.tags).toEqual([]);
  });
});

describe("chaos_risk_scan update", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("update: PUTs to /v3/risk-scans/{identity} with partial body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "scan-1", name: "Updated Scan" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_risk_scan", "update", {
      identity: "scan-1",
      org_id: "default",
      project_id: "chaos-proj",
      body: {
        name: "Updated Scan",
        description: "Updated description",
        tags: ["updated"],
      },
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans/scan-1");
    expect(call.body).toMatchObject({
      name: "Updated Scan",
      description: "Updated description",
      tags: ["updated"],
    });
  });

  it("update: omits fields not provided in body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "scan-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_risk_scan", "update", {
      identity: "scan-1",
      org_id: "org1",
      project_id: "proj1",
      body: { name: "Only Name" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.name).toBe("Only Name");
    expect(call.body.description).toBeUndefined();
    expect(call.body.tags).toBeUndefined();
  });
});

describe("chaos_risk_scan delete", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("delete: DELETEs /v3/risk-scans/{identity}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_risk_scan", "delete", {
      identity: "scan-1",
      org_id: "default",
      project_id: "chaos-proj",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans/scan-1");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "chaos-proj",
    });
  });
});

describe("chaos_risk_scan execute actions", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("retry: POSTs to /v3/risk-scans/{identity}/retry with empty body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "scan-1", status: "PENDING" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_risk_scan", "retry", {
      identity: "scan-1",
      org_id: "default",
      project_id: "chaos-proj",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans/scan-1/retry");
    // bodyBuilder returns {}, but the registry injects scope params into POST bodies
    expect(call.body).toMatchObject({});
  });

  it("abort: POSTs to /v3/risk-scans/{identity}/abort with empty body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "scan-1", status: "ABORTED" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_risk_scan", "abort", {
      identity: "scan-1",
      org_id: "default",
      project_id: "chaos-proj",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans/scan-1/abort");
    // bodyBuilder returns {}, but the registry injects scope params into POST bodies
    expect(call.body).toMatchObject({});
  });

  it("report: GETs /v3/risk-scans/{identity}/report", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ findings: [], totalFindings: 0 });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_risk_scan", "report", {
      identity: "scan-1",
      org_id: "default",
      project_id: "chaos-proj",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans/scan-1/report");
  });

  it("report_download: GETs /v3/risk-scans/{identity}/report/download", async () => {
    const mockRequest = vi.fn().mockResolvedValue("csv-content");
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_risk_scan", "report_download", {
      identity: "scan-1",
      org_id: "default",
      project_id: "chaos-proj",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans/scan-1/report/download");
  });

  it("heatmap: GETs /v3/risk-scans/{identity}/heatmap with pagination and extracts heatmap rows", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      summary: { score: 333, totalRisks: 15 },
      riskRules: [{ identity: "r1", name: "Missing probes" }],
      rows: [{ serviceIdentity: "svc-1", serviceName: "nginx-deployment", cells: [] }],
      pagination: { totalItems: 5 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatchExecute(client, "chaos_risk_scan", "heatmap", {
      identity: "scan-1",
      org_id: "default",
      project_id: "chaos-proj",
      page: 0,
      limit: 20,
      search: "svc",
    })) as {
      summary?: unknown;
      riskRules?: unknown[];
      items: unknown[];
      total: number;
    };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/risk-scans/scan-1/heatmap");
    expect(call.params.page).toBe(0);
    expect(call.params.limit).toBe(20);
    expect(call.params.search).toBe("svc");
    // chaosHeatmapExtract unwraps { rows, riskRules, summary, pagination }
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(5);
    expect(result.riskRules).toHaveLength(1);
    expect(result.summary).toEqual({ score: 333, totalRisks: 15 });
  });
});
