import type { DiagnoseHandler, DiagnoseContext } from "./types.js";
import { createLogger } from "../../utils/logger.js";
import { sendProgress } from "../../utils/progress.js";
import { asString, isRecord } from "../../utils/type-guards.js";

const log = createLogger("diagnose:delegate");

/** Matches the actual listDelegates API response schema (resource[] items). */
interface DelegateInfo {
  type?: string;
  name?: string;
  description?: string;
  tags?: string[];
  lastHeartBeat?: number;
  connected?: boolean;
  delegateReplicas?: Array<{
    uuid?: string;
    lastHeartbeat?: number;
    hostName?: string;
    version?: string;
    expiringAt?: number;
  }>;
  autoUpgrade?: "ON" | "OFF" | "DETECTING";
  legacy?: boolean;
  orgName?: string;
  projectName?: string;
}

function analyzeDelegateHealth(delegate: DelegateInfo): {
  summary: Record<string, unknown>;
  issues: string[];
} {
  const issues: string[] = [];
  const name = delegate.name ?? "unknown";
  const connected = delegate.connected ?? false;
  const lastHeartbeat = delegate.lastHeartBeat;

  if (!connected) {
    issues.push("Delegate is not actively connected");
  }

  if (lastHeartbeat) {
    const ageMs = Date.now() - lastHeartbeat;
    const ageMinutes = Math.floor(ageMs / 60_000);
    if (ageMinutes > 5) {
      issues.push(`Last heartbeat was ${ageMinutes} minutes ago (stale)`);
    }
  }

  const replicas = delegate.delegateReplicas ?? [];

  // Check for expiring replicas
  const now = Date.now();
  const expiringReplicas = replicas.filter((r) => r.expiringAt && r.expiringAt > 0 && r.expiringAt < now + 7 * 24 * 60 * 60 * 1000);
  if (expiringReplicas.length > 0) {
    issues.push(`${expiringReplicas.length}/${replicas.length} replica(s) expiring within 7 days`);
  }

  if (delegate.legacy) {
    issues.push("Delegate is using legacy mode");
  }

  const versions = [...new Set(replicas.map((r) => r.version).filter(Boolean))];

  const summary: Record<string, unknown> = {
    name,
    type: delegate.type,
    connected,
    tags: delegate.tags?.length ? delegate.tags : undefined,
    auto_upgrade: delegate.autoUpgrade,
    legacy: delegate.legacy || undefined,
    last_heartbeat: lastHeartbeat ? new Date(lastHeartbeat).toISOString() : undefined,
    replica_count: replicas.length || undefined,
    versions: versions.length ? versions : undefined,
    org: delegate.orgName || undefined,
    project: delegate.projectName || undefined,
  };

  return { summary, issues };
}

export const delegateHandler: DiagnoseHandler = {
  entityType: "delegate",
  description: "Diagnose delegate health — lists all delegates, reports connectivity, heartbeat status, version, and any detected issues.",

  async diagnose(ctx: DiagnoseContext): Promise<Record<string, unknown>> {
    const { client, registry, config, input, extra, signal } = ctx;

    const targetId = asString(input.resource_id) ?? asString(input.delegate_id);

    await sendProgress(extra, 0, 1, "Fetching delegates...");
    log.info("Listing delegates", { targetId: targetId ?? "all" });

    // Always pass all=true to get delegates across all org/project scopes
    const raw = await registry.dispatch(client, "delegate", "list", { ...input, all: "true" }, signal);

    let delegates: DelegateInfo[];
    if (Array.isArray(raw)) {
      delegates = raw as DelegateInfo[];
    } else {
      delegates = [];
      log.warn("Unexpected delegate list response shape", {
        type: typeof raw,
        isArray: false,
        keys: isRecord(raw) ? Object.keys(raw) : [],
      });
    }

    if (delegates.length === 0) {
      return {
        total_delegates: 0,
        note: "No delegates returned by the API for this account.",
        openInHarness: `${config.HARNESS_BASE_URL.replace(/\/$/, "")}/ng/account/${config.HARNESS_ACCOUNT_ID}/settings/resources/delegates`,
      };
    }

    // Filter to specific delegate if requested
    if (targetId) {
      const lower = targetId.toLowerCase();
      const match = delegates.filter((d) =>
        d.name?.toLowerCase() === lower ||
        d.name?.toLowerCase().includes(lower),
      );
      if (match.length > 0) {
        delegates = match;
      } else {
        throw new Error(`Delegate '${targetId}' not found. Available: ${delegates.map((d) => d.name).join(", ")}`);
      }
    }

    const results: Record<string, unknown>[] = delegates.map((d) => {
      const { summary, issues } = analyzeDelegateHealth(d);
      return { ...summary, issues: issues.length > 0 ? issues : undefined, healthy: issues.length === 0 };
    });

    const unhealthy = results.filter((r) => !r.healthy);

    const diagnostic: Record<string, unknown> = {
      total_delegates: results.length,
      healthy_count: results.length - unhealthy.length,
      unhealthy_count: unhealthy.length,
    };

    if (targetId || results.length <= 5) {
      diagnostic.delegates = results;
    } else {
      if (unhealthy.length > 0) {
        diagnostic.unhealthy_delegates = unhealthy;
      }
      diagnostic.all_delegates = results.map((r) => ({
        name: r.name,
        type: r.type,
        connected: r.connected,
        healthy: r.healthy,
        org: r.org,
        project: r.project,
      }));
    }

    const base = config.HARNESS_BASE_URL.replace(/\/$/, "");
    diagnostic.openInHarness = `${base}/ng/account/${config.HARNESS_ACCOUNT_ID}/settings/resources/delegates`;

    await sendProgress(extra, 1, 1, "Delegate diagnosis complete");
    return diagnostic;
  },
};
