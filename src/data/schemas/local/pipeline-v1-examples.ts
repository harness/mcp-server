// Curated v1 pipeline examples extracted from real customer pipelines.
// These demonstrate correct v1 syntax and best practices.
// Served via schema:///pipeline_v1_examples
// @ts-nocheck

const schema: Record<string, any> = {
  "title": "pipeline_v1_examples",
  "description": "Curated Harness v1 pipeline YAML examples. Use these as reference when generating v1 pipelines. IMPORTANT: Always prefer 'template: uses:' for Harness built-in steps. Never use GitHub Actions syntax or v0 patterns.",
  "examples": {
    "ci_build_and_push": {
      "title": "CI Pipeline — Build, Test, and Push to ECR",
      "description": "A CI pipeline that clones a repo, runs tests in parallel with linting, then builds and pushes a Docker image to ECR.",
      "yaml": `pipeline:
  id: ci_build_push
  name: CI Build and Push
  clone:
    connector: account.github
    enabled: true
    ref:
      type: branch
      name: <+trigger.targetBranch>
    repo: org/my-app
  stages:
    - id: Build_and_Test
      name: Build and Test
      clone:
        enabled: true
      runtime:
        kubernetes:
          connector: account.k8s_build
          namespace: harness-build
          os: Linux
      steps:
        - parallel:
            steps:
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
                timeout: 10m
              - id: lint
                name: Lint
                run:
                  container:
                    connector: account.dockerhub
                    image: node:20
                  script: |
                    npm ci
                    npm run lint
                  shell: bash
                timeout: 5m
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
`
    },
    "k8s_rolling_deploy": {
      "title": "CD Pipeline — Kubernetes Rolling Deployment",
      "description": "A CD pipeline that deploys a service to Kubernetes using a rolling strategy with rollback on failure.",
      "yaml": `pipeline:
  id: k8s_deploy
  name: Deploy to Kubernetes
  clone:
    enabled: false
  stages:
    - id: deploy_dev
      name: Deploy to Dev
      environment:
        id: dev
        name: dev
        deploy-to: dev_k8s_cluster
      service: my_service
      on-failure:
        - action: stage-rollback
          errors:
            - all
      rollback:
        - id: rollback
          name: Rollback Deployment
          template:
            uses: k8sRollingRollbackStep
            with:
              pruning: false
          timeout: 10m
      steps:
        - id: deploy
          name: Rolling Deploy
          template:
            uses: k8sRollingDeployStep
            with:
              skip_dry_run: false
              pruning: false
          timeout: 10m
        - id: verify
          name: Verify Deployment
          template:
            uses: Verify
          timeout: 15m
`
    },
    "terraform_infra": {
      "title": "Infrastructure Pipeline — Terraform Plan/Approve/Apply",
      "description": "An infrastructure pipeline with Terraform plan, manual approval, and apply steps with automatic rollback on failure.",
      "yaml": `pipeline:
  id: terraform_infra
  name: Terraform Infrastructure
  clone:
    connector: account.github
    enabled: true
    ref:
      type: branch
      name: main
    repo: org/infrastructure
  stages:
    - id: Terraform
      name: Terraform
      runtime:
        shell: true
      steps:
        - id: tf_plan
          name: Terraform Plan
          template:
            uses: TerraformPlan
          timeout: 20m
        - approval:
            uses: harness
            with:
              approvers-min-count: 1
              auto-approve: false
              message: "Review the Terraform plan and approve to apply changes."
              user-groups:
                - infra_admins
          id: approve_apply
          name: Approve Apply
          timeout: 2d
        - id: tf_apply
          name: Terraform Apply
          template:
            uses: TerraformApply
          timeout: 20m
        - id: tf_rollback
          if: <+OnStageFailure>
          name: Terraform Rollback
          template:
            uses: TerraformRollback
          timeout: 20m
`
    },
    "helm_deploy": {
      "title": "CD Pipeline — Helm Deployment with Rollback",
      "description": "A Helm-based deployment pipeline for Kubernetes services.",
      "yaml": `pipeline:
  id: helm_deploy
  name: Helm Deploy
  clone:
    enabled: false
  stages:
    - id: Helm_Deploy
      name: Helm Deploy
      environment:
        id: prod
        name: prod
        deploy-to: prod_cluster
      service: my_helm_service
      on-failure:
        - action: stage-rollback
          errors:
            - all
      rollback:
        - id: helm_rollback
          name: Helm Rollback
          template:
            uses: helmRollbackStep
            with: {}
          timeout: 10m
      steps:
        - id: helm_deploy
          name: Helm Deployment
          template:
            uses: helmDeployBasicStep
            with:
              ignore_failed_release: false
          timeout: 10m
        - id: fetch_instances
          name: Fetch Instances
          template:
            uses: FetchInstanceScript
          timeout: 1m
`
    },
    "ecs_blue_green": {
      "title": "CD Pipeline — ECS Blue/Green Deployment",
      "description": "An ECS pipeline using blue/green deployment strategy with target group swap.",
      "yaml": `pipeline:
  id: ecs_blue_green
  name: ECS Blue Green Deploy
  clone:
    enabled: false
  stages:
    - id: Deploy_ECS
      name: Deploy ECS
      environment:
        id: prod
        name: prod
        deploy-to: ecs_prod
      service: my_ecs_service
      on-failure:
        - action: stage-rollback
          errors:
            - all
      rollback:
        - id: ecs_rollback
          name: ECS Rollback
          template:
            uses: EcsBlueGreenRollback
          timeout: 10m
      steps:
        - id: create_service
          name: Create Service
          template:
            uses: EcsBlueGreenCreateService
          timeout: 10m
        - id: swap_targets
          name: Swap Target Groups
          template:
            uses: EcsBlueGreenSwapTargetGroups
          timeout: 10m
`
    },
    "multi_env_with_approvals": {
      "title": "Multi-Environment Pipeline with Approvals and Notifications",
      "description": "A production pipeline deploying through dev → staging → prod with approvals, notifications, and matrix-based infrastructure selection.",
      "yaml": `pipeline:
  id: service_deploy
  name: Service Deployment
  clone:
    enabled: false
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
  notifications:
    - id: slack_notify
      name: Pipeline Notifications
      "on":
        - pipeline:
            - success
            - failed
      uses: slack
      with:
        webhook: <+variable.slack_webhook>
  stages:
    - id: deploy_dev
      name: Deploy Dev
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
    - id: approve_staging
      name: Approve Staging
      steps:
        - approval:
            uses: harness
            with:
              approvers-min-count: 1
              auto-approve: false
              message: "Dev deployment succeeded. Approve promotion to staging?"
              user-groups:
                - dev_leads
          id: approve
          name: Approve
          timeout: 1d
    - id: deploy_staging
      name: Deploy Staging
      if: <+OnPipelineSuccess>
      environment:
        id: staging
        name: staging
        deploy-to: staging_k8s
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
    - id: approve_prod
      name: Approve Production
      steps:
        - approval:
            uses: harness
            with:
              approvers-min-count: 2
              auto-approve: false
              message: "Staging verified. Approve production deployment?"
              user-groups:
                - prod_approvers
          id: approve
          name: Approve
          timeout: 2d
    - id: deploy_prod
      name: Deploy Production
      if: <+OnPipelineSuccess>
      environment:
        id: prod
        name: prod
        deploy-to: prod_k8s
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
`
    }
  },
  "step_reference": {
    "description": "Quick reference of available v1 step types and their syntax. Use 'template: uses:' as the default for any Harness built-in operation.",
    "template_step": {
      "syntax": "template:\\n  uses: <templateName>\\n  with:\\n    key: value",
      "when_to_use": "ALL Harness built-in steps — deployments, builds, Terraform, cache, artifact uploads, etc.",
      "common_templates": [
        "k8sRollingDeployStep", "k8sRollingRollbackStep", "k8sCanaryDeployStep",
        "k8sCanaryDeleteStep", "k8sScaleStep", "k8sDeleteStep", "k8sDryRunStep",
        "k8sBlueGreenDeployStep", "k8sBlueGreenSwapServicesSelectorsStep",
        "helmDeployBasicStep", "helmRollbackStep",
        "buildAndPushToECR", "buildAndPushToDocker", "buildAndPushToGCR", "buildAndPushToACR",
        "TerraformPlan", "TerraformApply", "TerraformRollback", "TerraformCloudRun",
        "EcsRollingDeploy", "EcsRollingRollback",
        "EcsBlueGreenCreateService", "EcsBlueGreenSwapTargetGroups", "EcsBlueGreenRollback",
        "uploadArtifactsToS3", "uploadArtifactsToJfrogArtifactory",
        "saveCacheToS3", "restoreCacheFromS3", "saveCacheToGCS", "restoreCacheFromGCS",
        "FetchInstanceScript", "Command", "Verify", "Container",
        "JenkinsBuild", "Sonarqube", "Security", "Wiz",
        "gitCloneStep", "jiraCreate", "jiraUpdate", "ShellScriptProvision"
      ]
    },
    "run_step": {
      "syntax": "run:\\n  script: |\\n    commands here\\n  shell: bash\\n  container:\\n    connector: account.dockerhub\\n    image: node:20",
      "when_to_use": "Custom shell scripts with no corresponding Harness template"
    },
    "approval_step": {
      "syntax": "approval:\\n  uses: harness\\n  with:\\n    approvers-min-count: 1\\n    message: 'Approve?'\\n    user-groups:\\n      - group_name",
      "when_to_use": "Manual approval gates between stages"
    },
    "do_not_use": {
      "github_actions": "NEVER use 'actions/checkout@v3', 'docker/build-push-action', or any GitHub Actions marketplace reference. These are NOT valid in Harness v1.",
      "v0_syntax": "NEVER use 'step.type:', 'spec:', 'identifier:', 'connectorRef:' at step level. These are v0 patterns.",
      "action_step": "'action:' is ONLY for Drone/Harness plugins (e.g., plugins/docker). Prefer 'template: uses:' for all Harness built-in operations."
    }
  }
};

export default schema;
