import { describe, it, expect } from "vitest";
import { parseHarnessUrl, applyUrlDefaults } from "../../src/utils/url-parser.js";

describe("parseHarnessUrl", () => {
  it("extracts account, org, project from a standard project URL", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/orgs/default/projects/PM_Signoff/pipelines",
    );
    expect(result.account_id).toBe("lnFZRF6jQO6tQnB9znMALw");
    expect(result.org_id).toBe("default");
    expect(result.project_id).toBe("PM_Signoff");
    expect(result.resource_type).toBe("pipeline");
    expect(result.resource_id).toBeUndefined(); // list page, no specific ID
  });

  it("extracts pipeline ID from pipeline-studio URL", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/orgs/default/projects/PM_Signoff/pipelines/Test_Approval/pipeline-studio/?storeType=INLINE&stageId=harness&sectionId=EXECUTION",
    );
    expect(result.org_id).toBe("default");
    expect(result.project_id).toBe("PM_Signoff");
    expect(result.resource_type).toBe("pipeline");
    expect(result.resource_id).toBe("Test_Approval");
    expect(result.pipeline_id).toBe("Test_Approval");
  });

  it("extracts pipeline ID from a second pipeline-studio URL", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/orgs/default/projects/PM_Signoff/pipelines/Cursor_test_4/pipeline-studio/?storeType=INLINE",
    );
    expect(result.resource_type).toBe("pipeline");
    expect(result.resource_id).toBe("Cursor_test_4");
    expect(result.pipeline_id).toBe("Cursor_test_4");
  });

  it("extracts stepId from query params", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/orgs/default/projects/PM_Signoff/pipelines/Test_Approval/pipeline-studio/?storeType=INLINE&stageId=harness&sectionId=EXECUTION&stepId=steps.0.step.approve",
    );
    expect(result.resource_type).toBe("pipeline");
    expect(result.resource_id).toBe("Test_Approval");
  });

  it("extracts module from /all/{module}/orgs/... pattern", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/cd/orgs/default/projects/PM_Signoff/environments",
    );
    expect(result.module).toBe("cd");
    expect(result.org_id).toBe("default");
    expect(result.project_id).toBe("PM_Signoff");
    expect(result.resource_type).toBe("environment");
    expect(result.resource_id).toBeUndefined(); // list page
  });

  it("handles account-level settings connectors list", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/settings/connectors",
    );
    expect(result.account_id).toBe("lnFZRF6jQO6tQnB9znMALw");
    expect(result.resource_type).toBe("connector");
    expect(result.resource_id).toBeUndefined();
    expect(result.org_id).toBeUndefined();
    expect(result.project_id).toBeUndefined();
  });

  it("handles account-level settings connector by ID", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/settings/connectors/test",
    );
    expect(result.resource_type).toBe("connector");
    expect(result.resource_id).toBe("test");
    expect(result.org_id).toBeUndefined();
  });

  it("handles project-level settings connector by ID", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/orgs/default/projects/GitX_Test/settings/connectors/harnessSecretManager",
    );
    expect(result.org_id).toBe("default");
    expect(result.project_id).toBe("GitX_Test");
    expect(result.resource_type).toBe("connector");
    expect(result.resource_id).toBe("harnessSecretManager");
  });

  it("extracts execution ID and pipeline ID from execution URL", () => {
    const result = parseHarnessUrl(
      "https://ancestry.harness.io/ng/account/cetPGmqTQ22qdnkyMdP_9A/all/orgs/Genomics/projects/ga_ethnicity/pipelines/stack_ecs_docker_deploy/executions/GsHdrBCwR4ah3rwN9W_DMg/pipeline",
    );
    expect(result.account_id).toBe("cetPGmqTQ22qdnkyMdP_9A");
    expect(result.org_id).toBe("Genomics");
    expect(result.project_id).toBe("ga_ethnicity");
    expect(result.resource_type).toBe("execution");
    expect(result.resource_id).toBe("GsHdrBCwR4ah3rwN9W_DMg");
    expect(result.execution_id).toBe("GsHdrBCwR4ah3rwN9W_DMg");
    expect(result.pipeline_id).toBe("stack_ecs_docker_deploy");
  });

  it("handles /module/{module}/ pattern with deployments alias", () => {
    const result = parseHarnessUrl(
      "https://ancestry.harness.io/ng/account/cetPGmqTQ22qdnkyMdP_9A/module/ci/orgs/SOX/projects/sox_renewalslambdas/pipelines/stack_build/deployments/-JuPz3aUTriC4xig66BMEQ/pipeline?storeType=INLINE&step=mrwFoOjlQRC28GB3QpZ60g&stage=yx6EMK34TGyrcFsXeiJD0g",
    );
    expect(result.module).toBe("ci");
    expect(result.org_id).toBe("SOX");
    expect(result.project_id).toBe("sox_renewalslambdas");
    expect(result.resource_type).toBe("execution");
    expect(result.execution_id).toBe("-JuPz3aUTriC4xig66BMEQ");
    expect(result.pipeline_id).toBe("stack_build");
  });

  it("extracts execution step query params from execution URL", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/acc123/module/ci/orgs/test_org/projects/test_project/pipelines/sample_pipeline/executions/exec_123/pipeline?step=step_uuid_123&stage=stage_uuid_456&stageExecId=stage_exec_456",
    );
    expect(result.execution_id).toBe("exec_123");
    expect(result.pipeline_id).toBe("sample_pipeline");
    expect(result.step_id).toBe("step_uuid_123");
    expect(result.stage_id).toBe("stage_uuid_456");
    expect(result.stage_execution_id).toBe("stage_exec_456");
  });

  it("handles vanity domain URLs", () => {
    const result = parseHarnessUrl(
      "https://ancestry.harness.io/ng/account/cetPGmqTQ22qdnkyMdP_9A/all/orgs/Genomics/projects/ga_ethnicity/services",
    );
    expect(result.account_id).toBe("cetPGmqTQ22qdnkyMdP_9A");
    expect(result.org_id).toBe("Genomics");
    expect(result.resource_type).toBe("service");
  });

  it("handles environment with specific ID", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/abc123/all/orgs/myOrg/projects/myProject/environments/prod",
    );
    expect(result.resource_type).toBe("environment");
    expect(result.resource_id).toBe("prod");
    expect(result.environment_id).toBe("prod");
  });

  it("handles gitops agents URL", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/abc123/all/orgs/default/projects/myProject/gitops/agents/myAgent/applications/myApp",
    );
    expect(result.resource_type).toBe("gitops_application");
    expect(result.resource_id).toBe("myApp");
    expect(result.agent_id).toBe("myAgent");
  });

  it("handles feature flags URL", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/abc123/cf/orgs/default/projects/myProject/feature-flags/my_flag",
    );
    expect(result.resource_type).toBe("fme_feature_flag");
    expect(result.resource_id).toBe("my_flag");
  });

  it("handles URL-encoded segments", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/abc123/all/orgs/default/projects/My%20Project/pipelines/My%20Pipeline/pipeline-studio",
    );
    expect(result.project_id).toBe("My%20Project"); // projects segment is extracted raw
    expect(result.pipeline_id).toBe("My Pipeline"); // resource IDs are decoded
    expect(result.resource_type).toBe("pipeline");
  });
});

