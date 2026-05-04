import type { DiagnoseHandler, DiagnoseContext } from "./types.js";
import { createLogger } from "../../utils/logger.js";
import { sendProgress } from "../../utils/progress.js";
import { isRecord, asRecord, asString, asNumber } from "../../utils/type-guards.js";

const log = createLogger("diagnose:connector");

export const connectorHandler: DiagnoseHandler = {
  entityType: "connector",
  description: "Diagnose a connector — fetches details and runs a connectivity test, returning type, auth method, status, and any connection errors.",

  async diagnose(ctx: DiagnoseContext): Promise<Record<string, unknown>> {
    const { client, registry, config, input, extra, signal } = ctx;

    const connectorId = asString(input.resource_id) ?? asString(input.connector_id);
    if (!connectorId) {
      throw new Error("resource_id (connector identifier) is required. Provide it explicitly or via a Harness URL.");
    }
    input.connector_id = connectorId;

    const diagnostic: Record<string, unknown> = {};

    // 1. Fetch connector details
    await sendProgress(extra, 0, 2, "Fetching connector details...");
    log.info("Fetching connector", { connectorId });

    const raw = await registry.dispatch(client, "connector", "get", input, signal);
    const connectorData = asRecord(raw) ?? {};
    const connector = asRecord(connectorData.connector) ?? connectorData;
    const spec = asRecord(connector.spec);
    const status = asRecord(connectorData.status);

    const connectorInfo: Record<string, unknown> = {
      name: connector.name,
      identifier: connector.identifier,
      type: connector.type,
      description: connector.description || undefined,
      tags: isRecord(connector.tags) && Object.keys(connector.tags).length > 0
        ? connector.tags
        : undefined,
    };

    // Extract auth method from spec (varies by connector type)
    if (spec) {
      const authType = asRecord(spec.authentication)?.type
        ?? asRecord(spec.auth)?.type
        ?? spec.authType
        ?? spec.type;
      if (authType) {
        connectorInfo.auth_type = authType;
      }

      const url = spec.url ?? spec.dockerRegistryUrl ?? spec.gitUrl
        ?? spec.masterUrl ?? spec.awsCrossAccountAttributes;
      if (url) {
        connectorInfo.url = url;
      }
    }
    diagnostic.connector = connectorInfo;

    // Existing status from Harness (last known connectivity state)
    if (status) {
      const lastKnown: Record<string, unknown> = {
        status: status.status,
        last_tested_at: asNumber(status.lastTestedAt)
          ? new Date(status.lastTestedAt as number).toISOString()
          : undefined,
        last_connected_at: asNumber(status.lastConnectedAt)
          ? new Date(status.lastConnectedAt as number).toISOString()
          : undefined,
      };
      if (status.errorSummary) {
        lastKnown.error_summary = status.errorSummary;
      }
      diagnostic.last_known_status = lastKnown;
    }

    // 2. Run connectivity test
    await sendProgress(extra, 1, 2, "Testing connectivity...");
    log.info("Testing connector connectivity", { connectorId });

    try {
      const testResult = await registry.dispatchExecute(client, "connector", "test_connection", input, signal);
      const test = asRecord(testResult) ?? {};

      const testInfo: Record<string, unknown> = {
        status: test.status,
        tested_at: new Date().toISOString(),
      };

      if (test.status !== "SUCCESS") {
        const errors = Array.isArray(test.errors) ? test.errors : undefined;
        testInfo.error_summary = asString(test.errorSummary);
        if (errors && errors.length > 0) {
          testInfo.errors = errors.filter(isRecord).map((e) => ({
            reason: e.reason,
            message: e.message,
            code: e.code,
          }));
        }
      }
      diagnostic.test_result = testInfo;
    } catch (err) {
      log.warn("Connector test_connection failed", { connectorId, error: String(err) });
      diagnostic.test_result = {
        status: "ERROR",
        tested_at: new Date().toISOString(),
        error: String(err),
      };
    }

    // Deep link
    const orgId = asString(input.org_id) ?? config.HARNESS_ORG;
    const projectId = asString(input.project_id) ?? config.HARNESS_PROJECT;
    if (orgId && projectId) {
      const base = config.HARNESS_BASE_URL.replace(/\/$/, "");
      diagnostic.openInHarness = `${base}/ng/account/${registry.getAccountId()}/all/orgs/${orgId}/projects/${projectId}/setup/connectors/${connectorId}`;
    }

    await sendProgress(extra, 2, 2, "Connector diagnosis complete");
    return diagnostic;
  },
};
