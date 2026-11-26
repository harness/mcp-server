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

// Known values from api.yaml PackageTypeV3. Extensible — the API may add more
// (e.g. GITLFS) so treat this as guidance for agents, not a hard whitelist.
export const V3_PACKAGE_TYPES = [
  "DOCKER", "MAVEN", "PYTHON", "GENERIC", "HELM", "HELM_HTTP", "NUGET", "NPM",
  "RPM", "CARGO", "COMPOSER", "GO", "HUGGINGFACE", "CONDA", "DART", "SWIFT",
  "PUPPET", "RUBY", "RAW", "DEBIAN", "CONAN", "TERRAFORM", "CRAN", "WOLFI",
  "ALPINE",
];
export const V3_SORT_DESC = "Sort spec `sort_field:sort_order`, e.g. `name:asc` or `modifiedAt:desc`.";
export const V3_PACKAGE_TYPES_DESC =
  "Package type. Known values include DOCKER, MAVEN, PYTHON, NPM, HELM, HELM_HTTP, etc. The API is extensible; unknown values may appear.";

// PackageStatsRequestV3 / VersionStatsRequestV3 / RegistryStatsRequestV3 accept at most 100 ids.
export const V3_STATS_MAX_IDS = 100;

export const statsBodySchema = (listParam: string, bodyKey: string, acceptsResourceId: boolean): BodySchema => ({
  description: `Built from params.${listParam}${acceptsResourceId ? " (or resource_id for one)" : ""}; you do not need to send a body, but body.${bodyKey} is accepted too.`,
  fields: [
    { name: bodyKey, type: "array", required: true, itemType: "string", description: `UUIDs to fetch stats for (1-${V3_STATS_MAX_IDS})` },
  ],
});
