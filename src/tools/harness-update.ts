import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult, structuredErrorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmationArgsHash, confirmViaElicitation, describeElicitationFailure, describeBlockedAudit, isConfirmationPrompt } from "../utils/elicitation.js";
import { resolveConfirmNoteAsync, withConfirmNoteFirst } from "../utils/confirm-note.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString, isRecord, coerceRecord } from "../utils/type-guards.js";
import { formatBodyPreview } from "../utils/body-preview.js";
import { orgIdField, projectIdField, resourceScopeField, resourceTypeSchema } from "./input-schemas.js";
import { fieldCopy } from "./field-copy.js";
import { updateOutputSchema, compactOutputSchema } from "./output-schemas.js";
import { canonicalizeResourceTypes } from "../utils/canonical-resource-type.js";
import {
  checkIdempotencyReceipt,
  CodeEngineError,
  commitPreparedPatch,
  formatPatchDiffForConfirmation,
  parsePatchOperations,
  preparePatchCandidate,
  previewResourcePatch,
  verifyPreviewToken,
} from "../code-engine/index.js";

export function registerUpdateTool(server: McpServer, registry: Registry, client: HarnessClient, config: Config): void {
  const updatableTypes = registry.getTypesForOperation("update");

  server.registerTool(
    "harness_update",
    {
      description: "Update an existing Harness resource. For pipelines/input sets: pass body as a YAML string directly (recommended for complex definitions), or use body.yamlPipeline/body.pipeline. You can pass a Harness URL to auto-extract identifiers. Response includes openInHarness link to the updated resource when applicable.",
      inputSchema: z.object({
              resource_type: resourceTypeSchema(updatableTypes, registry.compactSchemas).describe("The type of resource to update"),
              resource_id: z.string().optional().describe("The identifier of the resource to update. Optional when url contains the resource ID."),
              url: z.string().optional().describe("A Harness UI URL — org, project, resource type, ID, and supported resource_scope are extracted automatically"),
              resource_scope: resourceScopeField(registry.compactSchemas),
              body: z.union([
                z.record(z.string(), z.unknown()),
                z.string(),
              ]).optional().describe(fieldCopy("update.body", registry.schemaProfile)),
              patches: z.array(z.record(z.string(), z.unknown())).max(25).optional().describe(fieldCopy("update.patches", registry.schemaProfile)),
              dry_run: z.boolean().optional().describe(fieldCopy("update.dry_run", registry.schemaProfile)),
              preview_token: z.string().optional().describe(fieldCopy("update.preview_token", registry.schemaProfile)),
              org_id: orgIdField(registry.orgId, registry.compactSchemas),
              project_id: projectIdField(registry.projectId, registry.compactSchemas),
              confirm: z.boolean().optional().describe(fieldCopy("confirm.update", registry.schemaProfile)),
              params: z.record(z.string(), z.unknown()).optional().describe("Additional identifiers (e.g. pipeline_id for triggers/input sets, version_label for templates)."),
            }),
      outputSchema: compactOutputSchema(updateOutputSchema, registry.compactSchemas),
      annotations: {
        title: "Update Harness Resource",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (rawArgs, ctx) => {
      const args = canonicalizeResourceTypes(registry, rawArgs);
      try {
        // Validate resource_type and operation before asking user to confirm
        const def = registry.getResource(args.resource_type);
        if (!def.operations.update) {
          return errorResult(`Resource "${args.resource_type}" does not support "update". Supported: ${Object.keys(def.operations).join(", ")}`);
        }

        const {
          params,
          body,
          patches: rawPatches,
          dry_run: dryRun,
          preview_token: previewToken,
          confirm: _confirm,
          ...rest
        } = args;

        const hasBody = body !== undefined;
        const hasPatches = Array.isArray(rawPatches) && rawPatches.length > 0;
        const hasPreviewToken = typeof previewToken === "string" && previewToken.trim() !== "";
        const modeCount = Number(hasBody) + Number(hasPatches) + Number(hasPreviewToken);
        if (modeCount === 0) {
          return errorResult("Provide one of 'body' (full replacement), 'patches' (scoped Resource-as-Code edit), or 'preview_token' (apply a dry_run preview).");
        }
        if (modeCount > 1) {
          return errorResult("Pass only one of 'body', 'patches', or 'preview_token' in a single harness_update call.");
        }

        const coercedBody = typeof body === "string" ? (coerceRecord(body) ?? body) : body;
        const coercedParams = coerceRecord(params);
        // Merge params in before URL defaults so explicit identifiers (e.g. FME's
        // workspace_id, passed via params) are visible to applyUrlDefaults's
        // legacy-vs-URL-scope precedence check, not just top-level named args.
        const argsForUrlDefaults = { ...rest, ...coercedParams, ...(hasBody ? { body: coercedBody } : {}) };
        const input = applyUrlDefaults(argsForUrlDefaults as Record<string, unknown>, args.url, { includeResourceScope: true });
        if (coercedParams) Object.assign(input, coercedParams);
        const identFields = def.identifierFields;
        const primaryField = identFields.length > 1
          ? identFields[identFields.length - 1]!
          : identFields[0];
        const fromResourceId = asString(input.resource_id);
        const fromPrimaryField = primaryField ? asString(input[primaryField]) : undefined;
        if (fromResourceId && fromPrimaryField && fromResourceId !== fromPrimaryField) {
          return errorResult(
            `Conflicting identifiers: resource_id/url gives "${fromResourceId}" but params.${primaryField} gives "${fromPrimaryField}". Provide one or ensure they match.`,
          );
        }
        const resolvedResourceId = fromResourceId ?? fromPrimaryField;
        if (!resolvedResourceId) {
          return errorResult("resource_id is required for harness_update unless url contains the resource ID or params includes the resource-specific ID field.");
        }
        // Populate the primary identifier on the input map BEFORE any
        // pre-dispatch audit emission so pathBuilder-backed updates resolve
        // a stable http_path on blocked-attempt audit rows.
        if (primaryField) {
          input[primaryField] = resolvedResourceId;
        }

        const expectedRevision = asString(input.expected_revision);
        const idempotencyKey = asString(input.idempotency_key);

        const risk = def.operations.update!.operationPolicy.risk;

        // --- Scoped Resource-as-Code dry_run preview (zero write side effects; allowed in read-only mode as preview_only) ---
        if (hasPatches && dryRun === true) {
          const parsedPatches = parsePatchOperations(rawPatches);
          const preview = await previewResourcePatch({
            registry,
            client,
            def,
            input,
            resourceId: resolvedResourceId,
            operations: parsedPatches,
            expectedRevision,
            readOnlyMode: config.HARNESS_READ_ONLY,
            signingKey: config.HARNESS_MCP_REQUEST_STATE_KEY,
          });
          return jsonResult(preview);
        }

        // Fail fast on HARNESS_READ_ONLY before elicitation — see
        // harness_create.ts for the rationale. Mirrors registry.dispatch().
        if (config.HARNESS_READ_ONLY) {
          const reason = `Read-only mode is enabled (HARNESS_READ_ONLY=true). "update" operations are not allowed.`;
          registry.auditBlockedAttempt(
            args.resource_type,
            "update",
            input,
            { tool: "harness_update", confirmation: "blocked", resource_id: resolvedResourceId },
            reason,
          );
          return errorResult(reason);
        }

        // --- Scoped Resource-as-Code apply (via preview_token OR direct patches) ---
        if (hasPreviewToken || hasPatches) {
          const accountId = registry.getAccountId() || client.account;
          const orgId = asString(input.org_id) ?? registry.orgId;
          const projectId = asString(input.project_id) ?? registry.projectId;
          const resourceScope = asString(input.resource_scope);

          let operationsToApply: ReturnType<typeof parsePatchOperations>;
          let effectiveExpectedRev = expectedRevision;
          let expectedCandidateSha: string | undefined;
          let previewFingerprint: string;

          if (hasPreviewToken) {
            const verified = verifyPreviewToken(
              previewToken!.trim(),
              {
                accountId,
                orgId,
                projectId,
                resourceScope,
                resourceType: def.resourceType,
                resourceId: resolvedResourceId,
              },
              { signingKey: config.HARNESS_MCP_REQUEST_STATE_KEY },
            );
            operationsToApply = verified.operations as ReturnType<typeof parsePatchOperations>;
            effectiveExpectedRev = verified.baseSha256;
            expectedCandidateSha = verified.candidateSha256;
            previewFingerprint = previewToken!.trim();
          } else {
            operationsToApply = parsePatchOperations(rawPatches);
            previewFingerprint = confirmationArgsHash({ patches: operationsToApply, expectedRevision });
          }

          // Check idempotency receipt BEFORE live revision check so retries after a
          // network timeout post-commit replay the recorded outcome instead of failing
          // with REVISION_CONFLICT against the already-committed state.
          if (idempotencyKey) {
            const priorReceipt = checkIdempotencyReceipt({
              accountId,
              orgId,
              projectId,
              resourceType: def.resourceType,
              resourceId: resolvedResourceId,
              idempotencyKey,
              previewFingerprint,
            });
            if (priorReceipt) {
              return jsonResult(priorReceipt);
            }
          }

          const prepared = await preparePatchCandidate({
            registry,
            client,
            def,
            input,
            resourceId: resolvedResourceId,
            operations: operationsToApply,
            expectedRevision: effectiveExpectedRev,
          });

          if (prepared.changes.length === 0) {
            return jsonResult({
              status: "no_change",
              resource_type: def.resourceType,
              resource_id: resolvedResourceId,
              base_revision: prepared.baseRevision,
              changes: [],
              diagnostics: prepared.diagnostics,
            });
          }

          if (expectedCandidateSha && prepared.candidateSha256 !== expectedCandidateSha) {
            throw new CodeEngineError(
              "PREVIEW_MISMATCH",
              "Recomputed candidate digest did not match preview_token. Re-run dry_run: true to create a fresh preview.",
            );
          }

          const diffSummary = formatPatchDiffForConfirmation(prepared.changes);
          const elicitPatch = await confirmViaElicitation({
            server,
            ctx,
            toolName: "harness_update",
            message: withConfirmNoteFirst(
              `Update ${args.resource_type} "${resolvedResourceId}" (${prepared.changes.length} field change${prepared.changes.length === 1 ? "" : "s"})?`,
              diffSummary,
              await resolveConfirmNoteAsync(def.operations.update, prepared.updateInput, {
                client,
                registry,
                accountId: registry.getAccountId(),
              }),
            ),
            risk,
            autoApproveRisk: config.HARNESS_AUTO_APPROVE_RISK,
            callerConfirmed: args.confirm === true,
            argsHash: confirmationArgsHash(rawArgs),
          });
          if (isConfirmationPrompt(elicitPatch)) return elicitPatch.needsInput;
          if (!elicitPatch.proceed) {
            registry.auditBlockedAttempt(
              args.resource_type,
              "update",
              prepared.updateInput,
              { tool: "harness_update", confirmation: elicitPatch.method, resource_id: resolvedResourceId },
              describeBlockedAudit(elicitPatch),
            );
            return errorResult(describeElicitationFailure(elicitPatch));
          }

          const applied = await commitPreparedPatch({
            registry,
            client,
            def,
            resourceId: resolvedResourceId,
            prepared,
            auditContext: {
              tool: "harness_update",
              confirmation: elicitPatch.method,
              resource_id: resolvedResourceId,
            },
            idempotencyKey,
            previewFingerprint,
            scopeContext: { accountId, orgId, projectId },
          });
          return jsonResult(applied);
        }

        const bodyPreview = formatBodyPreview(args.body);
        const elicit = await confirmViaElicitation({
          server,
          ctx,
          toolName: "harness_update",
          message: withConfirmNoteFirst(
            `Update ${args.resource_type} "${resolvedResourceId}"?`,
            bodyPreview,
            await resolveConfirmNoteAsync(def.operations.update, input, { client, registry, accountId: registry.getAccountId() }),
          ),
          risk,
          autoApproveRisk: config.HARNESS_AUTO_APPROVE_RISK,
          callerConfirmed: args.confirm === true,
          argsHash: confirmationArgsHash(rawArgs),
        });
        if (isConfirmationPrompt(elicit)) return elicit.needsInput;
        if (!elicit.proceed) {
          registry.auditBlockedAttempt(
            args.resource_type,
            "update",
            input,
            { tool: "harness_update", confirmation: elicit.method, resource_id: resolvedResourceId },
            describeBlockedAudit(elicit),
          );
          return errorResult(describeElicitationFailure(elicit));
        }
        // Lift version_label from body when callers put it there instead of params.
        // Do not invent a default — template update requires an explicit version_label
        // (see paramsSchema / harness_describe); a silent "v1" default masked omissions.
        const versionLabel = asString(input.version_label);
        if (!versionLabel && isRecord(args.body) && "version_label" in args.body) {
          input.version_label = args.body.version_label;
        }

        const result = await registry.dispatch(client, args.resource_type, "update", input, { tool: "harness_update", confirmation: elicit.method, resource_id: resolvedResourceId });
        return jsonResult(result);
      } catch (err) {
        if (err instanceof CodeEngineError) {
          return structuredErrorResult({ code: err.code, error: err.message, diagnostics: err.diagnostics });
        }
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
