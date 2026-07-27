/**
 * Infrastructure toolset wiring — ensure create/update bodyBuilders synthesize
 * non-empty yaml (NG contract) and pick up tool-level org_id/project_id before
 * yaml synthesis so scope fields appear inside body.yaml.
 */
import { describe, it, expect } from "vitest";
import { infrastructureToolset } from "../../src/registry/toolsets/infrastructure.js";

const infra = infrastructureToolset.resources.find((r) => r.resourceType === "infrastructure");
if (!infra) throw new Error("infrastructure resource missing from toolset");

describe("infrastructure create bodyBuilder", () => {
  const build = infra.operations.create!.bodyBuilder!;

  it("synthesizes non-empty yaml from flat body without yaml", () => {
    const result = build({
      body: {
        identifier: "k8s_staging_infra",
        name: "K8s Staging Infrastructure",
        type: "KubernetesDirect",
        environmentRef: "staging",
        deploymentType: "Kubernetes",
        spec: { connectorRef: "account.k8s", namespace: "default" },
      },
    }) as Record<string, unknown>;

    expect(typeof result.yaml).toBe("string");
    expect((result.yaml as string).trim().length).toBeGreaterThan(0);
    expect(result.yaml as string).toContain("infrastructureDefinition:");
    expect(result.identifier).toBe("k8s_staging_infra");
  });

  it("injects org_id/project_id into body and synthesized yaml", () => {
    const result = build({
      org_id: "default",
      project_id: "cxe_sandbox",
      body: {
        identifier: "k8s_staging_infra",
        name: "K8s Staging Infrastructure",
        type: "KubernetesDirect",
        environmentRef: "staging",
      },
    }) as Record<string, unknown>;

    expect(result.orgIdentifier).toBe("default");
    expect(result.projectIdentifier).toBe("cxe_sandbox");
    expect(result.yaml as string).toContain("orgIdentifier: default");
    expect(result.yaml as string).toContain("projectIdentifier: cxe_sandbox");
  });

  it("preserves explicit body.yaml", () => {
    const yaml =
      "infrastructureDefinition:\n  identifier: k8s_staging_infra\n  name: Explicit\n";
    const result = build({
      body: {
        identifier: "k8s_staging_infra",
        name: "Explicit",
        type: "KubernetesDirect",
        environmentRef: "staging",
        yaml,
      },
    }) as Record<string, unknown>;

    expect(result.yaml).toBe(yaml);
  });
});

describe("infrastructure update bodyBuilder", () => {
  const build = infra.operations.update!.bodyBuilder!;

  it("injects infrastructure_id as identifier and synthesizes yaml", () => {
    const result = build({
      infrastructure_id: "k8s_staging_infra",
      org_id: "default",
      project_id: "cxe_sandbox",
      body: {
        name: "Updated Infra",
        type: "KubernetesDirect",
        environmentRef: "staging",
      },
    }) as Record<string, unknown>;

    expect(result.identifier).toBe("k8s_staging_infra");
    expect(typeof result.yaml).toBe("string");
    expect(result.yaml as string).toContain("identifier: k8s_staging_infra");
    expect(result.yaml as string).toContain("orgIdentifier: default");
  });
});
