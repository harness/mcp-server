import type { Registry } from "../registry/index.js";
import type { ResourceScope } from "../registry/types.js";
import type { SearchResult } from "./types.js";
import { asString } from "../utils/type-guards.js";

interface EntityScope {
  scope: ResourceScope;
  orgId?: string;
  projectId?: string;
}

function isResourceScope(value: unknown): value is ResourceScope {
  return value === "account" || value === "org" || value === "project";
}

function encodeIdPart(value: string | undefined): string {
  return encodeURIComponent(value ?? "");
}

function needsOrg(scope: ResourceScope): boolean {
  return scope === "org" || scope === "project";
}

function needsProject(scope: ResourceScope): boolean {
  return scope === "project";
}

function explicitOrDefault(value: unknown, fallback: string | undefined): string | undefined {
  return asString(value) ?? fallback;
}

export function resolveEntityScope(
  registry: Registry,
  resourceType: string,
  input: Record<string, unknown>,
): EntityScope {
  const def = registry.getResource(resourceType);
  const requestedScope = isResourceScope(input.resource_scope) ? input.resource_scope : undefined;
  const scope = requestedScope ?? def.scope;

  if (requestedScope) {
    return {
      scope,
      ...(needsOrg(scope) ? { orgId: explicitOrDefault(input.org_id, registry.orgId) } : {}),
      ...(needsProject(scope) ? { projectId: explicitOrDefault(input.project_id, registry.projectId) } : {}),
    };
  }

  if (def.scopeOptional) {
    return {
      scope,
      ...(input.org_id ? { orgId: asString(input.org_id) } : {}),
      ...(input.project_id ? { projectId: asString(input.project_id) } : {}),
    };
  }

  return {
    scope,
    ...(needsOrg(scope) ? { orgId: explicitOrDefault(input.org_id, registry.orgId) } : {}),
    ...(needsProject(scope) ? { projectId: explicitOrDefault(input.project_id, registry.projectId) } : {}),
  };
}

export function buildEntityDocumentId(
  accountId: string | undefined,
  resourceType: string,
  identifier: string,
  entityScope: EntityScope,
): string {
  return [
    "entity",
    encodeIdPart(accountId),
    entityScope.scope,
    encodeIdPart(entityScope.orgId),
    encodeIdPart(entityScope.projectId),
    encodeIdPart(resourceType),
    encodeIdPart(identifier),
  ].join(":");
}

export function buildEntityMetadata(
  resourceType: string,
  identifier: string,
  name: string,
  entityScope: EntityScope,
): Record<string, string> {
  return {
    resource_type: resourceType,
    identifier,
    name,
    scope: entityScope.scope,
    ...(entityScope.orgId ? { org_id: entityScope.orgId } : {}),
    ...(entityScope.projectId ? { project_id: entityScope.projectId } : {}),
  };
}

export function entityResultMatchesEffectiveScope(
  result: SearchResult,
  registry: Registry,
  input: Record<string, unknown>,
): boolean {
  if (result.corpus !== "entities") {
    return true;
  }

  const resourceType = result.metadata.resource_type;
  if (!resourceType) {
    return false;
  }

  let entityScope: EntityScope;
  try {
    entityScope = resolveEntityScope(registry, resourceType, input);
  } catch {
    return false;
  }

  if (result.metadata.scope !== entityScope.scope) {
    return false;
  }
  if (needsOrg(entityScope.scope) && result.metadata.org_id !== entityScope.orgId) {
    return false;
  }
  if (needsProject(entityScope.scope) && result.metadata.project_id !== entityScope.projectId) {
    return false;
  }

  return true;
}
