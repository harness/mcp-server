import { describe, it, expect } from "vitest";
import { dbopsToolset } from "../../../src/registry/toolsets/dbops.js";
import { listOutputSchema } from "../../../src/tools/output-schemas.js";

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
  it("hits the v1 llm-authoring/execute-pipeline path", () => {
    expect(runAction.method).toBe("POST");
    expect(runAction.path).toBe(
      "/v1/orgs/{org}/projects/{project}/llm-authoring/execute-pipeline",
    );
  });

  it("description opens with Accept & Commit workflow framing", () => {
    expect(executeResource.description).toMatch(
      /^Consolidated endpoint for the LLM change authoring Accept & Commit flow\./,
    );
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

  it("throws when both use_default_pipeline and pipeline_identifier are set", () => {
    expect(() =>
      buildBody({
        schema_id: "s",
        instance_id: "i",
        conversation_id: "c",
        changeset: "cs",
        use_default_pipeline: true,
        pipeline_identifier: "my-pipe",
      }),
    ).toThrow("Exactly one of use_default_pipeline or pipeline_identifier must be set, not both.");
  });

  it("omits both branch fields when neither use_default_pipeline nor pipeline_identifier is set", () => {
    const body = buildBody({
      schema_id: "s",
      instance_id: "i",
      conversation_id: "c",
      changeset: "cs",
    }) as Record<string, unknown>;
    // Server rejects the request; client-side we just forward common fields with no branch key.
    // This documents "no implicit default" behaviour — the server, not the client, is the guard.
    expect(body).not.toHaveProperty("useDefaultPipeline");
    expect(body).not.toHaveProperty("pipelineIdentifier");
    expect(body).toMatchObject({ schemaId: "s", instanceId: "i", conversationId: "c", changeset: "cs" });
  });

  it("run action uses low_write risk (intentional — billing side-effect is scoped to the Accept & Commit flow)", () => {
    expect(runAction.operationPolicy?.risk).toBe("low_write");
  });

  it("documents the correct NG setting key for the custom-pipeline branch (not the retired _id suffix)", () => {
    const pipelineIdField = runAction.bodySchema?.fields?.find(
      (f) => f.name === "pipelineIdentifier",
    );
    expect(pipelineIdField?.description).toContain("`dbops_llm_authoring_pipeline`");
    expect(pipelineIdField?.description).not.toContain("dbops_llm_authoring_pipeline_id");
    expect(executeResource.description).toContain("`dbops_llm_authoring_pipeline`");
    expect(executeResource.description).not.toContain("dbops_llm_authoring_pipeline_id");
  });
});

describe("listOutputSchema primitive widening", () => {
  it("accepts a string[] response from the snapshot-names API (regression: items were object-only)", () => {
    const result = listOutputSchema.safeParse({ items: ["table_a", "table_b"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual(["table_a", "table_b"]);
    }
  });

  it("still accepts the normal object[] shape", () => {
    const result = listOutputSchema.safeParse({ items: [{ id: "1", name: "foo" }], total: 1, page: 0 });
    expect(result.success).toBe(true);
  });
});
