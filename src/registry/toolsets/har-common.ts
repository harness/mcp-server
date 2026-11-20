/**
 * Constants shared by the Artifact Registry toolsets (`registries`,
 * `registries-v3`, `registries-firewall`, `registries-lifecycle`), kept here so
 * the default toolsets do not import from the opt-in `registries-v3` file.
 */
import type { BodySchema } from "../types.js";

export const V3_SCOPE_PARAMS = {
  account: "account_identifier",
  org: "org_identifier",
  project: "project_identifier",
} as const;

// PackageStatsRequestV3 / VersionStatsRequestV3 / RegistryStatsRequestV3 accept at most 100 ids.
export const V3_STATS_MAX_IDS = 100;

export const statsBodySchema = (listParam: string, bodyKey: string, acceptsResourceId: boolean): BodySchema => ({
  description: `Built from params.${listParam}${acceptsResourceId ? " (or resource_id for one)" : ""}; you do not need to send a body.`,
  fields: [
    { name: bodyKey, type: "array", required: true, itemType: "string", description: `UUIDs to fetch stats for (1-${V3_STATS_MAX_IDS})` },
  ],
});
