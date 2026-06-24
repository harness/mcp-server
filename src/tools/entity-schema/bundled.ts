import { createLogger } from "../../utils/logger.js";
import {
  ENTITY_BUNDLED_KEYS,
  ENTITY_BUNDLED_META,
  ENTITY_BUNDLED_SCHEMAS,
} from "../../data/schemas/entities/index.js";
import type { JsonObject } from "./normalize.js";
import type { EntitySchemaCacheEntry, HarnessYamlScope } from "./types.js";
import { buildBundledSchemaKey, buildLiveSchemaCacheKey } from "./cache-keys.js";

const log = createLogger("entity-schema:bundled");

let loaded = false;
const bundledByScopeKey = new Map<string, JsonObject>();

function ensureLoaded(): void {
  if (loaded) return;
  for (const key of ENTITY_BUNDLED_KEYS) {
    const schema = ENTITY_BUNDLED_SCHEMAS[key];
    if (schema) bundledByScopeKey.set(key, schema as JsonObject);
  }
  loaded = true;
  if (bundledByScopeKey.size > 0) {
    const sample = ENTITY_BUNDLED_META[ENTITY_BUNDLED_KEYS[0]!];
    log.info("Loaded bundled entity schemas from disk", {
      count: bundledByScopeKey.size,
      ...(sample?.syncedAt ? { last_synced_at: sample.syncedAt } : {}),
      ...(sample?.accountId ? { snapshot_account_id: sample.accountId } : {}),
    });
  } else {
    log.debug("No bundled entity schemas present (run pnpm sync-entity-schemas)");
  }
}

/** True when vendored snapshots were produced for this account (safe to warm cache). */
export function bundledSnapshotsMatchAccount(accountId: string): boolean {
  ensureLoaded();
  if (bundledByScopeKey.size === 0) return false;
  const sample = ENTITY_BUNDLED_META[ENTITY_BUNDLED_KEYS[0]!];
  if (!sample?.accountId) return true;
  return sample.accountId === accountId;
}

export function getBundledEntitySchema(
  resourceType: string,
  scope: HarnessYamlScope,
): JsonObject | undefined {
  ensureLoaded();
  return bundledByScopeKey.get(buildBundledSchemaKey(resourceType, scope));
}

export function bundledSnapshotMatchesScope(
  resourceType: string,
  scope: HarnessYamlScope,
  orgId?: string,
  projectId?: string,
): boolean {
  ensureLoaded();
  const meta = ENTITY_BUNDLED_META[buildBundledSchemaKey(resourceType, scope)];
  if (!meta) return true;

  if ((scope === "org" || scope === "project") && meta.orgId && meta.orgId !== orgId) {
    return false;
  }
  if (scope === "project" && meta.projectId && meta.projectId !== projectId) {
    return false;
  }
  return true;
}

/**
 * Load vendored entity schemas at process startup (no HTTP).
 * Warms the live runtime cache when snapshots match the configured account (OSS / reference account).
 */
export function preloadBundledEntitySchemas(
  runtimeCache: Map<string, EntitySchemaCacheEntry>,
  accountId?: string,
): number {
  ensureLoaded();
  if (!accountId || bundledByScopeKey.size === 0 || !bundledSnapshotsMatchAccount(accountId)) {
    return bundledByScopeKey.size;
  }

  let warmed = 0;
  for (const [bundledKey, schema] of bundledByScopeKey) {
    const dot = bundledKey.lastIndexOf(".");
    if (dot < 0) continue;
    const resourceType = bundledKey.slice(0, dot);
    const scope = bundledKey.slice(dot + 1) as HarnessYamlScope;
    const meta = ENTITY_BUNDLED_META[bundledKey];
    const cacheKey = buildLiveSchemaCacheKey(resourceType, accountId, scope, {
      orgId: meta?.orgId,
      projectId: meta?.projectId,
    });
    if (!runtimeCache.has(cacheKey)) {
      runtimeCache.set(cacheKey, { schema, source: "bundled" });
      warmed += 1;
    }
  }

  if (warmed > 0) {
    log.info("Warmed entity schema cache from bundled snapshots", {
      account_id: accountId,
      entries: warmed,
    });
  }

  return bundledByScopeKey.size;
}

export function hasBundledEntitySchemas(): boolean {
  ensureLoaded();
  return bundledByScopeKey.size > 0;
}
