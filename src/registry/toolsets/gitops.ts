import type { ToolsetDefinition } from "../types.js";
import { passthrough, ngExtract, pageExtract } from "../extractors.js";

function gitopsListBody(
  input: Record<string, unknown>,
  extras?: Record<string, unknown>,
) {
  return {
    pageIndex: typeof input.page === "number" ? input.page : 0,
    pageSize: typeof input.size === "number" ? input.size : 20,
    searchTerm: (input.search_term as string) ?? "",
    ...extras,
  };
}

/**
 * Build bulk operation targets from input.
 * Single app: resource_id (agent_id) + params.app_name
 * Multiple apps: body.targets [{agent_id, app_name}, ...]
 */
function buildBulkTargets(
  input: Record<string, unknown>,
  actionName: string,
): Array<{ applicationName: string; agentIdentifier: string }> {
  const body = (input.body ?? {}) as Record<string, unknown>;
  const targets: Array<{ applicationName: string; agentIdentifier: string }> = [];

  if (Array.isArray(body.targets)) {
    for (const t of body.targets as Array<Record<string, unknown>>) {
      if (!t.agent_id || !t.app_name) {
        throw new Error(`Each target must have agent_id and app_name. Got: ${JSON.stringify(t)}`);
      }
      targets.push({
        applicationName: String(t.app_name),
        agentIdentifier: String(t.agent_id),
      });
    }
  } else if (input.agent_id && input.app_name) {
    targets.push({
      applicationName: String(input.app_name),
      agentIdentifier: String(input.agent_id),
    });
  }

  if (targets.length === 0) {
    throw new Error(
      `${actionName} requires at least one target. ` +
      `Single app: resource_id='<agent_id>' + params.app_name='<name>'. ` +
      `Multiple apps: body.targets=[{agent_id:'...', app_name:'...'}, ...].`,
    );
  }

  return targets;
}

