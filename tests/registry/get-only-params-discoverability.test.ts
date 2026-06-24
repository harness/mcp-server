/**
 * Behavioral tests for get-only resources whose params moved from listFilterFields
 * to get.paramsSchema (PR #406). Ensures harness_describe and the global filter
 * catalog surface the right discovery path for agents.
 */
import { describe, it, expect } from "vitest";
import { Registry } from "../../src/registry/index.js";

const MINIMAL_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
} as const;

/** Get-only resources migrated off listFilterFields in PR #406. */
const MIGRATED_GET_ONLY_RESOURCES: Array<{
  resourceType: string;
  getParamNames: string[];
}> = [
  { resourceType: "sei_productivity_metric", getParamNames: ["team_ref_id", "feature_type"] },
  { resourceType: "sei_dora_metric", getParamNames: ["metric", "team_ref_id"] },
  { resourceType: "sei_ai_impact", getParamNames: ["aspect", "team_ref_id"] },
  { resourceType: "cost_account_overview", getParamNames: ["start_time", "group_by"] },
  { resourceType: "cost_recommendation_stats", getParamNames: ["group_by"] },
  { resourceType: "cost_commitment", getParamNames: ["aspect", "cloud_account_id"] },
  { resourceType: "dashboard_data", getParamNames: ["reporting_timeframe"] },
  { resourceType: "execution_log", getParamNames: ["execution_id"] },
  { resourceType: "gitops_pod_log", getParamNames: ["pod_name"] },
  { resourceType: "database_llm_authoring_pipeline", getParamNames: ["dbinstance_id"] },
  { resourceType: "chaos_component_variable", getParamNames: ["type", "identifier"] },
  { resourceType: "scs_component_dependencies", getParamNames: ["purl"] },
  { resourceType: "scs_artifact_remediation", getParamNames: ["purl"] },
  { resourceType: "scs_component_remediation", getParamNames: ["purl"] },
  { resourceType: "scs_component_enrichment", getParamNames: ["purl"] },
];

/** Params exclusive to migrated get-only resources — must not pollute harness_list filter catalog. */
const EXCLUSIVE_GET_ONLY_FILTER_NAMES = [
  "metric",
  "pod_name",
  "reporting_timeframe",
  "cloud_account_id",
  "feature_type",
] as const;

describe("get-only params discoverability", () => {
  const registry = new Registry(MINIMAL_CONFIG);

  for (const { resourceType, getParamNames } of MIGRATED_GET_ONLY_RESOURCES) {
    it(`${resourceType} has no listFilterFields and exposes get paramsSchema`, () => {
      const def = registry.getResource(resourceType);

      expect(def.listFilterFields ?? []).toEqual([]);
      expect(def.operations.list).toBeUndefined();

      const getOp = def.operations.get;
      expect(getOp).toBeDefined();
      expect(getOp!.paramsSchema?.fields).toBeDefined();

      const paramNames = getOp!.paramsSchema!.fields.map((f) => f.name);
      for (const name of getParamNames) {
        expect(paramNames, `${resourceType} get.paramsSchema missing ${name}`).toContain(name);
      }
    });
  }

  it("getAllFilterFields does not include params exclusive to migrated get-only resources", () => {
    const fields = registry.getAllFilterFields();
    const fieldNames = new Set(fields.map((f) => f.name));

    const leaked = EXCLUSIVE_GET_ONLY_FILTER_NAMES.filter((name) => fieldNames.has(name));
    expect(
      leaked,
      `get-only params leaked into global filter catalog: ${leaked.join(", ")}`,
    ).toEqual([]);
  });
});
