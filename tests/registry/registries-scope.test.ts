import { describe, expect, it } from "vitest";
import { registriesToolset } from "../../src/registry/toolsets/registries.js";
import type { PathBuilderConfig } from "../../src/registry/types.js";

const config: PathBuilderConfig = {
  HARNESS_ACCOUNT_ID: "acct1",
  HARNESS_ORG: "cfg-org",
  HARNESS_PROJECT: "cfg-proj",
};

function def(resourceType: string) {
  const d = registriesToolset.resources.find((r) => r.resourceType === resourceType);
  if (!d) throw new Error(`missing ${resourceType}`);
  return d;
}

describe("registries scope", () => {
  it.each(["registry", "artifact", "artifact_version", "artifact_file"])(
    "%s supports account/org/project scope",
    (rt) => {
      expect(def(rt).supportedScopes).toEqual(["account", "org", "project"]);
    },
  );

  it("lists registries at account scope without org/project segments", () => {
    const p = def("registry").operations.list!.pathBuilder!({ resource_scope: "account" }, config);
    expect(p).toBe("/har/api/v1/spaces/acct1/+/registries");
  });

  it("lists artifacts of an account-level registry", () => {
    const p = def("artifact").operations.list!.pathBuilder!(
      { resource_scope: "account", registry_id: "acct-docker-prod" },
      config,
    );
    expect(p).toBe("/har/api/v1/registry/acct1/acct-docker-prod/+/artifacts");
  });

  it("lists artifact versions at account scope", () => {
    const p = def("artifact_version").operations.list!.pathBuilder!(
      { resource_scope: "account", registry_id: "acct-docker-prod", artifact_id: "ccm-worker" },
      config,
    );
    expect(p).toBe("/har/api/v1/registry/acct1/acct-docker-prod/+/artifact/ccm-worker/+/versions");
  });

  it("uses account/org only at org scope, ignoring config project", () => {
    const p = def("artifact").operations.list!.pathBuilder!(
      { resource_scope: "org", org_id: "PROD", registry_id: "r" },
      config,
    );
    expect(p).toBe("/har/api/v1/registry/acct1/PROD/r/+/artifacts");
  });

  it("keeps project behaviour when resource_scope is omitted", () => {
    const p = def("artifact").operations.list!.pathBuilder!(
      { org_id: "PROD", project_id: "CCM", registry_id: "r" },
      config,
    );
    expect(p).toBe("/har/api/v1/registry/acct1/PROD/CCM/r/+/artifacts");
  });
});