describe("applyUrlDefaults", () => {
  it("merges URL-derived values into args as defaults", () => {
    const args = { include_yaml: true };
    const result = applyUrlDefaults(
      args as Record<string, unknown>,
      "https://app.harness.io/ng/account/abc/all/orgs/myOrg/projects/myProject/pipelines/myPipeline/executions/exec123/pipeline",
    );
    expect(result.org_id).toBe("myOrg");
    expect(result.project_id).toBe("myProject");
    expect(result.resource_type).toBe("execution");
    expect(result.execution_id).toBe("exec123");
    expect(result.pipeline_id).toBe("myPipeline");
    expect(result.include_yaml).toBe(true); // original arg preserved
  });

  it("explicit args take precedence over URL-derived values", () => {
    const args = { org_id: "explicitOrg", resource_type: "service" };
    const result = applyUrlDefaults(
      args as Record<string, unknown>,
      "https://app.harness.io/ng/account/abc/all/orgs/urlOrg/projects/urlProject/pipelines",
    );
    expect(result.org_id).toBe("explicitOrg"); // explicit wins
    expect(result.resource_type).toBe("service"); // explicit wins
    expect(result.project_id).toBe("urlProject"); // filled from URL
  });

  it("returns args unchanged when url is undefined", () => {
    const args = { resource_type: "pipeline" };
    const result = applyUrlDefaults(args as Record<string, unknown>, undefined);
    expect(result).toEqual(args);
  });

  it("returns args unchanged for invalid URL", () => {
    const args = { resource_type: "pipeline" };
    const result = applyUrlDefaults(args as Record<string, unknown>, "not-a-url");
    expect(result).toEqual(args);
  });

  it("does not mutate the original args object", () => {
    const args = { resource_type: "pipeline" };
    const result = applyUrlDefaults(
      args as Record<string, unknown>,
      "https://app.harness.io/ng/account/abc/all/orgs/myOrg/projects/myProject/services",
    );
    expect(args).toEqual({ resource_type: "pipeline" }); // unchanged
    expect(result.org_id).toBe("myOrg");
  });
});
