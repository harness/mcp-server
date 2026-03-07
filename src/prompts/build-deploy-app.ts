import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBuildDeployAppPrompt(server: McpServer): void {
  server.prompt(
    "build-deploy-app",
    "End-to-end workflow: scan a repo, generate CI/CD pipelines in Harness, build a Docker image, generate K8s manifests, and deploy",
    {
      repoUrl: z.string().describe("Git repository URL (e.g. https://github.com/org/repo)"),
      imageName: z.string().describe("Docker image name including registry (e.g. docker.io/myorg/myapp)"),
      projectId: z.string().describe("Harness project identifier").optional(),
      namespace: z.string().describe("Kubernetes namespace for deployment").optional(),
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
- If no Dockerfile exists: analyze the codebase (language, framework, dependencies) and generate an optimized multi-stage Dockerfile
- If a Dockerfile exists: read it and verify it follows best practices (multi-stage build, non-root user, .dockerignore)

### Step 2 — Analyze the application
- Identify the language/framework, exposed ports, environment variables, and health check endpoints
- Note any databases or external services the app depends on
- This context is needed for generating K8s manifests in Phase 3

---

## Phase 2: CI Pipeline — Build & Push (MCP tools)

### Step 3 — Check existing Harness resources
- Call harness_list with resource_type="connector"${projectId ? ` and project_id="${projectId}"` : ""} to find existing Docker registry and Git connectors
- Call harness_list with resource_type="service"${projectId ? ` and project_id="${projectId}"` : ""} to check if this service already exists
- Call harness_list with resource_type="environment"${projectId ? ` and project_id="${projectId}"` : ""} to see available environments
- Call harness_describe with resource_type="pipeline" to understand the pipeline schema

### Step 4 — Ensure connectors exist
- If no Docker registry connector exists: generate connector YAML for DockerHub (or the registry in "${imageName}") and present it for review
- If no Git connector exists for "${repoUrl}": generate a Git connector YAML and present it for review
- Create any missing connectors using harness_create with resource_type="connector" (only after user confirmation)

### Step 5 — Generate CI pipeline YAML
Generate a Harness CI pipeline that:
- Clones "${repoUrl}" using the Git connector
- Builds the Docker image from the Dockerfile found in Step 1
- Tags the image as "${imageName}:<+pipeline.sequenceId>"
- Pushes to the Docker registry using the Docker connector
- Includes a build test step if the repo has tests (e.g. npm test, go test, pytest)

Present the full pipeline YAML for review. Do NOT create it yet.

### Step 6 — Create & execute CI pipeline
- After user confirms the YAML, create it using harness_create with resource_type="pipeline"
- Execute it using harness_execute with resource_type="pipeline"
- Monitor progress using harness_status — poll until the execution completes or fails
- If it fails: call harness_get to retrieve execution details and logs, diagnose the issue, and suggest fixes

---

## Phase 3: CD Pipeline — Generate Manifests & Deploy (MCP tools + local)

### Step 7 — Generate Kubernetes manifests
Based on the app analysis from Step 2, generate:
- **Deployment**: with the image "${imageName}:<+pipeline.sequenceId>", correct ports, resource limits, health checks, and environment variables
- **Service**: ClusterIP or LoadBalancer matching the exposed ports
- **ConfigMap/Secret**: for any environment variables the app needs (secrets as placeholders only)

Present all manifests for review.

### Step 8 — Generate CD pipeline YAML
Generate a Harness CD pipeline that:
- Uses a Kubernetes deployment type
- References the K8s manifests from Step 7
- Deploys to the ${namespace || "default"} namespace
- Uses a Rolling deployment strategy
- Includes a Verify step or health check after deployment

Present the full pipeline YAML for review. Do NOT create it yet.

### Step 9 — Create & execute CD pipeline
- After user confirms, create the CD pipeline using harness_create with resource_type="pipeline"
- Execute it using harness_execute with resource_type="pipeline"
- Monitor with harness_status until complete

### Step 10 — Verify & report
- Confirm the deployment succeeded via harness_status
- Call harness_get to retrieve the final execution details
- Display:
  - CI execution status + image tag pushed
  - CD execution status + deployment details
  - The Harness UI link to both pipelines

---

CRITICAL RULES:
- Do NOT create any resource (connector, pipeline, service) without showing the YAML and getting user confirmation first
- Do NOT skip steps — complete each one before proceeding
- If any step fails, stop and diagnose before continuing
- Use existing connectors/services/environments when available — do not duplicate them`,
        },
      }],
    }),
  );
}