export const gitopsToolset: ToolsetDefinition = {
  name: "gitops",
  displayName: "GitOps",
  description:
    "Harness GitOps — agents, applications, clusters, and repositories",
  resources: [
    {
      resourceType: "gitops_agent",
      displayName: "GitOps Agent",
      description:
        "GitOps agent (Argo CD instance). Agents can be scoped at account, org, or project level.\n" +
        "SCOPE BEHAVIOR:\n" +
        "- Account-level: Do NOT pass org_id or project_id\n" +
        "- Org-level: Pass org_id only (no project_id)\n" +
        "- Project-level: Pass both org_id AND project_id\n" +
        "IDENTIFIERS: agent_id is the raw identifier (e.g. 'myagent', NOT 'account.myagent').",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["agent_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter GitOps agents by name or keyword" },
        { name: "type", description: "Agent type filter", enum: ["MANAGED_ARGO_PROVIDER", "HOSTED_ARGO_PROVIDER"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/agents/{agentIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents",
          queryParams: {
            search_term: "searchTerm",
            type: "type",
            page: "page",
            size: "size",
          },
          responseExtractor: passthrough,
          description: "List GitOps agents",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}",
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          description: "Get GitOps agent details",
        },
      },
    },
    {
      resourceType: "gitops_application",
      displayName: "GitOps Application",
      description:
        "GitOps application managed by an agent. List returns all apps (no agent required). Get/sync require agent_id.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      diagnosticHint: "Use harness_diagnose with resource_type='gitops_application', agent_id, and resource_id (app name) to analyze sync failures, health issues, and unhealthy K8s resources. Combines app status, resource tree, and recent events.",
      executeHint: "SYNC: harness_execute(action='sync') for single app, action='bulk_sync' for multiple. REFRESH: action='refresh' (normal or hard). RESOURCE ACTIONS (restart, pause, etc.): 1) harness_get resource_type='gitops_app_resource_tree' to discover K8s resources, 2) harness_list resource_type='gitops_resource_action' to discover available actions, 3) harness_execute action='run_resource_action'. NOTE: resource_id maps to agent_id in harness_execute but to app_name in harness_get.",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "search_term", description: "Filter GitOps applications by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/applications",
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input, { metadataOnly: true }),
          responseExtractor: passthrough,
          description: "List GitOps applications in the project",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "Get GitOps application details (requires agent_id)",
        },
        create: {
          method: "POST",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications",
          pathParams: {
            agent_id: "agentIdentifier",
          },
          queryParams: {
            cluster_identifier: "clusterIdentifier",
            repo_identifier: "repoIdentifier",
            repo_identifiers: "repoIdentifiers",
            skip_repo_validation: "skipRepoValidation",
          },
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            if (!body.application) {
              throw new Error(
                "body.application is required. Provide the full ArgoCD Application object: " +
                "{ metadata: { name, labels?, annotations? }, spec: { source|sources, destination, syncPolicy? } }. " +
                "Use harness_describe(resource_type='gitops_application') for the full schema.",
              );
            }
            return {
              application: body.application,
              upsert: body.upsert ?? false,
              validate: body.validate ?? true,
            };
          },
          responseExtractor: passthrough,
          description:
            "Create a GitOps application. Body must contain the ArgoCD Application object in native format.\n\n" +
            "EXAMPLE (single-source):\n" +
            "harness_create(resource_type='gitops_application',\n" +
            "  params={agent_id:'account.myagent', cluster_identifier:'account.incluster', skip_repo_validation:'true'},\n" +
            "  body={application:{metadata:{name:'my-app'}, spec:{source:{repoURL:'https://github.com/org/repo', path:'manifests', targetRevision:'HEAD'}, destination:{server:'https://kubernetes.default.svc', namespace:'default'}}}})\n\n" +
            "EXAMPLE (multi-source):\n" +
            "Use spec.sources (array) instead of spec.source. Each source object has: { repoURL, path, targetRevision, chart, helm, ref, name }.\n\n" +
            "REQUIRED params:\n" +
            "  agent_id — scope-prefixed agent identifier (e.g. 'account.myagent'). NOTE: harness_create has no resource_id — pass agent_id inside params.\n" +
            "  cluster_identifier — scope-prefixed cluster ID (e.g. 'account.incluster')\n" +
            "  repo_identifier or repo_identifiers — scope-prefixed repo IDs, OR skip_repo_validation=true\n\n" +
            "SCOPE PREFIXES: 'account.' for account-level, 'org.' for org-level, no prefix for project-level.\n\n" +
            "DO NOT set spec.project — Harness auto-maps it.\n\n" +
            "LINKING SERVICE/ENVIRONMENT: Set labels 'harness.io/serviceRef' and 'harness.io/envRef' in metadata.labels. Values are scope-prefixed: 'account.myservice' for account-level, 'org.myservice' for org-level, 'myservice' for project-level.",
          bodySchema: {
            description:
              "Body must contain 'application' with the full ArgoCD Application object. Uses native ArgoCD camelCase field names.",
            fields: [
              {
                name: "application", type: "object", required: true,
                description:
                  "ArgoCD Application object. Structure:\n" +
                  "{ metadata: { name (required), labels?, annotations? },\n" +
                  "  spec: {\n" +
                  "    source: { repoURL, path, targetRevision ('HEAD' default), chart?, helm?, kustomize?, directory?, plugin? },\n" +
                  "    OR sources: [{ repoURL, path, targetRevision, chart, helm, ref, name }, ...] for multi-source,\n" +
                  "    destination: { server OR name, namespace },\n" +
                  "    syncPolicy?: { automated?: { prune, selfHeal }, syncOptions?: string[] }\n" +
                  "  }\n" +
                  "}.\n" +
                  "Do NOT set spec.project (Harness auto-maps it).",
              },
              { name: "upsert", type: "boolean", required: false, description: "If true, update existing app instead of failing on duplicate (default: false)." },
              { name: "validate", type: "boolean", required: false, description: "Validate spec before creating (default: true)." },
            ],
          },
        },
        update: {
          method: "PUT",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          queryParams: {
            cluster_identifier: "clusterIdentifier",
            repo_identifier: "repoIdentifier",
            repo_identifiers: "repoIdentifiers",
            skip_repo_validation: "skipRepoValidation",
          },
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            if (!body.application) {
              throw new Error(
                "body.application is required. Provide the full ArgoCD Application object. " +
                "RECOMMENDED: harness_get the current app first, modify fields, then pass the full object.",
              );
            }
            return {
              application: body.application,
              validate: body.validate ?? true,
            };
          },
          responseExtractor: passthrough,
          description:
            "Update a GitOps application. This is a full PUT replace — provide the complete desired state.\n" +
            "RECOMMENDED FLOW: First harness_get the current app, modify the fields you need, then pass the full application object.\n" +
            "IMPORTANT: resource_id must be the agent_id (scope-prefixed), and app_name goes in params.\n" +
            "Example: harness_update(resource_type='gitops_application', resource_id='account.myagent', params={app_name:'my-app', cluster_identifier:'account.incluster', skip_repo_validation:'true'}, body={application:{...}})\n" +
            "SCOPE PREFIXES: 'account.' for account-level, 'org.' for org-level, no prefix for project-level.\n" +
            "REPO VALIDATION: Set repo_identifier or skip_repo_validation=true in params.\n" +
            "LINKING SERVICE/ENVIRONMENT: Set labels 'harness.io/serviceRef' and 'harness.io/envRef' in metadata.labels. Values are scope-prefixed.",
          bodySchema: {
            description:
              "Body must contain 'application' with the full ArgoCD Application object. Uses native ArgoCD camelCase field names.\n" +
              "Query params via 'params': app_name (path), cluster_identifier, repo_identifier/repo_identifiers, skip_repo_validation.",
            fields: [
              {
                name: "application", type: "object", required: true,
                description:
                  "Full ArgoCD Application object: { metadata: { name, labels?, annotations? }, spec: { source|sources, destination, syncPolicy? } }.\n" +
                  "Get the current app first with harness_get, modify what you need, pass the whole object back. Do NOT set spec.project (Harness auto-maps it).",
              },
              { name: "validate", type: "boolean", required: false, description: "Validate spec before applying (default: true)." },
            ],
          },
        },
      },
      executeActions: {
        sync: {
          method: "POST",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/sync",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          actionDescription: "Sync a GitOps application",
          bodySchema: {
            description: "Sync options",
            fields: [
              { name: "prune", type: "boolean", required: false, description: "Prune resources not in git" },
              { name: "dryRun", type: "boolean", required: false, description: "Simulate sync without executing" },
              { name: "revision", type: "string", required: false, description: "Target revision to sync to" },
            ],
          },
        },
        refresh: {
          method: "POST",
          path: "/gitops/api/v1/applications/bulk/refresh",
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            return {
              applicationTargets: buildBulkTargets(input, "Refresh"),
              refresh: body.refresh ?? "normal",
            };
          },
          responseExtractor: passthrough,
          actionDescription:
            "Refresh one or more GitOps applications. Normal refresh checks if source changed; hard refresh forces full manifest regeneration.\n\n" +
            "SINGLE APP: harness_execute(resource_type='gitops_application', action='refresh', resource_id='account.myagent', params={app_name:'my-app'}, body={refresh:'hard'})\n\n" +
            "MULTIPLE APPS: harness_execute(resource_type='gitops_application', action='refresh', body={targets:[{agent_id:'account.myagent', app_name:'app1'}, {agent_id:'account.myagent', app_name:'app2'}], refresh:'hard'})\n\n" +
            "NOTE: resource_id maps to agent_id (scope-prefixed). For apps across different agents, use body.targets.",
          bodySchema: {
            description:
              "Refresh body. Single app: use resource_id + params.app_name. Multiple apps: use body.targets.",
            fields: [
              { name: "refresh", type: "string", required: false, description: "Refresh mode: 'normal' (only if source changed) or 'hard' (force full manifest regeneration). Default: 'normal'." },
              { name: "targets", type: "array", required: false, description: "Array of targets for multi-app refresh: [{agent_id: 'account.myagent', app_name: 'my-app'}, ...]. Agent IDs are scope-prefixed." },
            ],
          },
        },
        bulk_sync: {
          method: "POST",
          path: "/gitops/api/v1/applications/bulk/sync",
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            const targets = buildBulkTargets(input, "Bulk sync");

            const result: Record<string, unknown> = { applicationTargets: targets };

            if (body.dryRun !== undefined) result.dryRun = body.dryRun;
            if (body.prune !== undefined) result.prune = body.prune;
            if (body.strategy) result.strategy = body.strategy;
            if (body.retryStrategy) result.retryStrategy = body.retryStrategy;

            if (body.syncOptions) {
              const opts = body.syncOptions;
              result.syncOptions = Array.isArray(opts) ? { items: opts } : opts;
            }

            return result;
          },
          responseExtractor: passthrough,
          actionDescription:
            "Sync one or more GitOps applications to their target state. Applies the same sync settings to all targeted apps.\n\n" +
            "SINGLE APP: harness_execute(resource_type='gitops_application', action='bulk_sync', resource_id='account.myagent', params={app_name:'my-app'}, body={prune:true})\n" +
            "For single-app sync you can also use action='sync' which takes agent_id and app_name directly.\n\n" +
            "MULTIPLE APPS: harness_execute(resource_type='gitops_application', action='bulk_sync', body={targets:[{agent_id:'account.myagent', app_name:'app1'}, {agent_id:'account.myagent', app_name:'app2'}], prune:true})\n\n" +
            "NOTE: resource_id maps to agent_id (scope-prefixed). For apps across different agents, use body.targets.",
          bodySchema: {
            description:
              "Bulk sync body. Single app: use resource_id + params.app_name. Multiple apps: use body.targets. Sync settings apply to all targets.",
            fields: [
              { name: "targets", type: "array", required: false, description: "Array of targets: [{agent_id: 'account.myagent', app_name: 'my-app'}, ...]. Agent IDs are scope-prefixed." },
              { name: "dryRun", type: "boolean", required: false, description: "Simulate sync without applying changes (default: false)." },
              { name: "prune", type: "boolean", required: false, description: "Delete resources from cluster that are not in git (default: false)." },
              { name: "strategy", type: "object", required: false, description: "Sync strategy: {apply?: {force: bool}} for kubectl apply, or {hook?: {force: bool}} for hook-based sync (default)." },
              { name: "retryStrategy", type: "object", required: false, description: "Retry on failure: {limit: number, backoff?: {duration: string, factor: number, maxDuration: string}}." },
              { name: "syncOptions", type: "array", required: false, description: "Sync option strings, e.g. ['CreateNamespace=true', 'PruneLast=true', 'ApplyOutOfSyncOnly=true']." },
            ],
          },
        },
        cancel_operation: {
          method: "DELETE",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/operation",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          bodyBuilder: () => undefined,
          responseExtractor: passthrough,
          actionDescription:
            "Cancel the currently running sync or rollback operation on a GitOps application.\n\n" +
            "Example: harness_execute(resource_type='gitops_application', action='cancel_operation', resource_id='account.myagent', params={app_name:'my-app'})\n\n" +
            "NOTE: resource_id is the agent_id, scope-prefixed: 'account.myagent' for account-level, 'org.myagent' for org-level, 'myagent' for project-level.\n" +
            "This only cancels sync/rollback operations — resource actions (restart, pause, etc.) execute instantly and cannot be cancelled.",
          bodySchema: {
            description: "No body required. The app is identified by resource_id (agent_id) and params.app_name.",
            fields: [],
          },
        },
        run_resource_action: {
          method: "POST",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource/actions",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            const action = body.action;
            const kind = body.kind;
            const resourceName = body.resourceName;
            const namespace = body.namespace;
            if (!action || !kind || !resourceName || !namespace) {
              throw new Error(
                "run_resource_action requires body.namespace, body.resourceName, body.kind, and body.action. " +
                "Use harness_list(resource_type='gitops_resource_action', ...) to discover available actions first.",
              );
            }
            const result: Record<string, unknown> = {
              namespace,
              resourceName,
              kind,
              action,
            };
            if (body.group) result.group = body.group;
            if (body.version) result.version = body.version;
            return result;
          },
          responseExtractor: passthrough,
          actionDescription:
            "Run an action on a specific Kubernetes resource within a GitOps application (e.g. restart a Deployment, pause/resume a Rollout).\n\n" +
            "WORKFLOW:\n" +
            "1. Get the app's resource tree: harness_get(resource_type='gitops_app_resource_tree', resource_id='my-app', params={agent_id:'account.myagent'})\n" +
            "2. Discover available actions: harness_list(resource_type='gitops_resource_action', filters={agent_id:'account.myagent', app_name:'my-app', namespace:'default', kind:'Deployment', resource_name:'my-deploy', group:'apps'})\n" +
            "3. Run the action: harness_execute(resource_type='gitops_application', action='run_resource_action', resource_id='account.myagent', params={app_name:'my-app'}, body={namespace:'default', resourceName:'my-deploy', kind:'Deployment', group:'apps', action:'restart'})\n\n" +
            "SCOPING:\n" +
            "  agent_id — scope-prefixed: 'account.myagent', 'org.myagent', or 'myagent' (project)\n" +
            "  app_name — plain name, NOT scope-prefixed\n" +
            "  body fields (namespace, resourceName, kind, group, action) — plain K8s values, NOT scope-prefixed\n\n" +
            "NOTE: In step 3, resource_id is the agent_id. In step 1, resource_id is the app_name (harness_get maps resource_id to the last identifier field).",
          bodySchema: {
            description:
              "Resource action body. Identifies the K8s resource and the action to perform on it.",
            fields: [
              { name: "namespace", type: "string", required: true, description: "Kubernetes namespace of the target resource." },
              { name: "resourceName", type: "string", required: true, description: "Name of the Kubernetes resource (e.g. 'my-deployment')." },
              { name: "kind", type: "string", required: true, description: "Kubernetes resource kind (e.g. 'Deployment', 'Rollout', 'StatefulSet', 'DaemonSet', 'CronJob')." },
              { name: "group", type: "string", required: false, description: "Kubernetes API group (e.g. 'apps' for Deployments, 'argoproj.io' for Rollouts). Required for most resource kinds." },
              { name: "version", type: "string", required: false, description: "Kubernetes API version (e.g. 'v1', 'v1alpha1'). Usually optional." },
              { name: "action", type: "string", required: true, description: "Action to run (e.g. 'restart', 'pause', 'resume', 'retry', 'abort', 'promote-full'). Use harness_list(resource_type='gitops_resource_action') to discover available actions." },
            ],
          },
        },
      },
    },
    {
      resourceType: "gitops_cluster",
      displayName: "GitOps Cluster",
      description:
        "Kubernetes cluster registered with GitOps. List returns all clusters (no agent required). Get requires agent_id.\n" +
        "SCOPE BEHAVIOR:\n" +
        "- Account-level: Do NOT pass org_id or project_id\n" +
        "- Org-level: Pass org_id only (no project_id)\n" +
        "- Project-level: Pass both org_id AND project_id\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)\n" +
        "cluster_id is the raw identifier (e.g. 'incluster'), not prefixed.",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["agent_id", "cluster_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter clusters by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/clusters",
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/clusters",
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input),
          responseExtractor: passthrough,
          description: "List GitOps clusters (scope depends on org_id/project_id presence)",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/clusters/{clusterIdentifier}",
          pathParams: {
            agent_id: "agentIdentifier",
            cluster_id: "clusterIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get GitOps cluster details (requires agent_id)",
        },
      },
    },
    {
      resourceType: "gitops_repository",
      displayName: "GitOps Repository",
      description:
        "Git repository registered with GitOps. List returns all repositories (no agent required). Get requires agent_id.\n" +
        "SCOPE BEHAVIOR:\n" +
        "- Account-level: Do NOT pass org_id or project_id\n" +
        "- Org-level: Pass org_id only (no project_id)\n" +
        "- Project-level: Pass both org_id AND project_id\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)\n" +
        "repo_id is the raw identifier, not prefixed.",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["agent_id", "repo_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter repositories by name or URL" },
        { name: "repo_creds_id", description: "Filter by repository credentials ID" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/repositories",
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input, { repoCredsId: input.repo_creds_id ?? "" }),
          responseExtractor: passthrough,
          description: "List GitOps repositories (scope depends on org_id/project_id presence)",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repositories/{repoIdentifier}",
          pathParams: {
            agent_id: "agentIdentifier",
            repo_id: "repoIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get GitOps repository details (requires agent_id)",
        },
      },
    },
    {
      resourceType: "gitops_applicationset",
      displayName: "GitOps ApplicationSet",
      description:
        "GitOps ApplicationSet for templated application generation. Supports list and get.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "appset_name"],
      listFilterFields: [
        { name: "search_term", description: "Filter ApplicationSets by name or keyword" },
        { name: "agent_id", description: "Optional: Filter by GitOps agent identifier" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/applicationsets",
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input, input.agent_id ? { agentIdentifier: input.agent_id } : {}),
          responseExtractor: passthrough,
          emptyOnErrorPatterns: [/agent is not registered/, /never connected/, /Not Implemented/],
          description: "List GitOps ApplicationSets",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/applicationset/{identifier}",
          pathParams: {
            appset_name: "identifier",
          },
          queryParams: {
            agent_id: "agentIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get GitOps ApplicationSet details",
        },
      },
    },
    {
      resourceType: "gitops_repo_credential",
      displayName: "GitOps Repository Credential",
      description:
        "Repository credentials for GitOps agent. Supports list and get.\n" +
        "SCOPE BEHAVIOR:\n" +
        "- Account-level: Do NOT pass org_id or project_id\n" +
        "- Org-level: Pass org_id only (no project_id)\n" +
        "- Project-level: Pass both org_id AND project_id\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["agent_id", "credential_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter repository credentials by name or keyword" },
        { name: "agent_id", description: "Optional: Filter by GitOps agent identifier" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/repocreds",
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input, input.agent_id ? { agentIdentifier: input.agent_id } : {}),
          responseExtractor: passthrough,
          emptyOnErrorPatterns: [/agent is not registered/, /never connected/, /Not Implemented/],
          description: "List GitOps repository credentials",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repocreds/{credentialId}",
          pathParams: {
            agent_id: "agentIdentifier",
            credential_id: "credentialId",
          },
          responseExtractor: passthrough,
          description: "Get GitOps repository credential details",
        },
      },
    },
    {
      resourceType: "gitops_app_event",
      displayName: "GitOps App Event",
      description:
        "Events for a GitOps application. Supports list.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "agent_id", description: "GitOps agent identifier", required: true },
        { name: "app_name", description: "GitOps application name", required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/events",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "List events for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_pod_log",
      displayName: "GitOps Pod Log",
      description:
        "Pod logs for a GitOps application. Supports get with pod_name, namespace, container, tail_lines.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "pod_name", description: "Pod name filter" },
        { name: "namespace", description: "Kubernetes namespace filter" },
        { name: "container", description: "Container name filter" },
        { name: "tail_lines", description: "Number of log lines to tail", type: "number" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/logs",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          queryParams: {
            pod_name: "podName",
            namespace: "namespace",
            container: "container",
            tail_lines: "tailLines",
          },
          responseExtractor: passthrough,
          description: "Get pod logs for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_managed_resource",
      displayName: "GitOps Managed Resource",
      description:
        "Managed Kubernetes resources for a GitOps application. Supports list.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "agent_id", description: "GitOps agent identifier", required: true },
        { name: "app_name", description: "GitOps application name", required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/managed-resources",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "List managed resources for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_resource_action",
      displayName: "GitOps Resource Action",
      description:
        "Available actions for a specific resource in a GitOps application. Supports list with namespace, resource_name, kind.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "namespace", description: "Kubernetes namespace filter" },
        { name: "resource_name", description: "Resource name filter" },
        { name: "kind", description: "Kubernetes resource kind filter" },
        { name: "group", description: "Kubernetes API group filter (e.g. 'apps')" },
        { name: "version", description: "Kubernetes API version filter (e.g. 'v1')" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource/actions",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          queryParams: {
            namespace: "request.namespace",
            resource_name: "request.resourceName",
            kind: "request.kind",
            group: "request.group",
            version: "request.version",
          },
          responseExtractor: passthrough,
          description: "List available actions for a resource in a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_dashboard",
      displayName: "GitOps Dashboard",
      description: "GitOps dashboard overview with summary metrics. Supports get.",
      toolset: "gitops",
      scope: "project",
      identifierFields: [],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops",
      operations: {
        get: {
          method: "GET",
          path: "/gitops/api/v1/dashboard/overview",
          responseExtractor: passthrough,
          description: "Get GitOps dashboard overview with summary metrics",
        },
      },
    },
    {
      resourceType: "gitops_app_resource_tree",
      displayName: "GitOps App Resource Tree",
      description:
        "Kubernetes resource tree for a GitOps application. Supports get.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      operations: {
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource-tree",
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "Get the Kubernetes resource tree for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_cluster_link",
      displayName: "GitOps Cluster-Environment Link",
      description:
        "Link between a GitOps cluster and a Harness Environment. This is a Harness NG API, not a GitOps agent API.\n" +
        "IMPORTANT: Unlike GitOps agent APIs, all identifiers here are RAW (not scope-prefixed). Use 'myagent' not 'account.myagent', 'incluster' not 'account.incluster'.\n" +
        "OPERATIONS: list (requires environment_id), create (link cluster to env), delete (unlink cluster from env).\n" +
        "SCOPE OF THE CLUSTER (the 'scope' field):\n" +
        "- ACCOUNT: cluster registered at account level\n" +
        "- ORGANIZATION: cluster registered at org level\n" +
        "- PROJECT: cluster registered at project level\n" +
        "SCOPE HIERARCHY RULE: Cluster scope must be equal to or wider than environment scope.\n" +
        "  - A PROJECT environment can link ACCOUNT, ORGANIZATION, or PROJECT clusters\n" +
        "  - An ORGANIZATION environment can link ACCOUNT or ORGANIZATION clusters\n" +
        "  - An ACCOUNT environment can only link ACCOUNT clusters",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["cluster_id"],
      diagnosticHint: "If create fails with a scope error, verify the cluster scope is equal to or wider than the environment scope (ACCOUNT > ORGANIZATION > PROJECT). Use harness_list(resource_type='gitops_cluster') to check available clusters and their scopes. All identifiers must be raw (not scope-prefixed).",
      relatedResources: [
        { resourceType: "gitops_cluster", relationship: "linked_cluster", description: "The GitOps cluster being linked to an environment" },
        { resourceType: "environment", relationship: "target_environment", description: "The Harness environment the cluster is linked to" },
      ],
      listFilterFields: [
        { name: "environment_id", description: "Environment identifier (required)", required: true },
        { name: "search_term", description: "Filter clusters by name or keyword" },
        { name: "scope", description: "Filter by cluster scope: ACCOUNT, ORGANIZATION, or PROJECT" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/gitops/clusters",
          queryParams: {
            environment_id: "environmentIdentifier",
            search_term: "searchTerm",
            scope: "scope",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description:
            "List GitOps clusters linked to a Harness environment. Requires environment_id filter.\n\n" +
            "Example: harness_list(resource_type='gitops_cluster_link', filters={environment_id:'my-env'})\n\n" +
            "SCOPING: All filter values are raw, NOT scope-prefixed (e.g. environment_id:'my-env', not 'account.my-env').\n" +
            "NOTE: The response 'name' field is scope-prefixed (e.g. 'account.incluster'). To use it with harness_delete, strip the prefix.",
        },
        create: {
          method: "POST",
          path: "/ng/api/gitops/clusters",
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            const { identifier, envRef, agentIdentifier, scope } = body;
            if (!identifier || !envRef || !agentIdentifier || !scope) {
              throw new Error(
                "gitops_cluster_link create requires body.identifier, body.envRef, body.agentIdentifier, and body.scope (ACCOUNT/ORGANIZATION/PROJECT). " +
                "All identifiers are raw, NOT scope-prefixed. Use harness_list(resource_type='gitops_cluster') to find available clusters and their agent IDs.",
              );
            }
            return { identifier, envRef, agentIdentifier, scope };
          },
          responseExtractor: ngExtract,
          description:
            "Link a GitOps cluster to a Harness environment.\n\n" +
            "Example: harness_create(resource_type='gitops_cluster_link', body={identifier:'incluster', envRef:'my-env', agentIdentifier:'myagent', scope:'ACCOUNT'})\n\n" +
            "SCOPE VALUES: 'ACCOUNT', 'ORGANIZATION', or 'PROJECT' — must match the scope where the cluster is registered in GitOps.\n" +
            "SCOPE RULE: Cluster scope must be equal to or wider than the environment scope.",
          bodySchema: {
            description:
              "Cluster link body. All fields describe the cluster being linked and the target environment.",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Cluster identifier — raw, NOT scope-prefixed (e.g. 'incluster', not 'account.incluster')." },
              { name: "envRef", type: "string", required: true, description: "Environment identifier — raw, NOT scope-prefixed (e.g. 'my-env')." },
              { name: "agentIdentifier", type: "string", required: true, description: "GitOps agent identifier — raw, NOT scope-prefixed (e.g. 'myagent', not 'account.myagent'). Unlike GitOps agent APIs, this NG API takes raw agent IDs." },
              { name: "scope", type: "string", required: true, description: "Scope of the cluster in Harness GitOps: 'ACCOUNT', 'ORGANIZATION', or 'PROJECT'." },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/gitops/clusters/{clusterIdentifier}",
          pathParams: {
            cluster_id: "clusterIdentifier",
          },
          queryParams: {
            environment_id: "environmentIdentifier",
            agent_id: "agentIdentifier",
            scope: "scope",
          },
          responseExtractor: ngExtract,
          description:
            "Unlink a GitOps cluster from a Harness environment.\n\n" +
            "Example: harness_delete(resource_type='gitops_cluster_link', resource_id='incluster', params={environment_id:'my-env', agent_id:'myagent', scope:'ACCOUNT'})\n\n" +
            "IMPORTANT: All identifiers are RAW, NOT scope-prefixed:\n" +
            "- resource_id: raw cluster identifier (e.g. 'incluster', not 'account.incluster'). The list response returns 'name' as scope-prefixed — strip the prefix for delete.\n" +
            "- agent_id: raw agent identifier (e.g. 'myagent', not 'account.myagent').\n" +
            "- environment_id: raw environment identifier.\n" +
            "All three plus scope are required in params.",
        },
      },
    },
  ],
};
