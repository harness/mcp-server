// Auto-generated — do not edit manually. Run `pnpm sync-entity-schemas` to regenerate.
// @ts-nocheck
import connector_account, { meta as meta_connector_account } from "./connector.account.js";
import connector_org, { meta as meta_connector_org } from "./connector.org.js";
import connector_project, { meta as meta_connector_project } from "./connector.project.js";
import environment_account, { meta as meta_environment_account } from "./environment.account.js";
import environment_org, { meta as meta_environment_org } from "./environment.org.js";
import environment_project, { meta as meta_environment_project } from "./environment.project.js";
import service_account, { meta as meta_service_account } from "./service.account.js";
import service_org, { meta as meta_service_org } from "./service.org.js";
import service_project, { meta as meta_service_project } from "./service.project.js";
import secret_account, { meta as meta_secret_account } from "./secret.account.js";
import secret_org, { meta as meta_secret_org } from "./secret.org.js";
import secret_project, { meta as meta_secret_project } from "./secret.project.js";
import infrastructure_account, { meta as meta_infrastructure_account } from "./infrastructure.account.js";
import infrastructure_org, { meta as meta_infrastructure_org } from "./infrastructure.org.js";
import infrastructure_project, { meta as meta_infrastructure_project } from "./infrastructure.project.js";

export const ENTITY_BUNDLED_SCHEMAS: Record<string, Record<string, any>> = {
  "connector.account": connector_account,
  "connector.org": connector_org,
  "connector.project": connector_project,
  "environment.account": environment_account,
  "environment.org": environment_org,
  "environment.project": environment_project,
  "service.account": service_account,
  "service.org": service_org,
  "service.project": service_project,
  "secret.account": secret_account,
  "secret.org": secret_org,
  "secret.project": secret_project,
  "infrastructure.account": infrastructure_account,
  "infrastructure.org": infrastructure_org,
  "infrastructure.project": infrastructure_project,
};

export type EntityBundledMeta = {
  resourceType: string;
  scope: string;
  syncedAt: string;
  accountId: string;
  orgId?: string;
  projectId?: string;
};

export const ENTITY_BUNDLED_META: Record<string, EntityBundledMeta> = {
  "connector.account": meta_connector_account,
  "connector.org": meta_connector_org,
  "connector.project": meta_connector_project,
  "environment.account": meta_environment_account,
  "environment.org": meta_environment_org,
  "environment.project": meta_environment_project,
  "service.account": meta_service_account,
  "service.org": meta_service_org,
  "service.project": meta_service_project,
  "secret.account": meta_secret_account,
  "secret.org": meta_secret_org,
  "secret.project": meta_secret_project,
  "infrastructure.account": meta_infrastructure_account,
  "infrastructure.org": meta_infrastructure_org,
  "infrastructure.project": meta_infrastructure_project,
};

export const ENTITY_BUNDLED_KEYS = Object.keys(ENTITY_BUNDLED_SCHEMAS);
