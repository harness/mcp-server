import type { DiagnoseHandler, DiagnoseContext } from "./types.js";
import { createLogger } from "../../utils/logger.js";
import { sendProgress } from "../../utils/progress.js";

const log = createLogger("diagnose:gitops-application");

const MAX_WARNINGS = 15;
const UNHEALTHY_STATUSES = new Set(["Degraded", "Missing", "Unknown"]);

interface AppStatus {
  sync?: { status?: string; revision?: string; comparedTo?: { source?: { repoURL?: string; path?: string; targetRevision?: string } } };
  health?: { status?: string; message?: string };
  conditions?: Array<{ type?: string; message?: string; lastTransitionTime?: string }>;
  operationState?: {
    phase?: string;
    message?: string;
    startedAt?: string;
    finishedAt?: string;
    syncResult?: {
      revision?: string;
      resources?: Array<{ kind?: string; name?: string; namespace?: string; status?: string; message?: string; hookPhase?: string }>;
    };
    operation?: { sync?: { revision?: string } };
    retryCount?: number;
  };
  summary?: { images?: string[] };
  resources?: Array<{ kind?: string; name?: string; namespace?: string; health?: { status?: string; message?: string }; status?: string }>;
  [key: string]: unknown;
}

interface ResourceNode {
  kind?: string;
  name?: string;
  namespace?: string;
  group?: string;
  version?: string;
  health?: { status?: string; message?: string };
  info?: Array<{ name?: string; value?: string }>;
  parentRefs?: Array<{ kind?: string; name?: string; namespace?: string }>;
  [key: string]: unknown;
}

function analyzeAppStatus(raw: Record<string, unknown>): Record<string, unknown> {
  const app = (raw.app ?? raw) as Record<string, unknown>;
  const spec = app.spec as Record<string, unknown> | undefined;
  const status = (app.status ?? {}) as AppStatus;
  const metadata = app.metadata as Record<string, unknown> | undefined;

  const result: Record<string, unknown> = {};

  result.application = {
    name: metadata?.name ?? app.name ?? app.appName,
    namespace: metadata?.namespace,
    sync_status: status.sync?.status,
    health_status: status.health?.status,
    health_message: status.health?.message || undefined,
    repo_url: status.sync?.comparedTo?.source?.repoURL
      ?? (spec?.source as Record<string, unknown>)?.repoURL,
    target_revision: status.sync?.comparedTo?.source?.targetRevision
      ?? (spec?.source as Record<string, unknown>)?.targetRevision,
    path: status.sync?.comparedTo?.source?.path
      ?? (spec?.source as Record<string, unknown>)?.path,
    synced_revision: status.sync?.revision,
  };

  // Operation state (last sync attempt)
  const opState = status.operationState;
  if (opState) {
    const syncResult = opState.syncResult;
    const failedResources = syncResult?.resources?.filter(
      (r) => r.status === "SyncFailed" || r.hookPhase === "Failed",
    );

    result.last_sync_operation = {
      phase: opState.phase,
      message: opState.message || undefined,
      started_at: opState.startedAt,
      finished_at: opState.finishedAt,
      retry_count: opState.retryCount || undefined,
      synced_revision: syncResult?.revision,
      failed_resources: failedResources && failedResources.length > 0
        ? failedResources.map((r) => ({
            kind: r.kind,
            name: r.name,
            namespace: r.namespace,
            status: r.status,
            message: r.message,
            hook_phase: r.hookPhase || undefined,
          }))
        : undefined,
    };
  }

  // Conditions (warnings, errors from Argo CD)
  const conditions = status.conditions;
  if (conditions && conditions.length > 0) {
    result.conditions = conditions.map((c) => ({
      type: c.type,
      message: c.message,
      last_transition: c.lastTransitionTime,
    }));
  }

  return result;
}

function analyzeResourceTree(raw: unknown): {
  unhealthy: Record<string, unknown>[];
  total: number;
  healthy_count: number;
} {
  const data = raw as Record<string, unknown>;
  const nodes = (data.nodes ?? []) as ResourceNode[];

  const withHealth = nodes.filter((n) => n.health?.status);
  const unhealthy = withHealth
    .filter((n) => UNHEALTHY_STATUSES.has(n.health!.status!))
    .map((n) => ({
      kind: n.kind,
      name: n.name,
      namespace: n.namespace,
      group: n.group || undefined,
      health_status: n.health!.status,
      health_message: n.health!.message || undefined,
      info: n.info?.filter((i) => i.value)?.map((i) => `${i.name}: ${i.value}`) || undefined,
    }));

  return {
    unhealthy,
    total: withHealth.length,
    healthy_count: withHealth.length - unhealthy.length,
  };
}

function analyzeEvents(raw: unknown): Record<string, unknown>[] {
  const data = raw as Record<string, unknown>;
  const items = (data.items ?? (Array.isArray(raw) ? raw : [])) as Array<Record<string, unknown>>;

  return items
    .filter((e) => e.type === "Warning")
    .slice(-MAX_WARNINGS)
    .map((e) => ({
      reason: e.reason,
      message: e.message,
      count: e.count,
      first_seen: e.firstTimestamp ?? e.firstTime,
      last_seen: e.lastTimestamp ?? e.lastTime,
    }));
}

