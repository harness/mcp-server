import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDeployAiAgentPrompt(server: McpServer): void {
  server.registerPrompt(
    "deploy-ai-agent",
    {
      description:
        "End-to-end workflow: ship an AI agent from an IDE to a cloud agent runtime (Google Agent Runtime or AWS AgentCore) through Harness CD — get code into a repo, build & push the agent image, then create the AiAgent service, environment, infrastructure, and a build→deploy pipeline",
      argsSchema: {
        platform: z
          .enum(["GoogleAgentRuntime", "AwsAgentCore"])
          .describe("Target agent runtime: GoogleAgentRuntime (Vertex/GAR) or AwsAgentCore (Bedrock/ECR)")
          .optional(),
        repoUrl: z
          .string()
          .describe("Git repo URL of the agent code. Leave blank to create a Harness Code repo and push.")
          .optional(),
        projectId: z.string().describe("Harness project identifier").optional(),
        executionRoleArn: z
          .string()
          .describe("AWS IAM execution role ARN (required for AwsAgentCore only)")
          .optional(),
      },
    },
    async ({ platform, repoUrl, projectId, executionRoleArn }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Ship the AI agent in this workspace to a Harness-managed cloud agent runtime.

${platform ? `Target platform: ${platform}` : "Target platform: ASK the user — GoogleAgentRuntime or AwsAgentCore"}
${repoUrl ? `Source repo: ${repoUrl}` : "Source repo: not provided — inspect the local workspace for a git remote"}
${projectId ? `Project: ${projectId}` : ""}
${executionRoleArn ? `AWS execution role ARN: ${executionRoleArn}` : ""}

IMPORTANT: Follow the phases IN ORDER. Present the full plan and every generated YAML for review BEFORE creating anything with an MCP tool. Do NOT create resources without explicit user confirmation. Reuse existing connectors / services / environments — never duplicate them.

KEY FACTS ABOUT AI AGENT DEPLOYMENT (do not deviate):
- The agent runs from a pre-built CONTAINER IMAGE. A build step is MANDATORY — there is no build-from-source path.
- The AiAgent service references the image by URI STRING at \`platform.spec.source.spec.image\` — NOT via an artifact-source connector. Do not add an artifact source.
- Chain the built image into the service with a shared tag expression: tag the image \`<+pipeline.sequenceId>\` in the build step, and set the service image to \`<registry-path>:<+pipeline.sequenceId>\`.
- AwsAgentCore additionally REQUIRES \`executionRoleArn\` on the platform spec.
- The deploy/shift/rollback steps read the agent image and identity from the SERVICE at runtime — do NOT put the agent image on the steps.

---

## Phase A — Source: get the code into a Harness-reachable repo

### Step 1 — Check for a git remote (local)
- Run \`git remote -v\` in the workspace.
- **External remote exists** (GitHub/GitLab/Bitbucket): keep it. In Phase D create/confirm a Git connector to it.
- **No remote**: create a Harness Code repo with harness_create resource_type="repository"${projectId ? ` project_id="${projectId}"` : ""} (body: identifier, default_branch, description). Return the clone URL, then instruct the user to \`git remote add\` and \`git push\`. (Harness Code needs no Git connector — the platform clones natively via \`repoName\`.)

---

## Phase B — Target platform

### Step 2 — Confirm the platform
- Confirm ${platform ? platform : "the platform with the user"}. This choice drives everything downstream:
  - **GoogleAgentRuntime** → GCP connector, image in Google Artifact Registry (GAR), \`BuildAndPushGAR\`, infra type \`GoogleAgentRuntime\`, steps \`Deploy/Shift/RollbackGoogleAgentRuntimeRevision\`.
  - **AwsAgentCore** → AWS connector, image in ECR, \`BuildAndPushECR\`, infra type \`AwsAgentCore\`, steps \`Deploy/Shift/RollbackAwsAgentCoreRevision\`, plus \`executionRoleArn\`.

---

## Phase C — Build the image (CI) — MANDATORY

### Step 3 — Check existing Harness resources
- harness_list resource_type="connector"${projectId ? ` project_id="${projectId}"` : ""} — find existing Git, GCP/AWS, and registry connectors.
- harness_list resource_type="service" / "environment" / "infrastructure" — check what already exists.
- harness_describe resource_type="pipeline" — confirm the pipeline schema.

### Step 4 — Gather build prerequisites (ASK the user)
- **Registry push connector**: GCP connector (for GAR) or AWS connector (for ECR).
- **Build infrastructure**: default to **Harness Cloud** (hosted, zero setup) unless the user has a Kubernetes build farm. Confirm before generating YAML.

### Step 5 — Generate the CI Build stage YAML
Build the agent image from the repo and push it to the registry, tagged \`<+pipeline.sequenceId>\`. Use the template for the chosen platform.

**GoogleAgentRuntime → BuildAndPushGAR:**
\`\`\`yaml
- step:
    type: BuildAndPushGAR
    name: Build and Push Agent Image
    identifier: build_agent_image
    spec:
      connectorRef: <+input>      # GCP connector
      host: <+input>              # e.g. us-docker.pkg.dev
      projectID: <+input>         # GCP project id
      imageName: <+input>         # e.g. my-repo/my-agent
      tags:
        - <+pipeline.sequenceId>
      caching: true
\`\`\`
Resulting image URI: \`<host>/<projectID>/<imageName>:<+pipeline.sequenceId>\`.

**AwsAgentCore → BuildAndPushECR:**
\`\`\`yaml
- step:
    type: BuildAndPushECR
    name: Build and Push Agent Image
    identifier: build_agent_image
    spec:
      connectorRef: <+input>      # AWS connector
      account: <+input>           # AWS account id
      region: <+input>            # e.g. us-east-1
      imageName: <+input>         # e.g. my-agent
      tags:
        - <+pipeline.sequenceId>
      caching: true
\`\`\`
Resulting image URI: \`<account>.dkr.ecr.<region>.amazonaws.com/<imageName>:<+pipeline.sequenceId>\`.

Present the CI stage YAML for review. Do NOT create it yet.

---

## Phase D — Connectors

### Step 6 — Create any missing connectors (only after confirmation)
- Enumerate what's needed: cloud connector for CD infra (GCP or AWS), the registry push connector from Phase C (often the same GCP/AWS connector), and a Git connector if using an external SCM.
- Create missing ones with harness_create resource_type="connector" (show YAML first). Connectors MUST exist before the service/infra/pipeline reference them.

---

## Phase E — AiAgent service (source side)

### Step 7 — Author the AiAgent service
- Confirm field shapes with harness_schema resource_type="service".
- Create with harness_create resource_type="service". The image is a STRING using the same tag expression as Step 5.

**GoogleAgentRuntime service:**
\`\`\`yaml
service:
  name: <+input>
  identifier: <+input>
  serviceDefinition:
    type: AiAgent
    spec:
      platform:
        type: GoogleAgentRuntime
        spec:
          source:
            type: Container
            spec:
              image: <host>/<projectID>/<imageName>:<+pipeline.sequenceId>
\`\`\`

**AwsAgentCore service (executionRoleArn REQUIRED):**
\`\`\`yaml
service:
  name: <+input>
  identifier: <+input>
  serviceDefinition:
    type: AiAgent
    spec:
      platform:
        type: AwsAgentCore
        spec:
          executionRoleArn: ${executionRoleArn ? executionRoleArn : "<+input>"}
          source:
            type: Container
            spec:
              image: <account>.dkr.ecr.<region>.amazonaws.com/<imageName>:<+pipeline.sequenceId>
\`\`\`

Optional: an \`AgentConfig\` manifest (Git/Harness store) can carry the agent's config spec — add it only if the agent ships one. Present the service YAML for review before creating.

---

## Phase F — Environment + Infrastructure (target side)

### Step 8 — Environment
- Ask the user: reuse an existing environment or create a new one. Create with harness_create resource_type="environment" if needed.

### Step 9 — Infrastructure
- Confirm field shapes with harness_schema resource_type="infrastructure", then harness_create resource_type="infrastructure".

**GoogleAgentRuntime infrastructure:**
\`\`\`yaml
infrastructureDefinition:
  name: <+input>
  identifier: <+input>
  environmentRef: <env-id>
  deploymentType: AiAgent
  type: GoogleAgentRuntime
  spec:
    connectorRef: <+input>   # GCP connector
    projectId: <+input>
    location: <+input>       # e.g. us-central1
\`\`\`

**AwsAgentCore infrastructure:**
\`\`\`yaml
infrastructureDefinition:
  name: <+input>
  identifier: <+input>
  environmentRef: <env-id>
  deploymentType: AiAgent
  type: AwsAgentCore
  spec:
    connectorRef: <+input>   # AWS connector
    region: <+input>
\`\`\`

Present the environment and infrastructure YAML for review before creating.

---

## Phase G — Deploy stage + run

### Step 10 — Add the CD Deploy stage
Extend the pipeline (or create one) so it runs the CI Build stage from Phase C, then a CD stage of deployment type \`AiAgent\` referencing the service + environment/infrastructure. Use a Canary or Default strategy. Add the platform's Deploy → Shift Traffic → Rollback steps.

**GoogleAgentRuntime steps:**
\`\`\`yaml
- step:
    type: DeployGoogleAgentRuntimeRevision
    name: Deploy Agent
    identifier: deploy_agent
    spec:
      waitReady: true
    timeout: 10m
- step:
    type: ShiftGoogleAgentRuntimeTraffic
    name: Shift Traffic
    identifier: shift_traffic
    spec:
      target:
        revisionId: <+pipeline.stages.deploy.spec.execution.steps.deploy_agent.output.revisionId>
      weight: 100
    timeout: 10m
\`\`\`
Rollback (in the stage's \`rollbackSteps\`):
\`\`\`yaml
- step:
    type: RollbackGoogleAgentRuntimeRevision
    name: Rollback Agent
    identifier: rollback_agent
    spec: {}
    timeout: 10m
\`\`\`

**AwsAgentCore steps:**
\`\`\`yaml
- step:
    type: DeployAwsAgentCoreRevision
    name: Deploy Agent
    identifier: deploy_agent
    spec:
      waitReady: true
    timeout: 10m
- step:
    type: ShiftAwsAgentCoreTraffic
    name: Shift Traffic
    identifier: shift_traffic
    spec:
      target:
        revisionId: <+pipeline.stages.deploy.spec.execution.steps.deploy_agent.output.revisionId>
      weight: 100
    timeout: 10m
\`\`\`
Rollback (in the stage's \`rollbackSteps\`):
\`\`\`yaml
- step:
    type: RollbackAwsAgentCoreRevision
    name: Rollback Agent
    identifier: rollback_agent
    spec: {}
    timeout: 10m
\`\`\`

Present the full pipeline YAML for review. Do NOT create it yet.

### Step 11 — Create, execute, and monitor
- After confirmation, create the pipeline with harness_create resource_type="pipeline".
- Discover runtime inputs: harness_get resource_type="runtime_input_template" resource_id=<pipeline_id>.
- Execute: harness_execute resource_type="pipeline" action="run" resource_id=<pipeline_id>, passing required \`inputs\` (branch for the CI codebase, plus any \`<+input>\` values).
- Monitor with harness_status until the run completes or fails.

**FAILURE RETRY LOOP (up to 3 attempts):**
1. harness_get the execution details/logs and identify the root cause.
2. Fix: code/Dockerfile issues → edit + commit + push; pipeline/service/infra YAML issues → harness_update; connector/credential/role issues → flag to the user with a deep link.
3. Re-execute and monitor. Repeat up to 3 total attempts.
4. After 3 failures: summarize the failures and fixes, and provide Harness UI deep links to every created resource (pipeline, service, environment, infrastructure, connectors).

### Step 12 — Success: verify & report
- Confirm success via harness_status and harness_get.
- Report: image tag pushed, service/env/infra created, deploy + traffic-shift result, and Harness UI deep links to the pipeline execution, service, environment, and infrastructure.

---

CRITICAL RULES:
- Never create a resource without showing its YAML and getting confirmation first.
- Do not skip phases — finish each before the next.
- The agent image is a string on the service source (shared \`<+pipeline.sequenceId>\` tag) — never an artifact source, never on the steps.
- AwsAgentCore requires \`executionRoleArn\`.
- Reuse existing connectors/services/environments/infrastructure when present.`,
          },
        },
      ],
    }),
  );
}
