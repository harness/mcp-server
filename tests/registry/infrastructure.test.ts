/**
 * Infrastructure toolset wiring — ensure create/update bodyBuilders synthesize
 * non-empty yaml (NG contract) and pick up tool-level org_id/project_id before
 * yaml synthesis so scope fields appear inside body.yaml.
 *
 * Deep links open the environment details Infrastructure section
 * (`?sectionId=INFRASTRUCTURE`), not a standalone infra settings page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { infrastructureToolset } from "../../src/registry/toolsets/infrastructure.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

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

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "my_project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const INFRA_DEEP_LINK =
  "https://app.harness.io/ng/account/test-account/all/orgs/default/projects/my_project/settings/environments/my_env/details?sectionId=INFRASTRUCTURE";

describe("infrastructure deep links", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "infrastructure" }));
  });

  it("list: openInHarness is environment details with the Infrastructure section", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        data: {
          content: [
            {
              identifier: "k8s",
              name: "k8s",
              environmentRef: "my_env",
              orgIdentifier: "default",
              projectIdentifier: "my_project",
            },
          ],
          totalElements: 1,
        },
      }),
    );
    const result = (await registry.dispatch(client, "infrastructure", "list", {
      org_id: "default",
      project_id: "my_project",
      environment_id: "my_env",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items[0]!.openInHarness).toBe(INFRA_DEEP_LINK);
  });

  it("get: openInHarness uses environmentRef from the response", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        data: {
          identifier: "k8s",
          name: "k8s",
          environmentRef: "my_env",
          orgIdentifier: "default",
          projectIdentifier: "my_project",
        },
      }),
    );
    const result = (await registry.dispatch(client, "infrastructure", "get", {
      infrastructure_id: "k8s",
      org_id: "default",
      project_id: "my_project",
      environment_id: "my_env",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(INFRA_DEEP_LINK);
  });

  it("create: openInHarness uses environmentRef when environment_id is not a query param", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        data: {
          identifier: "k8s",
          name: "k8s",
          environmentRef: "my_env",
          orgIdentifier: "default",
          projectIdentifier: "my_project",
        },
      }),
    );
    const result = (await registry.dispatch(client, "infrastructure", "create", {
      org_id: "default",
      project_id: "my_project",
      body: {
        identifier: "k8s",
        name: "k8s",
        type: "KubernetesDirect",
        environmentRef: "my_env",
      },
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(INFRA_DEEP_LINK);
  });
});

describe("infrastructure environment_id fail-fast", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "infrastructure" }));
  });

  it("list: throws locally when environment_id is omitted", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "infrastructure", "list", {
        org_id: "default",
        project_id: "my_project",
      }),
    ).rejects.toThrow(/Missing required filter\(s\) for listing infrastructure: environment_id/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("get: throws locally when environment_id is omitted", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "infrastructure", "get", {
        infrastructure_id: "k8s",
        org_id: "default",
        project_id: "my_project",
      }),
    ).rejects.toThrow(/Missing required param\(s\) for infrastructure\.get: environment_id/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("delete: throws locally when environment_id is omitted", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "infrastructure", "delete", {
        infrastructure_id: "k8s",
        org_id: "default",
        project_id: "my_project",
      }),
    ).rejects.toThrow(/Missing required param\(s\) for infrastructure\.delete: environment_id/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("get: sends environmentIdentifier when environment_id is present", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: { identifier: "k8s", environmentRef: "my_env" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "infrastructure", "get", {
      infrastructure_id: "k8s",
      org_id: "default",
      project_id: "my_project",
      environment_id: "my_env",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/ng/api/infrastructures/k8s",
        params: expect.objectContaining({ environmentIdentifier: "my_env" }),
      }),
    );
  });

  it("move_configs: throws locally when environment_id and move_config_type are omitted", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "infrastructure", "move_configs", {
        infrastructure_id: "k8s",
        org_id: "default",
        project_id: "my_project",
      }),
    ).rejects.toThrow(
      /Missing required param\(s\) for infrastructure\.move_configs: environment_id, move_config_type/,
    );
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("move_configs: maps required params from the execute call", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "k8s" } });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "infrastructure", "move_configs", {
      infrastructure_id: "k8s",
      org_id: "default",
      project_id: "my_project",
      environment_id: "my_env",
      move_config_type: "INLINE_TO_REMOTE",
      connector_ref: "git_connector",
      repo_name: "my-repo",
      branch: "main",
      file_path: ".harness/infra.yaml",
      commit_msg: "Move infra to remote",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/ng/api/infrastructures/move-config/k8s",
        params: expect.objectContaining({
          environmentIdentifier: "my_env",
          moveConfigType: "INLINE_TO_REMOTE",
          connectorRef: "git_connector",
          repoName: "my-repo",
          branch: "main",
          filePath: ".harness/infra.yaml",
          commitMsg: "Move infra to remote",
        }),
      }),
    );
  });

  it("describe metadata marks environment_id required on list/get/delete/move_configs", () => {
    const def = registry.getResource("infrastructure");
    expect(def.listFilterFields?.find((f) => f.name === "environment_id")?.required).toBe(true);
    expect(def.operations.get?.paramsSchema?.fields.some((f) => f.name === "environment_id" && f.required)).toBe(
      true,
    );
    expect(def.operations.delete?.paramsSchema?.fields.some((f) => f.name === "environment_id" && f.required)).toBe(
      true,
    );
    expect(
      def.executeActions?.move_configs?.paramsSchema?.fields.some(
        (f) => f.name === "environment_id" && f.required,
      ),
    ).toBe(true);
    expect(
      def.executeActions?.move_configs?.paramsSchema?.fields.some(
        (f) => f.name === "move_config_type" && f.required,
      ),
    ).toBe(true);
    expect(def.executeActions?.move_configs?.bodySchema?.fields.some((f) => f.required)).toBe(false);
  });

  it("move_configs: hoists required fields from body onto query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "k8s" } });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "infrastructure", "move_configs", {
      infrastructure_id: "k8s",
      org_id: "default",
      project_id: "my_project",
      body: {
        environment_id: "my_env",
        move_config_type: "INLINE_TO_REMOTE",
        connector_ref: "git_connector",
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/ng/api/infrastructures/move-config/k8s",
        params: expect.objectContaining({
          environmentIdentifier: "my_env",
          moveConfigType: "INLINE_TO_REMOTE",
          connectorRef: "git_connector",
        }),
      }),
    );
  });
});
