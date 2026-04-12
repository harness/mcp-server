import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBuildDeployAppPrompt(server: McpServer): void {
  server.registerPrompt(
    "build-deploy-app",
    {
      description: "End-to-end workflow: scan a repo, generate CI/CD pipelines in Harness, build a Docker image, generate K8s manifests, and deploy",
      argsSchema: {
        repoUrl: z.string().describe("Git repository URL (e.g. https://github.com/org/repo)"),
        imageName: z.string().describe("Docker image name including registry (e.g. docker.io/myorg/myapp)"),
        projectId: z.string().describe("Harness project identifier").optional(),
        namespace: z.string().describe("Kubernetes namespace for deployment").optional(),
      },
    },
    async ({ repoUrl, imageName, projectId, namespace }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Build and deploy the application from "${repoUrl}" through Harness CI/CD.

Docker image: ${imageName}
${projectId ? `Project: ${projectId}` : ""}
${namespace ? `K8s namespace: ${namespace}` : "K8s namespace: default"}

IMPORTANT: Follow these steps IN ORDER. Complete each step before moving to the next.
Present the full plan and generated YAML for review before creating anything.

---

## Phase 1: Local Discovery (no MCP tools)

### Step 0 — Clone & verify the repo
- Clone "${repoUrl}" locally (or git pull if already cloned)
- Run \`ls -la\` to inspect the project structure

### Step 1 — Scan for Dockerfile
- Look for a Dockerfile (or Dockerfile.*) in the repo root and subdirectories
- If no Dockerfile exists: analyze the codebase (language, framework, dependencies) and generate an optimized multi-stage Dockerfile. Commit it to the repo.
- If a Dockerfile exists: read it and verify it follows best practices (multi-stage build, non-root user, .dockerignore)

### Step 2 — Analyze the application
- Identify the language/framework, exposed ports, environment variables, and health check endpoints
- Note any databases or external services the app depends on
- This context is needed for K8s manifest generation in Phase 3

### Step 3 — Scan for existing Kubernetes manifests
- Search the repo for existing K8s manifests: look in \`k8s/\`, \`kubernetes/\`, \`deploy/\`, \`manifests/\`, \`helm/\`, \`.k8s/\`, or any \`*.yaml\`/\`*.yml\` files containing \`apiVersion\` and \`kind: Deployment\`
- If manifests exist: note their paths — these will be referenced by the Harness service definition in Phase 3
- If no manifests exist: flag that we need to generate them in Phase 3

---

## Phase 2: CI Pipeline — Build & Push (MCP tools)

### Step 4 — Check existing Harness resources
- Call harness_list with resource_type="connector"${projectId ? ` and project_id="${projectId}"` : ""} to find existing Docker registry and Git connectors
- Call harness_list with resource_type="registry"${projectId ? ` and project_id="${projectId}"` : ""} to discover existing Harness Artifact Registry (HAR) registries
- Call harness_list with resource_type="service"${projectId ? ` and project_id="${projectId}"` : ""} to check if this service already exists
- Call harness_list with resource_type="environment"${projectId ? ` and project_id="${projectId}"` : ""} to see available environments
- Call harness_describe with resource_type="pipeline" to understand the pipeline schema

### Step 5 — Ensure connectors exist
- **Harness Artifact Registry (HAR)**: If the user mentions "Harness Artifact Registry", "HAR", or a HAR registry was found in Step 4 — no Docker connector is needed. Skip Docker connector creation entirely.
- **Third-party registry** (DockerHub, ECR, GCR, ACR, etc.): If no Docker registry connector exists, generate connector YAML and present for review.
- If no Git connector exists for "${repoUrl}": generate a Git connector YAML and present it for review
- Create any missing connectors using harness_create with resource_type="connector" (only after user confirmation)

### Step 6 — Generate CI pipeline YAML
Generate a Harness CI pipeline that:
- Clones "${repoUrl}" using the Git connector
- Builds the Docker image from the Dockerfile found in Step 1
- Tags the image with \`latest\` and \`<+pipeline.sequenceId>\`
- Includes a build test step if the repo has tests (e.g. npm test, go test, pytest)
- Uses a \`BuildAndPushDockerRegistry\` step. CRITICAL: The step spec differs based on the registry type. Use EXACTLY one of the two templates below — do not mix fields between them.

**TEMPLATE A — Harness Artifact Registry (default when user says "Harness Artifact Registry" or "HAR"):**
\`\`\`yaml
- step:
    type: BuildAndPushDockerRegistry
    name: Build and Push to Harness Artifact Registry
    identifier: build_and_push_har
    spec:
      repo: <+input>
      tags:
        - latest
        - <+pipeline.sequenceId>
      caching: true
      registryRef: <+input>
\`\`\`
Key: uses \`registryRef\`. Does NOT have \`connectorRef\`. No Docker connector needed.

**TEMPLATE B — Third-party registry (DockerHub, ECR, GCR, ACR, etc.):**
\`\`\`yaml
- step:
    type: BuildAndPushDockerRegistry
    name: Build and Push Docker Image
    identifier: build_and_push_docker
    spec:
      connectorRef: <+input>
      repo: <+input>
      tags:
        - latest
        - <+pipeline.sequenceId>
      caching: true
\`\`\`
Key: uses \`connectorRef\`. Does NOT have \`registryRef\`.

Present the full pipeline YAML for review. Do NOT create it yet.

### Step 7 — Create & execute CI pipeline (with auto-retry)
- After user confirms the YAML, create it using harness_create with resource_type="pipeline"
- **Discover runtime inputs**: Call harness_get with resource_type="runtime_input_template" and resource_id=<pipeline_id> to see which \`<+input>\` placeholders need values
- **Execute with shorthands**: Call harness_execute with resource_type="pipeline", action="run", resource_id=<pipeline_id>. For CI pipelines, pass the Git branch/tag directly as shorthand inputs:
  - \`inputs: { branch: "main" }\` — auto-expands to the full codebase build structure
  - Other shorthands: \`tag\`, \`pr_number\`, \`commit_sha\` (see harness_describe for details)
  - For remaining \`<+input>\` values, pass them as flat key-value pairs in \`inputs\`
- Monitor progress using harness_status — poll until the execution completes or fails

**CI FAILURE RETRY LOOP (up to 5 attempts):**
If the CI pipeline fails:
1. Call harness_get to retrieve the full execution details and logs
2. Analyze the failure — identify the root cause (build error, test failure, Dockerfile issue, dependency problem, etc.)
3. Fix the issue locally:
   - If it's a code/Dockerfile/config issue: edit the file in the repo, commit, and push the fix
   - If it's a pipeline YAML issue: update the pipeline using harness_update with resource_type="pipeline"
   - If it's a connector/credential issue: flag it to the user with a link to the connector in Harness
4. Re-execute the pipeline using harness_execute
5. Monitor again with harness_status
6. Repeat this loop up to 5 total attempts

If still failing after 5 attempts:
- Summarize all 5 failure reasons and the fixes attempted
- Provide Harness UI deep links to the pipeline and latest execution
- Say: "The CI build has failed 5 times. You may need to manually investigate. Here are links to the resources in Harness:"
- List all created resource links (pipeline, connectors, etc.)

---

## Phase 3: CD Pipeline — K8s Manifests & Deploy (MCP tools + local)

### Step 8 — Prepare Kubernetes manifests
**If manifests were found in Step 3:**
- Read and review the existing manifests
- Verify the image reference can be parameterized for Harness (e.g. \`${imageName}:<+artifact.tag>\`)
- Update the image field if needed, commit and push

**If no manifests were found in Step 3:**
- Generate K8s manifests based on the app analysis from Step 2:
  - **Deployment**: with image "${imageName}:<+artifact.tag>", correct ports, resource requests/limits, liveness/readiness probes, and environment variables
  - **Service**: ClusterIP or LoadBalancer matching the exposed ports
  - **ConfigMap/Secret**: for any environment variables the app needs (secret values as placeholders only)
- Save the manifests in a \`k8s/\` directory in the repo
- Commit and push the manifests to the repo
- Present all manifests for review

### Step 9 — Create Harness service & environment
- Create (or update) a Harness service definition that references the K8s manifests from the repo:
  - Service type: Kubernetes
  - Manifest source: the Git connector from Step 5 pointing to the manifest path in the repo
  - Artifact source: use \`registryRef\` for Harness Artifact Registry or \`connectorRef\` for third-party (same pattern as the BuildAndPush step — never mix both fields)
- Ensure a target environment exists (or create one) for the ${namespace || "default"} namespace
- Present the service and environment YAML for review before creating

### Step 10 — Generate CD pipeline YAML
Generate a Harness CD pipeline that:
- References the service and environment from Step 9
- Uses a Kubernetes deployment type
- Uses a Rolling deployment strategy
- Includes infrastructure definition targeting the ${namespace || "default"} namespace
- Includes a Verify step or health check after deployment

Present the full pipeline YAML for review. Do NOT create it yet.

### Step 11 — Create & execute CD pipeline (with auto-retry)
- After user confirms, create the CD pipeline using harness_create with resource_type="pipeline"
- **Discover runtime inputs**: Call harness_get with resource_type="runtime_input_template" and resource_id=<pipeline_id> to see which \`<+input>\` placeholders need values
- **Execute**: Call harness_execute with resource_type="pipeline", action="run", resource_id=<pipeline_id>, passing any required runtime inputs as flat key-value \`inputs\`
- Monitor with harness_status — poll until the execution completes or fails

**CD FAILURE RETRY LOOP (up to 3 attempts):**
If the CD pipeline fails:
1. Call harness_get to retrieve execution details and deployment logs
2. Analyze the failure — identify root cause (manifest error, image pull failure, resource quota, RBAC, health check timeout, etc.)
3. Determine the fix:
   - If it's a manifest issue: fix the K8s manifests in the repo, commit and push
   - If it's a pipeline/infrastructure issue: update the pipeline using harness_update
   - If it's a Harness configuration issue (connector, delegate, permissions): explain the issue clearly
4. Ask the user for permission to retry: "Deployment failed due to [reason]. I've applied [fix]. May I retry?"
5. On approval, re-execute the pipeline and monitor again
6. Repeat up to 3 total attempts

If still failing after 3 attempts:
- Summarize all failure reasons and fixes attempted
- Provide Harness UI deep links to ALL created resources:
  - CI pipeline + latest execution
  - CD pipeline + latest execution
  - Service definition
  - Environment
  - Connectors
- Say: "The deployment has failed 3 times. You may need to manually update some configuration in Harness. Here are links to all the resources that were created:"
- List every resource with its Harness UI link
- Say: "Once you've resolved the issue in Harness, you can re-run this workflow to try again."

---

### Step 12 — Success: Verify & report
- Confirm the deployment succeeded via harness_status
- Call harness_get to retrieve final execution details
- Display a summary:
  - CI: execution status, image tag pushed, build duration
  - CD: execution status, deployment details, namespace
  - Links: Harness UI links to both pipelines, service, and environment
  - App URL: if determinable from the K8s service (LoadBalancer IP/hostname)

### Step 13 — Optional: Create input sets for reusability
If the pipelines have \`<+input>\` runtime placeholders, offer to create saved input sets so future runs don't require manual input:
- Call harness_get with resource_type="runtime_input_template" and resource_id=<pipeline_id> for each pipeline to identify all placeholders
- Suggest creating input sets (e.g., "dev-inputs", "prod-inputs") that pre-fill common values
- Create using harness_create with resource_type="input_set", pipeline_id=<pipeline_id>, and a YAML body:
  \`\`\`yaml
  inputSet:
    name: Dev Defaults
    identifier: dev_defaults
    pipeline:
      identifier: <pipeline_id>
      variables:
        - name: env
          type: String
          value: dev
  \`\`\`
- Future runs can use: harness_execute with input_set_ids=["dev_defaults"] instead of passing inputs manually
- This is optional — only create if the user wants reusable configurations

---

CRITICAL RULES:
- Do NOT create any resource (connector, pipeline, service) without showing the YAML and getting user confirmation first
- Do NOT skip steps — complete each one before proceeding
- On CI failure: auto-retry up to 5 times, fixing issues between each attempt
- On CD failure: analyze, fix, ask permission, retry up to 3 times
- After exhausting retries: provide Harness UI deep links to all created resources so the user can investigate manually
- Use existing connectors/services/environments when available — do not duplicate them
- Always reference existing K8s manifests from the repo when available — only generate new ones if none exist`,
        },
      }],
    }),
  );
}
