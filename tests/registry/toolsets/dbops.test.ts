import { describe, it, expect } from "vitest";
import { dbopsToolset } from "../../../src/registry/toolsets/dbops.js";

const executeResource = dbopsToolset.resources.find(
  (r) => r.resourceType === "database_execute_llm_authoring_pipeline",
);
if (!executeResource) {
  throw new Error("database_execute_llm_authoring_pipeline resource missing from dbopsToolset");
}
const runAction = executeResource.executeActions?.run;
if (!runAction) {
  throw new Error("run execute action missing from database_execute_llm_authoring_pipeline resource");
}
const buildBody = runAction.bodyBuilder!;

describe("database_execute_llm_authoring_pipeline endpoint spec", () => {
  it("documents project scope and the project-level pipeline setting", () => {
    expect(executeResource.description).toContain("Project-scoped");
    expect(executeResource.description).toContain("org_id and project_id");
    expect(executeResource.description).toContain("HARNESS_ORG/HARNESS_PROJECT");
    expect(executeResource.description).toContain("project-level NG setting");
    expect(executeResource.description).toContain("dbops_llm_authoring_pipeline_id");
    expect(executeResource.scope).toBe("project");
  });

  it("exposes only harness_execute run (no legacy operations.create shim)", () => {
    expect(executeResource.operations).toEqual({});
    expect(executeResource.executeActions?.run).toBeDefined();
    expect(runAction.path).not.toContain("execute-llm-authoring-pipeline");
  });

  it("hits the v1 llm-authoring/execute-pipeline path", () => {
    expect(runAction.method).toBe("POST");
    expect(runAction.path).toBe(
      "/v1/orgs/{org}/projects/{project}/llm-authoring/execute-pipeline",
    );
  });

  it("uses low_write risk on run (user consents upstream)", () => {
    // Intentionally below requiresConfirmation: Accept & Commit in the changeset
    // skill already collects user consent; medium_write stacked a second approval card.
    expect(runAction.operationPolicy).toEqual({
      risk: "low_write",
      retryPolicy: "do_not_retry",
    });
  });

  it("forwards the custom-pipeline branch verbatim", () => {
    const body = buildBody({
      schema_id: "s",
      instance_id: "i",
      conversation_id: "c",
      changeset: "cs",
      pipeline_identifier: "my-pipe",
      runtime_inputs: { releaseCodename: "phoenix" },
    }) as Record<string, unknown>;
    expect(body).toMatchObject({
      schemaId: "s",
      instanceId: "i",
      conversationId: "c",
      changeset: "cs",
      pipelineIdentifier: "my-pipe",
      runtimeInputs: { releaseCodename: "phoenix" },
    });
    expect(body).not.toHaveProperty("useDefaultPipeline");
  });

  it("forwards the default-pipeline branch with useDefaultPipeline=true", () => {
    const body = buildBody({
      schema_id: "s",
      instance_id: "i",
      conversation_id: "c",
      changeset: "cs",
      use_default_pipeline: true,
    }) as Record<string, unknown>;
    expect(body).toMatchObject({
      schemaId: "s",
      instanceId: "i",
      conversationId: "c",
      changeset: "cs",
      useDefaultPipeline: true,
    });
    expect(body).not.toHaveProperty("pipelineIdentifier");
    expect(body).not.toHaveProperty("runtimeInputs");
  });

  it("accepts inputs nested under `body` (callers may double-wrap)", () => {
    const body = buildBody({
      body: {
        schema_id: "s",
        instance_id: "i",
        conversation_id: "c",
        changeset: "cs",
        use_default_pipeline: true,
      },
    }) as Record<string, unknown>;
    expect(body).toMatchObject({
      schemaId: "s",
      instanceId: "i",
      useDefaultPipeline: true,
    });
  });

  it("accepts already-camelCase fields (idempotent on either casing)", () => {
    const body = buildBody({
      schemaId: "s",
      instanceId: "i",
      conversationId: "c",
      changeset: "cs",
      pipelineIdentifier: "my-pipe",
    }) as Record<string, unknown>;
    expect(body).toMatchObject({
      schemaId: "s",
      instanceId: "i",
      pipelineIdentifier: "my-pipe",
    });
  });

  it("does not default branch fields when omitted", () => {
    const body = buildBody({
      schema_id: "s",
      instance_id: "i",
      conversation_id: "c",
      changeset: "cs",
    }) as Record<string, unknown>;
    expect(body).not.toHaveProperty("useDefaultPipeline");
    expect(body).not.toHaveProperty("pipelineIdentifier");
  });

  it("rejects when both branch fields are set", () => {
    expect(() =>
      buildBody({
        schema_id: "s",
        instance_id: "i",
        conversation_id: "c",
        changeset: "cs",
        use_default_pipeline: true,
        pipeline_identifier: "my-pipe",
      }),
    ).toThrow(/mutually exclusive/);
  });
});
