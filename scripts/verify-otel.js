#!/usr/bin/env node

/**
 * Verification script for the OTel audit sink.
 *
 * Usage:
 *   # 1. Install OTel packages (if not already)
 *   pnpm add -D @opentelemetry/api @opentelemetry/sdk-trace-node \
 *     @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources
 *
 *   # 2. Port-forward to Jaeger OTLP HTTP (if using in-cluster Jaeger)
 *   kubectl port-forward svc/jaeger-otlp-http 4318:4318 -n event-store-team &
 *
 *   # 3. Run the script
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node scripts/verify-otel.js
 *
 *   # 4. Open Jaeger UI and search for service "harness-mcp-server"
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, "..", "build");

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
if (!endpoint) {
  console.error("ERROR: OTEL_EXPORTER_OTLP_ENDPOINT is not set.");
  console.error("");
  console.error("Usage:");
  console.error("  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node scripts/verify-otel.js");
  console.error("");
  console.error("If your Jaeger is in-cluster, port-forward first:");
  console.error("  kubectl port-forward svc/jaeger-otlp-http 4318:4318 -n <namespace>");
  process.exit(1);
}

if (!existsSync(join(buildDir, "audit", "sinks", "otel.js"))) {
  console.error("ERROR: Build artifacts not found. Run `pnpm build` first.");
  console.error("");
  console.error("  pnpm build && node scripts/verify-otel.js");
  process.exit(1);
}

console.error(`[verify-otel] OTLP endpoint: ${endpoint}`);
console.error("[verify-otel] Importing OTel sink...");

const { OTelSink } = await import("../build/audit/sinks/otel.js");

const sink = new OTelSink();

// Wait for async initialization to complete
await sink.flush();
console.error("[verify-otel] OTel sink initialized");

const sampleEvents = [
  {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tool: "harness_list",
    operation: "list",
    resource_type: "pipeline",
    account_id: "verify-test-account",
    risk: "read",
    outcome: "success",
    duration_ms: 120,
    http_method: "POST",
    http_path: "/pipeline/api/pipelines/execution/summary",
    org_id: "default",
    project_id: "test-project",
  },
  {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tool: "harness_get",
    operation: "get",
    resource_type: "service",
    resource_id: "my-backend-svc",
    account_id: "verify-test-account",
    risk: "read",
    outcome: "success",
    duration_ms: 85,
    http_method: "GET",
    http_path: "/ng/api/servicesV2/my-backend-svc",
    org_id: "default",
    project_id: "test-project",
  },
  {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tool: "harness_create",
    operation: "create",
    resource_type: "pipeline",
    account_id: "verify-test-account",
    risk: "medium_write",
    confirmation: "elicited",
    outcome: "success",
    duration_ms: 340,
    http_method: "POST",
    http_path: "/pipeline/api/pipelines/v2",
    http_status: 200,
    org_id: "default",
    project_id: "test-project",
  },
  {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tool: "harness_execute",
    operation: "execute",
    resource_type: "pipeline",
    resource_id: "deploy-prod",
    action: "run",
    account_id: "verify-test-account",
    risk: "high_write",
    confirmation: "elicited",
    outcome: "error",
    error: "Pipeline input validation failed: missing required input 'tag'",
    duration_ms: 1200,
    http_method: "POST",
    http_path: "/pipeline/api/pipeline/execute/deploy-prod",
    http_status: 400,
    org_id: "default",
    project_id: "test-project",
  },
  {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    tool: "harness_delete",
    operation: "delete",
    resource_type: "connector",
    resource_id: "old-docker-hub",
    account_id: "verify-test-account",
    risk: "destructive",
    confirmation: "elicited",
    outcome: "success",
    duration_ms: 210,
    http_method: "DELETE",
    http_path: "/ng/api/connectors/old-docker-hub",
    http_status: 200,
    org_id: "default",
    project_id: "test-project",
  },
];

console.error(`[verify-otel] Emitting ${sampleEvents.length} sample audit events...`);

for (const event of sampleEvents) {
  sink.emit(event);
  console.error(`  -> ${event.tool} ${event.operation} ${event.resource_type} [${event.outcome}]`);
}

console.error("[verify-otel] Flushing spans...");
await sink.flush();

// Give the batch processor a moment to export
await new Promise((r) => setTimeout(r, 3000));
await sink.flush();

console.error("[verify-otel] Shutting down...");
await sink.close();

console.error("");
console.error("=== Verification Complete ===");
console.error(`Sent ${sampleEvents.length} audit spans to ${endpoint}`);
console.error("");
console.error("Next steps:");
console.error("  1. Open your Jaeger UI");
console.error('  2. Search for service: "harness-mcp-server"');
console.error("  3. You should see spans named like:");
console.error("       audit.list.pipeline");
console.error("       audit.get.service");
console.error("       audit.create.pipeline");
console.error("       audit.execute.pipeline (with error status)");
console.error("       audit.delete.connector");
console.error("  4. Click a span to see all audit attributes");
