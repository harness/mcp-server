import { describe, it, expect } from "vitest";
import type { Registry } from "../../src/registry/index.js";
import type { ResourceScope } from "../../src/registry/types.js";
import type { SearchResult } from "../../src/search/types.js";
import {
  resolveEntityScope,
  buildEntityDocumentId,
  buildEntityMetadata,
  entityResultMatchesEffectiveScope,
} from "../../src/search/entity-index.js";

function makeRegistry(overrides: {
  scope?: ResourceScope;
  scopeOptional?: boolean;
  orgId?: string;
  projectId?: string;
  throwOnGetResource?: boolean;
} = {}): Registry {
  return {
    getResource: () => {
      if (overrides.throwOnGetResource) {
        throw new Error("unknown resource");
      }
      return {
        scope: overrides.scope ?? "project",
        scopeOptional: overrides.scopeOptional ?? false,
      };
    },
    get orgId() {
      return overrides.orgId ?? "default-org";
    },
    get projectId() {
      return overrides.projectId ?? "default-project";
    },
  } as unknown as Registry;
}

function makeEntityResult(metadata: Record<string, string>, overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: overrides.id ?? "entity:test",
    content: "pipeline deploy",
    score: 0.9,
    corpus: overrides.corpus ?? "entities",
    metadata,
    ...overrides,
  };
}

describe("resolveEntityScope", () => {
  it("uses registry defaults for fixed project-scoped resources", () => {
    const registry = makeRegistry({ scope: "project" });

    expect(resolveEntityScope(registry, "pipeline", {})).toEqual({
      scope: "project",
      orgId: "default-org",
      projectId: "default-project",
    });
  });

  it("honors explicit org_id and project_id for fixed project-scoped resources", () => {
    const registry = makeRegistry({ scope: "project" });

    expect(resolveEntityScope(registry, "pipeline", {
      org_id: "org-a",
      project_id: "project-a",
    })).toEqual({
      scope: "project",
      orgId: "org-a",
      projectId: "project-a",
    });
  });

  it("uses requested resource_scope with registry fallbacks for missing org/project", () => {
    const registry = makeRegistry({ scope: "account", orgId: "fallback-org", projectId: "fallback-project" });

    expect(resolveEntityScope(registry, "template", {
      resource_scope: "project",
      org_id: "org-a",
    })).toEqual({
      scope: "project",
      orgId: "org-a",
      projectId: "fallback-project",
    });
  });

  it("omits org and project for account scope even when input carries them", () => {
    const registry = makeRegistry({ scope: "project" });

    expect(resolveEntityScope(registry, "secret", {
      resource_scope: "account",
      org_id: "org-a",
      project_id: "project-a",
    })).toEqual({ scope: "account" });
  });

  it("includes org but not project for org-scoped resources", () => {
    const registry = makeRegistry({ scope: "project" });

    expect(resolveEntityScope(registry, "project", {
      resource_scope: "org",
      org_id: "org-only",
      project_id: "ignored-project",
    })).toEqual({
      scope: "org",
      orgId: "org-only",
    });
  });

  it("only attaches explicit org/project for scopeOptional resources", () => {
    const registry = makeRegistry({ scope: "project", scopeOptional: true });

    expect(resolveEntityScope(registry, "gitops_application", {})).toEqual({
      scope: "project",
    });
    expect(resolveEntityScope(registry, "gitops_application", {
      org_id: "org-a",
      project_id: "project-a",
    })).toEqual({
      scope: "project",
      orgId: "org-a",
      projectId: "project-a",
    });
  });
});

describe("buildEntityDocumentId", () => {
  it("encodes account, scope, org, project, type, and identifier into a stable key", () => {
    const id = buildEntityDocumentId("acct-1", "pipeline", "deploy", {
      scope: "project",
      orgId: "org-a",
      projectId: "project-a",
    });

    expect(id).toBe("entity:acct-1:project:org-a:project-a:pipeline:deploy");
  });

  it("URL-encodes identifier parts that contain reserved delimiters", () => {
    const id = buildEntityDocumentId("acct/1", "pipeline", "stage:deploy", {
      scope: "project",
      orgId: "org/a",
      projectId: "project:a",
    });

    expect(id).toBe(
      "entity:acct%2F1:project:org%2Fa:project%3Aa:pipeline:stage%3Adeploy",
    );
  });

  it("uses empty encoded segments for account-scoped resources", () => {
    const id = buildEntityDocumentId("acct-1", "secret", "global-secret", {
      scope: "account",
    });

    expect(id).toBe("entity:acct-1:account:::secret:global-secret");
  });
});

describe("buildEntityMetadata", () => {
  it("includes scope-qualified metadata for project resources", () => {
    expect(buildEntityMetadata("pipeline", "deploy", "Deploy", {
      scope: "project",
      orgId: "org-a",
      projectId: "project-a",
    })).toEqual({
      resource_type: "pipeline",
      identifier: "deploy",
      name: "Deploy",
      scope: "project",
      org_id: "org-a",
      project_id: "project-a",
    });
  });

  it("omits org_id and project_id for account-scoped metadata", () => {
    expect(buildEntityMetadata("secret", "global", "Global Secret", {
      scope: "account",
    })).toEqual({
      resource_type: "secret",
      identifier: "global",
      name: "Global Secret",
      scope: "account",
    });
  });
});

describe("entityResultMatchesEffectiveScope", () => {
  it("passes through non-entity corpus results", () => {
    const registry = makeRegistry();
    const result = makeEntityResult({ resource_type: "pipeline" }, { corpus: "knowledge" });

    expect(entityResultMatchesEffectiveScope(result, registry, {})).toBe(true);
  });

  it("rejects entity hits missing resource_type metadata", () => {
    const registry = makeRegistry();

    expect(entityResultMatchesEffectiveScope(
      makeEntityResult({ identifier: "deploy" }),
      registry,
      {},
    )).toBe(false);
  });

  it("accepts entity hits that match the effective requested scope", () => {
    const registry = makeRegistry({ scope: "project" });
    const result = makeEntityResult({
      resource_type: "pipeline",
      scope: "project",
      org_id: "org-a",
      project_id: "project-a",
    });

    expect(entityResultMatchesEffectiveScope(result, registry, {
      org_id: "org-a",
      project_id: "project-a",
    })).toBe(true);
  });

  it("rejects entity hits from a different project than the effective scope", () => {
    const registry = makeRegistry({ scope: "project", orgId: "org-a", projectId: "project-a" });
    const result = makeEntityResult({
      resource_type: "pipeline",
      scope: "project",
      org_id: "org-b",
      project_id: "project-b",
    });

    expect(entityResultMatchesEffectiveScope(result, registry, {})).toBe(false);
  });

  it("rejects entity hits when scope metadata does not match", () => {
    const registry = makeRegistry({ scope: "project" });
    const result = makeEntityResult({
      resource_type: "pipeline",
      scope: "account",
    });

    expect(entityResultMatchesEffectiveScope(result, registry, {
      resource_scope: "project",
      org_id: "org-a",
      project_id: "project-a",
    })).toBe(false);
  });

  it("returns false when scope resolution fails", () => {
    const registry = makeRegistry({ throwOnGetResource: true });
    const result = makeEntityResult({
      resource_type: "pipeline",
      scope: "project",
      org_id: "org-a",
      project_id: "project-a",
    });

    expect(entityResultMatchesEffectiveScope(result, registry, {})).toBe(false);
  });
});
