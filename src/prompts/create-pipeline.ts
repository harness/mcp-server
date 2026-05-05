import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCreatePipelinePrompt(server: McpServer): void {
  server.registerPrompt(
    "create-pipeline",
    {
      description: "Generate a new Harness pipeline YAML from requirements",
      argsSchema: {
        description: z.string().describe("Describe what the pipeline should do"),
        projectId: z.string().describe("Target project identifier").optional(),
      },
    },
    async ({ description, projectId }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Create a Harness pipeline based on these requirements:

${description}

Steps:
1. Read the pipeline JSON Schema resource (schema:///pipeline or schema:///pipeline_v1 depending on version) to understand the required pipeline structure and fields
2. Call harness_describe with resource_type="pipeline" (or "pipeline_v1") to understand available operations
3. If helpful, call harness_list with resource_type="pipeline" (or "pipeline_v1")${projectId ? ` and project_id="${projectId}"` : ""} to see existing pipeline patterns
4. Also check available connectors (harness_list resource_type="connector"), services (harness_list resource_type="service"), and environments (harness_list resource_type="environment")
5. If the pipeline involves building/pushing Docker images, determine the registry type:
   - If the user says "Harness Artifact Registry" or "HAR" → use the HAR template for your version
   - If the user says DockerHub, ECR, GCR, ACR, or any other provider → use the third-party template
   - Call harness_list with resource_type="registry"${projectId ? ` and project_id="${projectId}"` : ""} to discover existing HAR registries
6. Generate the pipeline YAML conforming to the schema for the correct version
7. **Choose storage mode** — ask the user where to store the pipeline:
   - **Inline (default)**: Stored in Harness. Call harness_create with the appropriate resource_type and YAML body.
   - **Remote (External Git)**: Pass \`params: { store_type: "REMOTE", connector_ref: "<git_connector>", repo_name: "<repo>", branch: "main", file_path: ".harness/<pipeline_id>.yaml", commit_msg: "Add pipeline via MCP" }\`
   - **Remote (Harness Code)**: Pass \`params: { store_type: "REMOTE", is_harness_code_repo: true, repo_name: "<repo>", branch: "main", file_path: ".harness/<pipeline_id>.yaml", commit_msg: "Add pipeline via MCP" }\`
8. Present the YAML for review before creating

Do NOT create the pipeline until I confirm — just show me the YAML first.

After the pipeline is created, if it contains \`<+input>\` runtime placeholders:
9. **Suggest creating input sets** to save common configurations for future runs:
   - Call harness_get with resource_type="runtime_input_template" and resource_id=<pipeline_id> to discover all \`<+input>\` placeholders
   - Propose input sets for common scenarios (e.g., "dev-defaults", "prod-defaults") that pre-fill values
   - Create using harness_create with resource_type="input_set", pipeline_id=<pipeline_id>, and appropriate YAML body
   - This step is optional — only create if the user wants reusable run configurations

---

## V0 PIPELINE SYNTAX (use when server instructions say "v0 pipelines")

### Build & Push Docker — HAR (Harness Artifact Registry):
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

### Build & Push Docker — Third-party (DockerHub, ECR, GCR, ACR):
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

---

## V1 PIPELINE SYNTAX (use when server instructions say "v1 pipelines")

Harness v1 pipelines use a flat, simplified YAML syntax. Do NOT use v0 patterns (\`step.type\`, \`spec:\`, \`identifier:\`).

### Top-Level Structure
\`\`\`yaml
pipeline:
  id: my_pipeline
  name: My Pipeline
  clone:
    enabled: true
    connector: account.github
    repo: org/repo
    ref:
      type: branch
      name: main
  stages:
    - id: build
      name: Build
      runtime:
        kubernetes:
          connector: account.k8s_connector
          namespace: harness-build
          os: Linux
      steps:
        - ...
\`\`\`

### Step Types — Use These (in priority order):

**1. \`template: uses:\` — For ALL Harness built-in steps (PREFERRED)**
This is the primary mechanism for Harness platform steps. Always prefer this over \`action:\`.
\`\`\`yaml
# Kubernetes deploy
- id: rollout
  name: Rollout Deployment
  template:
    uses: k8sRollingDeployStep
    with:
      skip_dry_run: false
      pruning: false
  timeout: 10m

# Build and push to ECR
- id: build_push
  name: Build and Push
  template:
    uses: buildAndPushToECR
    with:
      connector: account.aws_connector
      region: us-east-1
      registry: 123456789.dkr.ecr.us-east-1.amazonaws.com
      repo: my-app
      tags:
        - <+pipeline.sequenceId>
        - latest

# Terraform
- id: tf_plan
  name: Terraform Plan
  template:
    uses: TerraformPlan
  timeout: 20m

- id: tf_apply
  name: Terraform Apply
  template:
    uses: TerraformApply
  timeout: 20m
\`\`\`

Common template names: \`k8sRollingDeployStep\`, \`k8sRollingRollbackStep\`, \`k8sCanaryDeployStep\`, \`k8sCanaryDeleteStep\`, \`k8sScaleStep\`, \`k8sDeleteStep\`, \`k8sDryRunStep\`, \`k8sBlueGreenDeployStep\`, \`k8sBlueGreenSwapServicesSelectorsStep\`, \`helmDeployBasicStep\`, \`helmRollbackStep\`, \`buildAndPushToECR\`, \`buildAndPushToDocker\`, \`buildAndPushToGCR\`, \`buildAndPushToACR\`, \`TerraformPlan\`, \`TerraformApply\`, \`TerraformRollback\`, \`EcsRollingDeploy\`, \`EcsRollingRollback\`, \`EcsBlueGreenCreateService\`, \`EcsBlueGreenSwapTargetGroups\`, \`EcsBlueGreenRollback\`, \`uploadArtifactsToS3\`, \`uploadArtifactsToJfrogArtifactory\`, \`saveCacheToS3\`, \`restoreCacheFromS3\`, \`saveCacheToGCS\`, \`restoreCacheFromGCS\`, \`FetchInstanceScript\`, \`Command\`, \`Verify\`, \`Container\`, \`JenkinsBuild\`, \`Sonarqube\`, \`Security\`

**2. \`run:\` — For shell scripts**
\`\`\`yaml
- id: run_tests
  name: Run Tests
  run:
    container:
      connector: account.dockerhub
      image: node:20
    script: |
      npm ci
      npm test
    shell: bash
    output:
      - name: TEST_RESULT
        alias: TEST_RESULT
  timeout: 10m
\`\`\`

**3. \`approval:\` — For gates**
\`\`\`yaml
- id: approve_prod
  name: Approve Production
  approval:
    uses: harness
    with:
      approvers-min-count: 1
      auto-approve: false
      message: "Please approve deployment to production"
      user-groups:
        - project_admins
  timeout: 2d
\`\`\`

**4. \`parallel:\` — For parallel execution**
\`\`\`yaml
- parallel:
    steps:
      - id: unit_tests
        name: Unit Tests
        run:
          script: npm test
          shell: bash
      - id: lint
        name: Lint
        run:
          script: npm run lint
          shell: bash
\`\`\`

**5. \`group:\` — For step groups with shared inputs**
\`\`\`yaml
- group:
    inputs:
      IMAGE_TAG:
        type: string
        value: <+pipeline.sequenceId>
    steps:
      - id: build
        name: Build
        run:
          script: docker build -t app:<+group.variables.IMAGE_TAG> .
          shell: bash
  id: build_group
  name: Build Group
\`\`\`

### CD Stage Pattern (with environment + service)
\`\`\`yaml
- id: deploy_dev
  name: Deploy to Dev
  environment:
    id: dev
    name: dev
    deploy-to: dev_k8s
  service: my_service
  on-failure:
    - action: stage-rollback
      errors:
        - all
  rollback:
    - id: rollback
      name: Rollback
      template:
        uses: k8sRollingRollbackStep
        with:
          pruning: false
      timeout: 10m
  steps:
    - id: deploy
      name: Deploy
      template:
        uses: k8sRollingDeployStep
        with:
          skip_dry_run: false
      timeout: 10m
\`\`\`

### Notifications
\`\`\`yaml
pipeline:
  notifications:
    - id: slack_notify
      name: Slack Notification
      "on":
        - pipeline:
            - success
            - failed
      uses: slack
      with:
        webhook: <+variable.slack_webhook>
\`\`\`

### Pipeline Inputs (runtime variables)
\`\`\`yaml
pipeline:
  inputs:
    environment:
      type: string
      enum:
        - dev
        - staging
        - prod
      value: dev
    image_tag:
      type: string
      value: latest
\`\`\`

### V1 CRITICAL RULES:
- **NEVER use GitHub Actions syntax** (e.g., \`actions/checkout@v3\`, \`docker/build-push-action@v5\`). These are NOT valid in Harness v1.
- **NEVER use v0 syntax** (e.g., \`step.type:\`, \`spec:\`, \`identifier:\`, \`connectorRef:\` at step level).
- **Always prefer \`template: uses:\`** for Harness built-in operations over \`action:\` or inline scripts.
- Use \`run:\` only for custom shell logic that has no corresponding Harness template.
- \`id\` uses snake_case. \`name\` is human-readable.
- \`timeout\` goes at step level, not inside the step type.
- Use \`<+expression>\` syntax for Harness expressions (not \${{ }}).`,
        },
      }],
    }),
  );
}