export const gitopsApplicationHandler: DiagnoseHandler = {
  entityType: "gitops_application",
  description: "Diagnose a GitOps application — combines app sync/health status, Kubernetes resource tree health, and recent warning events into a single diagnosis.",

  async diagnose(ctx: DiagnoseContext): Promise<Record<string, unknown>> {
    const { client, registry, config, input, extra } = ctx;

    const agentId = input.agent_id as string | undefined;
    const appName = (input.resource_id as string) ?? (input.app_name as string);

    if (!agentId) {
      throw new Error("agent_id is required for GitOps application diagnosis. Provide it explicitly or via a Harness URL.");
    }
    if (!appName) {
      throw new Error("resource_id (application name) is required. Provide it explicitly or via a Harness URL.");
    }

    const dispatchInput = { ...input, agent_id: agentId, app_name: appName };
    const diagnostic: Record<string, unknown> = {};
    const issues: string[] = [];

    // Fetch all three in parallel — resource tree and events are supplementary
    await sendProgress(extra, 0, 3, "Fetching application status...");
    log.info("Diagnosing GitOps application", { agentId, appName });

    const [appResult, treeResult, eventsResult] = await Promise.allSettled([
      registry.dispatch(client, "gitops_application", "get", dispatchInput),
      registry.dispatch(client, "gitops_app_resource_tree", "get", dispatchInput),
      registry.dispatch(client, "gitops_app_event", "list", dispatchInput),
    ]);

    // 1. App status (required)
    await sendProgress(extra, 1, 3, "Analyzing application status...");

    if (appResult.status === "rejected") {
      throw new Error(`Failed to fetch GitOps application '${appName}': ${appResult.reason}`);
    }

    const appAnalysis = analyzeAppStatus(appResult.value as Record<string, unknown>);
    Object.assign(diagnostic, appAnalysis);

    const appInfo = diagnostic.application as Record<string, unknown>;
    const syncStatus = appInfo.sync_status as string | undefined;
    const healthStatus = appInfo.health_status as string | undefined;

    if (syncStatus === "OutOfSync") {
      issues.push("Application is OutOfSync — live state differs from desired state in Git");
    }
    if (syncStatus === "Unknown") {
      issues.push("Sync status is Unknown — the application may not be reachable");
    }
    if (healthStatus && UNHEALTHY_STATUSES.has(healthStatus)) {
      issues.push(`Application health is ${healthStatus}`);
    }
    if (healthStatus === "Suspended") {
      issues.push("Application is Suspended — reconciliation is paused");
    }

    const opState = diagnostic.last_sync_operation as Record<string, unknown> | undefined;
    if (opState?.phase === "Failed" || opState?.phase === "Error") {
      issues.push(`Last sync operation ${opState.phase}: ${opState.message ?? "no details"}`);
    }

    const conditions = diagnostic.conditions as Array<Record<string, unknown>> | undefined;
    if (conditions) {
      for (const c of conditions) {
        issues.push(`Condition [${c.type}]: ${c.message}`);
      }
    }

    // 2. Resource tree (supplementary)
    await sendProgress(extra, 2, 3, "Analyzing resource tree...");

    if (treeResult.status === "fulfilled") {
      const tree = analyzeResourceTree(treeResult.value);
      diagnostic.resource_tree = {
        total_resources: tree.total,
        healthy_count: tree.healthy_count,
        unhealthy_count: tree.unhealthy.length,
      };
      if (tree.unhealthy.length > 0) {
        (diagnostic.resource_tree as Record<string, unknown>).unhealthy_resources = tree.unhealthy;
        issues.push(`${tree.unhealthy.length} unhealthy resource(s) in the cluster`);
      }
    } else {
      log.warn("Failed to fetch resource tree", { error: String(treeResult.reason) });
      diagnostic.resource_tree = { error: "Could not fetch resource tree", detail: String(treeResult.reason) };
    }

    // 3. Events (supplementary)
    if (eventsResult.status === "fulfilled") {
      const warnings = analyzeEvents(eventsResult.value);
      if (warnings.length > 0) {
        diagnostic.recent_warnings = warnings;
        issues.push(`${warnings.length} recent warning event(s)`);
      }
    } else {
      log.warn("Failed to fetch events", { error: String(eventsResult.reason) });
    }

    // Overall assessment
    diagnostic.overall_health = healthStatus ?? "Unknown";
    diagnostic.issues = issues.length > 0 ? issues : undefined;
    diagnostic.healthy = issues.length === 0;

    // Deep link
    const orgId = (input.org_id as string) ?? config.HARNESS_DEFAULT_ORG_ID;
    const projectId = (input.project_id as string) ?? config.HARNESS_DEFAULT_PROJECT_ID;
    if (orgId && projectId) {
      const base = config.HARNESS_BASE_URL.replace(/\/$/, "");
      diagnostic.openInHarness = `${base}/ng/account/${config.HARNESS_ACCOUNT_ID}/all/orgs/${orgId}/projects/${projectId}/gitops/applications/${encodeURIComponent(appName)}`;
    }

    await sendProgress(extra, 3, 3, "GitOps application diagnosis complete");
    return diagnostic;
  },
};
