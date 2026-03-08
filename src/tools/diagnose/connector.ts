import type { DiagnoseHandler, DiagnoseContext } from "./types.js";
import { createLogger } from "../../utils/logger.js";
import { sendProgress } from "../../utils/progress.js";

const log = createLogger("diagnose:connector");

export const connectorHandler: DiagnoseHandler = {
  entityType: "connector",
  description: "Diagnose a connector — fetches details and runs a connectivity test, returning type, auth method, status, and any connection errors.",

  async diagnose(ctx: DiagnoseContext): Promise<Record<string, unknown>> {
    const { client, registry, config, input, extra } = ctx;

    const connectorId = (input.resource_id as string) ?? (input.connector_id as string);
    if (!connectorId) {
      throw new Error("resource_id (connector identifier) is required. Provide it explicitly or via a Harness URL.");
    }
    input.connector_id = connectorId;

    const diagnostic: Record<string, unknown> = {};

    // 1. Fetch connector details
    await sendProgress(extra, 0, 2, "Fetching connector details...");
    log.info("Fetching connector", { connectorId });

    const raw = await registry.dispatch(client, "connector", "get", input);
    const connectorData = raw as Record<string, unknown>;
    const connector = (connectorData.connector ?? connectorData) as Record<string, unknown>;
    const spec = connector.spec as Record<string, unknown> | undefined;
    const status = connectorData.status as Record<string, unknown> | undefined;

    diagnostic.connector = {
      name: connector.name,
      identifier: connector.identifier,
      type: connector.type,
      description: connector.description || undefined,
      tags: connector.tags && Object.keys(connector.tags as Record<string, unknown>).length > 0
        ? connector.tags
        : undefined,
    };

    // Extract auth method from spec (varies by connector type)
    if (spec) {
      const authType = (spec.authentication as Record<string, unknown>)?.type
        ?? (spec.auth as Record<string, unknown>)?.type
        ?? spec.authType
        ?? spec.type;
      if (authType) {
        (diagnostic.connector as Record<string, unknown>).auth_type = authType;
      }

      const url = spec.url ?? spec.dockerRegistryUrl ?? spec.gitUrl
        ?? spec.masterUrl ?? spec.awsCrossAccountAttributes;
      if (url) {
        (diagnostic.connector as Record<string, unknown>).url = url;
      }
    }

    // Existing status from Harness (last known connectivity state)
    if (status) {
      diagnostic.last_known_status = {
        status: status.status,
        last_tested_at: status.lastTestedAt
          ? new Date(status.lastTestedAt as number).toISOString()
          : undefined,
        last_connected_at: status.lastConnectedAt
          ? new Date(status.lastConnectedAt as number).toISOString()
          : undefined,
      };
      if (status.errorSummary) {
        (diagnostic.last_known_status as Record<string, unknown>).error_summary = status.errorSummary;
      }
    }

    // 2. Run connectivity test
    await sendProgress(extra, 1, 2, "Testing connectivity...");
    log.info("Testing connector connectivity", { connectorId });

    try {
      const testResult = await registry.dispatchExecute(client, "connector", "test_connection", input);
      const test = testResult as Record<string, unknown>;

      diagnostic.test_result = {
        status: test.status,
        tested_at: new Date().toISOString(),
      };

      if (test.status !== "SUCCESS") {
        const errors = test.errors as Array<Record<string, unknown>> | undefined;
        const errorSummary = test.errorSummary as string | undefined;
        (diagnostic.test_result as Record<string, unknown>).error_summary = errorSummary;
        if (errors && errors.length > 0) {
          (diagnostic.test_result as Record<string, unknown>).errors = errors.map((e) => ({
            reason: e.reason,
            message: e.message,
            code: e.code,
          }));
        }
      }
    } catch (err) {
      log.warn("Connector test_connection failed", { connectorId, error: String(err) });
      diagnostic.test_result = {
        status: "ERROR",
        tested_at: new Date().toISOString(),
        error: String(err),
      };
    }

    // Deep link
    const orgId = (input.org_id as string) ?? config.HARNESS_DEFAULT_ORG_ID;
    const projectId = (input.project_id as string) ?? config.HARNESS_DEFAULT_PROJECT_ID;
    if (orgId && projectId) {
      const base = config.HARNESS_BASE_URL.replace(/\/$/, "");
      diagnostic.openInHarness = `${base}/ng/account/${config.HARNESS_ACCOUNT_ID}/all/orgs/${orgId}/projects/${projectId}/setup/connectors/${connectorId}`;
    }

    await sendProgress(extra, 2, 2, "Connector diagnosis complete");
    return diagnostic;
  },
};
