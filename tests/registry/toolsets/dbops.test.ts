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
const createOp = executeResource.operations?.create;
if (!createOp) {
  throw new Error("create operation missing from database_execute_llm_authoring_pipeline resource");
}
const buildBody = runAction.bodyBuilder!;
const extractResponse = runAction.responseExtractor!;

describe("database_execute_llm_authoring_pipeline endpoint spec", () => {
  it("hits the v1 llm-authoring/execute-pipeline path", () => {
    expect(runAction.method).toBe("POST");
    expect(runAction.path).toBe(
      "/v1/orgs/{org}/projects/{project}/llm-authoring/execute-pipeline",
    );
    expect(createOp.path).toBe(runAction.path);
  });

  it("uses low_write risk on run and deprecated create (user consents upstream)", () => {
    // Intentionally below requiresConfirmation: Accept & Commit in the changeset
    // skill already collects user consent; medium_write stacked a second approval card.
    const expected = { risk: "low_write", retryPolicy: "do_not_retry" };
    expect(runAction.operationPolicy).toEqual(expected);
    expect(createOp.operationPolicy).toEqual(expected);
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

  it("accepts legacy schemaIdentifier/instanceIdentifier field names", () => {
    const body = buildBody({
      schemaIdentifier: "legacy-schema",
      instanceIdentifier: "legacy-instance",
      conversation_id: "c",
      changeset: "cs",
    }) as Record<string, unknown>;
    expect(body).toMatchObject({
      schemaId: "legacy-schema",
      instanceId: "legacy-instance",
      useDefaultPipeline: true,
    });
  });

  it("defaults to useDefaultPipeline when no branch field is provided", () => {
    const body = buildBody({
      schema_id: "s",
      instance_id: "i",
      conversation_id: "c",
      changeset: "cs",
    }) as Record<string, unknown>;
    expect(body.useDefaultPipeline).toBe(true);
    expect(body).not.toHaveProperty("pipelineIdentifier");
  });

  it("adds pipelineExecutionId alias on the response", () => {
    const out = extractResponse({
      executionId: "exec-99",
      pipelineIdentifier: "pipe-1",
      openInHarness: "https://app.harness.io/...",
    }) as Record<string, unknown>;
    expect(out.pipelineExecutionId).toBe("exec-99");
    expect(out.executionId).toBe("exec-99");
  });
});
