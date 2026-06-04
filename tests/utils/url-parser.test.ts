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
    expect(result.resource_scope).toBe("account");
    expect(result.org_id).toBeUndefined();
    expect(result.project_id).toBeUndefined();
  });

  it("handles account-level settings connector by ID", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/settings/connectors/test",
    );
    expect(result.resource_type).toBe("connector");
    expect(result.resource_id).toBe("test");
    expect(result.resource_scope).toBe("account");
    expect(result.org_id).toBeUndefined();
  });

  it("handles project-level settings connector by ID", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/orgs/default/projects/GitX_Test/settings/connectors/harnessSecretManager",
    );
    expect(result.org_id).toBe("default");
    expect(result.project_id).toBe("GitX_Test");
    expect(result.resource_scope).toBe("project");
    expect(result.resource_type).toBe("connector");
    expect(result.resource_id).toBe("harnessSecretManager");
  });

  it("handles account-level settings infrastructure list", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/settings/infrastructures",
    );
    expect(result.account_id).toBe("lnFZRF6jQO6tQnB9znMALw");
    expect(result.resource_type).toBe("infrastructure");
    expect(result.resource_scope).toBe("account");
    expect(result.org_id).toBeUndefined();
    expect(result.project_id).toBeUndefined();
  });

  it("handles account-level File Store URLs", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/lnFZRF6jQO6tQnB9znMALw/all/settings/file-store/folder123",
    );
    expect(result.account_id).toBe("lnFZRF6jQO6tQnB9znMALw");
    expect(result.resource_type).toBe("file_store");
    expect(result.resource_id).toBe("folder123");
    expect(result.resource_scope).toBe("account");
    expect(result.org_id).toBeUndefined();
    expect(result.project_id).toBeUndefined();
  });

  it("handles file store IDs that collide with module names (ci, cd, sto)", () => {
    const r1 = parseHarnessUrl(
      "https://app.harness.io/ng/account/acc/all/settings/file-store/ci",
    );
    expect(r1.resource_type).toBe("file_store");
    expect(r1.resource_id).toBe("ci");
    expect(r1.resource_scope).toBe("account");

    const r2 = parseHarnessUrl(
      "https://app.harness.io/ng/account/acc/all/settings/file-store/sto",
    );
    expect(r2.resource_type).toBe("file_store");
    expect(r2.resource_id).toBe("sto");
  });

  it("still detects modules in /all/{module}/ structural position", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/acc/all/ci/orgs/myorg/projects/p1/pipelines/hello",
    );
    expect(result.module).toBe("ci");
    expect(result.resource_type).toBe("pipeline");
    expect(result.resource_id).toBe("hello");
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
    expect(result.resource_scope).toBe("project");
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
    expect(result.resource_scope).toBeUndefined();
  });

  it("extracts repo_id and pr_number from Harness Code PR URL", () => {
    const result = parseHarnessUrl(
      "https://harness0.harness.io/ng/account/l7B_kbSEQD2wjrM7PShm5w/module/code/orgs/PROD/projects/Data_Platform/repos/query-service/pulls/166/conversation",
    );
    expect(result.account_id).toBe("l7B_kbSEQD2wjrM7PShm5w");
    expect(result.module).toBe("code");
    expect(result.org_id).toBe("PROD");
    expect(result.project_id).toBe("Data_Platform");
    expect(result.repo_id).toBe("query-service");
    expect(result.pr_number).toBe("166");
    expect(result.resource_type).toBe("pr_activity");
    // conversation URLs route to pr_activity (the canonical way to read PR comments)
  });

  it("extracts repo_id and pr_number from pull-requests deep link URL", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/abc123/module/code/orgs/default/projects/myProject/repos/my-repo/pull-requests/42",
    );
    expect(result.repo_id).toBe("my-repo");
    expect(result.pr_number).toBe("42");
    expect(result.resource_type).toBe("pull_request");
    expect(result.resource_id).toBe("42");
  });

  it("handles URL-encoded segments", () => {
    const result = parseHarnessUrl(
      "https://app.harness.io/ng/account/abc123/all/orgs/default/projects/My%20Project/pipelines/My%20Pipeline/pipeline-studio",
    );
    expect(result.project_id).toBe("My%20Project"); // projects segment is extracted raw
    expect(result.pipeline_id).toBe("My Pipeline"); // resource IDs are decoded
    expect(result.resource_type).toBe("pipeline");
  });

  // Regression tests for path-only URLs.
  // Background: the Harness UI's "Copy Link" / address-bar fragment frequently
  // yields a path-only URL (no scheme/host). Previously `new URL(urlStr)` threw,
  // `applyUrlDefaults` silently caught and dropped every URL-derived field, and
  // URL-aware tools (harness_diagnose, harness_get, harness_execute, ...) failed
  // with "execution_id or pipeline_id is required" -- the highest-volume agent
  // error in production. Using `new URL(urlStr, base)` resolves path-only inputs
  // against a placeholder host that the parser never reads.

  it("parses a path-only execution URL (no scheme/host)", () => {
    const result = parseHarnessUrl(
      "/ng/account/MTEyYzc0MTctMzIyYi00ZT/module/ci/orgs/merdeploy/projects/econn/pipelines/build_jdk11_github_clickops/executions/2QvnKmYBRK2H5oC37YjdMQ/pipeline?connectorRef=org.org_ghec_con&repoName=harn-merdeploy&branch=vk_sandbox&storeType=REMOTE",
    );
    expect(result.account_id).toBe("MTEyYzc0MTctMzIyYi00ZT");
    expect(result.module).toBe("ci");
    expect(result.org_id).toBe("merdeploy");
    expect(result.project_id).toBe("econn");
    expect(result.resource_type).toBe("execution");
    expect(result.pipeline_id).toBe("build_jdk11_github_clickops");
    expect(result.execution_id).toBe("2QvnKmYBRK2H5oC37YjdMQ");
    expect(result.resource_id).toBe("2QvnKmYBRK2H5oC37YjdMQ");
    expect(result.connector_ref).toBe("org.org_ghec_con");
    expect(result.repo_name).toBe("harn-merdeploy");
    expect(result.branch).toBe("vk_sandbox");
    expect(result.store_type).toBe("REMOTE");
  });

  it("parses a path-only pipeline-studio URL", () => {
    const result = parseHarnessUrl(
      "/ng/account/NjU5NDczNGEtMTE1My00Mz/all/orgs/default/projects/ItsnotyouItstheskill/pipelines/slack_channel_summarizer_pipeline/pipeline-studio/?storeType=INLINE",
    );
    expect(result.account_id).toBe("NjU5NDczNGEtMTE1My00Mz");
    expect(result.org_id).toBe("default");
    expect(result.project_id).toBe("ItsnotyouItstheskill");
    expect(result.resource_type).toBe("pipeline");
    expect(result.pipeline_id).toBe("slack_channel_summarizer_pipeline");
    expect(result.resource_id).toBe("slack_channel_summarizer_pipeline");
    expect(result.store_type).toBe("INLINE");
  });

  it("parses a path-only URL with stage_id query param", () => {
    const result = parseHarnessUrl(
      "/ng/account/7i5sLmXBSne4D8bPq52bSw/all/orgs/et/projects/nabserv/pipelines/haproxyflag/executions/dqx6P6SZQbaLj2Qpdg3eLA/pipeline?stage=41EbIRIoRimtbDmHQL-T4A",
    );
    expect(result.execution_id).toBe("dqx6P6SZQbaLj2Qpdg3eLA");
    expect(result.pipeline_id).toBe("haproxyflag");
    expect(result.stage_id).toBe("41EbIRIoRimtbDmHQL-T4A");
  });

  it("is host-agnostic: absolute URL from a non-app.harness.io cluster parses identically to its path-only form", () => {
    const path =
      "/ng/account/abc123/all/orgs/default/projects/myProject/pipelines/myPipeline/executions/exec123/pipeline";
    const absoluteAlt = `https://app.eu1.harness.io${path}`;
    const absoluteSelfManaged = `https://harness.acmecorp.com${path}`;

    const fromPath = parseHarnessUrl(path);
    const fromAlt = parseHarnessUrl(absoluteAlt);
    const fromSelfManaged = parseHarnessUrl(absoluteSelfManaged);

    expect(fromPath).toEqual(fromAlt);
    expect(fromPath).toEqual(fromSelfManaged);
    expect(fromPath.execution_id).toBe("exec123");
    expect(fromPath.pipeline_id).toBe("myPipeline");
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

  it("does not merge URL-derived resource_scope unless requested by the caller", () => {
    const result = applyUrlDefaults(
      {},
      "https://app.harness.io/ng/account/abc/all/settings/connectors/test",
    );

    expect(result.resource_type).toBe("connector");
    expect(result.resource_id).toBe("test");
    expect(result.resource_scope).toBeUndefined();
  });

  it("can opt into URL-derived resource_scope for read tools", () => {
    const result = applyUrlDefaults(
      {},
      "https://app.harness.io/ng/account/abc/all/settings/connectors/test",
      { includeResourceScope: true },
    );

    expect(result.resource_scope).toBe("account");
  });

  it("injects resource_scope='account' for account-level template URLs", () => {
    const result = applyUrlDefaults(
      {},
      "https://app.harness.io/ng/account/abc/all/settings/templates/my-template",
      { includeResourceScope: true },
    );

    expect(result.resource_type).toBe("template");
    expect(result.resource_id).toBe("my-template");
    expect(result.resource_scope).toBe("account");
  });

  it("injects resource_scope='account' for account-level File Store URLs", () => {
    const result = applyUrlDefaults(
      {},
      "https://app.harness.io/ng/account/abc/all/settings/file-store/folder123",
      { includeResourceScope: true },
    );

    expect(result.resource_type).toBe("file_store");
    expect(result.resource_id).toBe("folder123");
    expect(result.resource_scope).toBe("account");
  });

  it("returns args unchanged when url is undefined", () => {
    const args = { resource_type: "pipeline" };
    const result = applyUrlDefaults(args as Record<string, unknown>, undefined);
    expect(result).toEqual(args);
  });

  it("returns args unchanged for an unparseable / non-Harness URL", () => {
    // `parseHarnessUrl` now uses a placeholder base host so path-only inputs
    // succeed (see parseHarnessUrl regression tests). A truly unparseable input
    // like "not-a-url" still yields no mergeable fields -- the input becomes a
    // single-segment path with no `orgs` / `projects` / resource markers -- so
    // args come back unchanged.
    const args = { resource_type: "pipeline" };
    const result = applyUrlDefaults(args as Record<string, unknown>, "not-a-url");
    expect(result).toEqual(args);
  });

  it("merges URL-derived values from a path-only URL (no scheme/host)", () => {
    const args = {};
    const result = applyUrlDefaults(
      args as Record<string, unknown>,
      "/ng/account/abc/all/orgs/myOrg/projects/myProject/pipelines/myPipeline/executions/exec123/pipeline",
    );
    expect(result.org_id).toBe("myOrg");
    expect(result.project_id).toBe("myProject");
    expect(result.resource_type).toBe("execution");
    expect(result.execution_id).toBe("exec123");
    expect(result.pipeline_id).toBe("myPipeline");
  });

  it("merges remote Git query params from a Harness URL", () => {
    const result = applyUrlDefaults(
      {},
      "https://app.harness.io/ng/account/abc/module/ci/orgs/myOrg/projects/myProject/pipelines/myPipeline/executions/exec123/pipeline?connectorRef=account.git_connector&repoName=ExampleOrg%2Fexample-service&branch=feature-branch&storeType=REMOTE",
    );

    expect(result.pipeline_id).toBe("myPipeline");
    expect(result.execution_id).toBe("exec123");
    expect(result.connector_ref).toBe("account.git_connector");
    expect(result.repo_name).toBe("ExampleOrg/example-service");
    expect(result.branch).toBe("feature-branch");
    expect(result.store_type).toBe("REMOTE");
  });

  it("preserves explicit remote Git params over URL-derived defaults", () => {
    const result = applyUrlDefaults(
      {
        branch: "explicit-branch",
        store_type: "INLINE",
        connector_ref: "explicit.connector",
        repo_name: "explicit/repo",
      },
      "https://app.harness.io/ng/account/abc/module/ci/orgs/myOrg/projects/myProject/pipelines/myPipeline/executions/exec123/pipeline?connectorRef=url.connector&repoName=url%2Frepo&branch=url-branch&storeType=REMOTE",
    );

    expect(result.branch).toBe("explicit-branch");
    expect(result.store_type).toBe("INLINE");
    expect(result.connector_ref).toBe("explicit.connector");
    expect(result.repo_name).toBe("explicit/repo");
    expect(result.pipeline_id).toBe("myPipeline");
    expect(result.execution_id).toBe("exec123");
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
