import type { ToolsetDefinition } from "../types.js";
import {
  vibeProjectExtract,
  vibePrepareExtract,
  vibeExecutionExtract,
  vibeLifecycleExtract,
  vibeLifecycleEventsExtract,
} from "../extractors.js";
import { isRecord } from "../../utils/type-guards.js";

function objectBody(input: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(input.body)) throw new Error("body must be a JSON object. Use harness_describe for the Vibe request fields.");
  return input.body;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string.`);
  return value;
}

function importBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = objectBody(input);
  requiredString(body.mode, "body.mode");
  // The OpenAPI deliberately leaves mode-specific fields open for backend validation.
  return { ...body };
}

function prepareBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = objectBody(input);
  const name = requiredString(body.name, "body.name");
  if (!isRecord(body.file)) throw new Error("body.file must be an object with a path.");
  const file: Record<string, unknown> = { path: requiredString(body.file.path, "body.file.path") };
  if (body.file.size_bytes !== undefined) {
    const size = body.file.size_bytes;
    if (size !== null && (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0)) {
      throw new Error("body.file.size_bytes must be a non-negative integer or null.");
    }
    file.size_bytes = size;
  }
  for (const field of ["content_type", "md5"] as const) {
    const value = body.file[field];
    if (value !== undefined) {
      if (value !== null && typeof value !== "string") throw new Error(`body.file.${field} must be a string or null.`);
      file[field] = value;
    }
  }
  return { name, file };
}

function deployBody(input: Record<string, unknown>): Record<string, unknown> {
  if (input.body !== undefined && !isRecord(input.body)) throw new Error("body must be a JSON object.");
  const body = isRecord(input.body) ? input.body : {};
  if (body.projectId !== undefined) throw new Error("Use body.project_id (snake_case) for deployment, or pass the Vibe app id as resource_id.");
  const bodyId = body.project_id;
  const targetId = input.app_id;
  if (bodyId !== undefined) requiredString(bodyId, "body.project_id");
  if (targetId !== undefined) requiredString(targetId, "app_id");
  if (bodyId !== undefined && targetId !== undefined && bodyId !== targetId) {
    throw new Error("body.project_id conflicts with the Vibe app id supplied via resource_id/app_id.");
  }
  // Top-level project_id is Harness scope, never the Vibe deployment target.
  return { project_id: requiredString(bodyId ?? targetId, "Vibe app id (resource_id, params.app_id, or body.project_id)") };
}

export const vibeToolset: ToolsetDefinition = {
  name: "vibe",
  displayName: "Vibe",
  description: "Vibe app import, signed upload preparation, deployment, and lifecycle progress under /vibe/v1.",
  resources: [
    {
      resourceType: "vibe_project",
      displayName: "Vibe Project",
      description: "Create a Vibe Source + App from a registered JSON import mode, or prepare a direct upload. Import and prepare do not deploy; call the deploy action separately. These app IDs are not Harness project identifiers.",
      toolset: "vibe",
      scope: "account",
      headerBasedScoping: true,
      identifierFields: ["app_id"],
      searchAliases: ["vibe app", "vibe import", "zip upload", "github import", "vibe deploy"],
      relatedResources: [{ resourceType: "vibe_app_lifecycle", relationship: "deployment progress", description: "Read lifecycle progress using the app id returned by import (id) or prepare (projectId)." }],
      executeHint: "JSON import: harness_create with mode and its backend-specific fields, then deploy using the returned id. ZIP upload: prepare, upload file bytes to the returned uploadUrl using its method and headers, then deploy using projectId. For a source directory, the coding agent first archives the intended local workspace files into a ZIP (including intended uncommitted edits, excluding credentials, .git, dependencies, and generated artifacts), then uses the ZIP flow. A directory path is not transferable source content, and the hosted MCP server cannot read the caller's filesystem. Preserve signed URLs exactly; upload is an external storage request without Harness authorization headers. Deploy is a separate write operation.",
      diagnosticHint: "Use the Vibe app id, not a Harness project identifier. A 409 means no source is ready; a 422 may mean the prepared upload session is missing. Complete the signed upload before deploy. The supplied contract has no project list/get/update/delete endpoints; use vibe_app_lifecycle for status.",
      operations: {
        create: {
          method: "POST",
          path: "/vibe/v1/projects/import",
          bodyBuilder: importBody,
          responseExtractor: vibeProjectExtract,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          description: "Import from a registered JSON mode, creating a Source + App without deploying it.",
          bodySchema: {
            description: "JSON import envelope. Additional mode-specific fields are passed through and validated by the backend; this OpenAPI does not define their shapes. ZIP uploads use prepare instead.",
            fields: [{ name: "mode", type: "string", required: true, description: "Registered non-empty import mode, for example github_link or github_connector. Provide the extra fields required by that mode alongside mode." }],
          },
        },
      },
      executeActions: {
        prepare: {
          method: "POST",
          path: "/vibe/v1/projects/prepare",
          bodyBuilder: prepareBody,
          responseExtractor: vibePrepareExtract,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          actionDescription: "Create a Source + App and obtain signed file upload targets. Returns projectId, sourceId, and upload metadata; does not upload bytes or deploy.",
          bodySchema: {
            description: "Project name and metadata for the file to upload. After prepare, upload directly to object storage, then deploy separately.",
            fields: [
              { name: "name", type: "string", required: true, description: "Vibe app name." },
              { name: "file", type: "object", required: true, description: "Upload file metadata (snake_case).", fields: [
                { name: "path", type: "string", required: true, description: "File path/name for the upload, such as app.zip." },
                { name: "size_bytes", type: "number", required: false, description: "Non-negative integer file size in bytes, or null. Zero is preserved." },
                { name: "content_type", type: "string", required: false, description: "File MIME type, or null." },
                { name: "md5", type: "string", required: false, description: "File checksum when available, or null." },
              ] },
            ],
          },
        },
        deploy: {
          method: "POST",
          path: "/vibe/v1/projects/deploy",
          bodyBuilder: deployBody,
          responseExtractor: vibeExecutionExtract,
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          actionDescription: "Trigger the ship flow for the app's latest source. Publishes a receiving source inline first. This starts deployment and must be requested separately after import or upload.",
          paramsSchema: { fields: [{ name: "app_id", required: false, description: "Vibe app id, alternatively supplied as resource_id or body.project_id. Never use the top-level Harness project_id scope field for this id." }] },
          bodySchema: {
            description: "Deployment target. resource_id/params.app_id may supply the same id when body is omitted. The wire field is project_id, even though prepare returns projectId.",
            fields: [{ name: "project_id", type: "string", required: true, description: "Vibe app id from import.id or prepare.projectId, alternatively resolved from resource_id/params.app_id." }],
          },
        },
      },
    },
    {
      resourceType: "vibe_app_lifecycle",
      displayName: "Vibe App Lifecycle",
      description: "Current Vibe app, latest deployment execution, stages, substeps, preview/production URLs, and failure details. Uses the Vibe app UUID, not a Harness project id.",
      toolset: "vibe",
      scope: "account",
      headerBasedScoping: true,
      identifierFields: ["app_id"],
      searchAliases: ["vibe progress", "vibe preview", "vibe logs", "vibe lifecycle events"],
      relatedResources: [{ resourceType: "vibe_project", relationship: "app", description: "Import/prepare an app and explicitly deploy it before monitoring lifecycle progress." }],
      diagnosticHint: "A 404 means the app UUID does not resolve for this connection. Poll get for authoritative current progress; event batches are transient diffs, with no replay cursor documented by this API.",
      operations: {
        get: {
          method: "GET",
          path: "/vibe/v1/apps/{app_id}/lifecycle",
          pathParams: { app_id: "app_id" },
          responseExtractor: vibeLifecycleExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Read the latest lifecycle snapshot including stages, failures, and preview readiness.",
        },
      },
      executeActions: {
        events: {
          method: "GET",
          path: "/vibe/v1/apps/{app_id}/lifecycle/events",
          pathParams: { app_id: "app_id" },
          headers: { Accept: "text/event-stream" },
          responseType: "sse",
          responseExtractor: vibeLifecycleEventsExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          actionDescription: "Read a bounded SSE batch: up to 20 JSON events over 5 seconds after connection, capped at 1 MiB. Returns events and stop_reason; no automatic reconnect or replay. Use get for a complete snapshot.",
        },
      },
    },
  ],
};
