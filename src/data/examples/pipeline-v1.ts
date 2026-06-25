import { registerExamples } from "./index.js";
import type { ResourceExample } from "./types.js";

const examples: ResourceExample[] = [
  {
    name: "minimal-v1",
    resourceType: "pipeline_v1",
    description: "Minimal v1 pipeline with a single run step",
    tags: ["v1", "minimal", "starter", "ci", "simplified"],
    yaml: `pipeline:
  clone:
    enabled: false
  id: simple_build
  name: Simple Build
  stages:
    - id: build
      name: build
      runtime:
        shell: true
      steps:
        - id: build
          name: Build
          run:
            script: |-
              echo "Building..."
              npm install
              npm test
            shell: sh
          timeout: 10m`,
  },
  {
    name: "agent-pipeline",
    resourceType: "pipeline_v1",
    description: "CI pipeline that runs an AI code-review agent over a pull request",
    tags: ["v1", "agent", "ai", "code-review", "ci"],
    yaml: `pipeline:
  clone:
    connector: account.github_connector
    enabled: true
    ref:
      name: <+trigger.sourceBranch>
      type: branch
    repo: applications/backend-api
  id: code_review_agent
  inputs:
    model:
      type: string
      value: claude-sonnet-4-6
  name: Code Review Agent
  stages:
    - cache:
        enabled: false
        path: []
      clone:
        enabled: true
      id: review
      name: review
      runtime:
        kubernetes:
          automount-service-token: true
          connector: account.k8s_build_cluster
          namespace: harness-builds
          node: {}
          os: Linux
      steps:
        - id: code_review
          name: Code Review
          run:
            container:
              connector: account.registry_connector
              image: harness/agent-cli:latest
            env:
              ANTHROPIC_MODEL: <+pipeline.variables.model>
              ANTHROPIC_API_KEY: <+secrets.getValue("account.anthropic_api_key")>
            script: |-
              agent review \\
                --model "\${ANTHROPIC_MODEL}" \\
                --diff "origin/<+trigger.targetBranch>...HEAD" \\
                --rule "Focus on security vulnerabilities" \\
                --rule "Check for breaking API changes" \\
                --output review.md
              cat review.md
            shell: sh
          timeout: 30m`,
  },
  {
    name: "helm-deploy-v1",
    resourceType: "pipeline_v1",
    description: "Helm chart deployment with rollback on failure",
    tags: ["v1", "cd", "helm", "deploy", "rollback", "kubernetes"],
    yaml: `pipeline:
  clone:
    enabled: false
  id: backend_deploy
  name: Backend Service Deployment
  stages:
    - environment:
        deploy-to: shared
        id: dev
        name: dev
      id: Helm_Deploy
      name: Helm Deploy
      on-failure:
        - action: stage-rollback
          errors:
            - all
      rollback:
        - id: helmRollback
          name: Helm Rollback
          template:
            uses: helmRollbackStep
            with: {}
          timeout: 10m
      service: backend_api
      steps:
        - id: helmDeployment
          name: Helm Deployment
          template:
            uses: helmDeployBasicStep
            with:
              ignore_failed_release: false
          timeout: 10m`,
  },
  {
    name: "ci-docker-build-v1",
    resourceType: "pipeline_v1",
    description: "CI pipeline with build caching, git metadata extraction, and Docker image push",
    tags: ["v1", "ci", "docker", "build", "cache", "ecr", "container"],
    yaml: `pipeline:
  clone:
    connector: account.github_connector
    enabled: true
    ref:
      name: <+trigger.sourceBranch>
      type: branch
    repo: applications/backend-api
  id: backend_container_build
  name: Backend Container Build
  stages:
    - build-intelligence:
        enabled: true
      cache:
        enabled: true
        override: false
        path:
          - node_modules
          - .build-cache
      clone:
        enabled: true
      id: Build_Publish
      name: Build & Publish
      runtime:
        kubernetes:
          automount-service-token: true
          connector: account.k8s_build_cluster
          namespace: harness-builds
          node: {}
          os: Linux
      steps:
        - id: Get_Commit_Details
          name: Get Commit Details
          run:
            output:
              - alias: commitSha
                name: commitSha
              - alias: gitShortSha
                name: gitShortSha
              - alias: commitMessage
                name: commitMessage
            script: |-
              commitSha=$(git rev-parse HEAD)
              gitShortSha=$(git rev-parse --short HEAD)
              commitMessage=$(git show --pretty=format:%s -s HEAD)
            shell: bash
        - id: Build_App
          name: Build App
          run:
            container:
              connector: account.registry_connector
              image: node:20-alpine
              cpu: 2000m
              memory: 4GiB
            script: |-
              npm ci
              npm run build
              npm run test:ci
            shell: sh
        - id: Docker_Build_Push
          name: Docker Build & Push
          run:
            container:
              connector: account.registry_connector
              image: docker:24-cli
            script: |-
              docker build --rm=true -f Dockerfile -t backend-api .
              docker tag backend-api registry.example.com/backend-api:<+pipeline.stages.Build_Publish.steps.Get_Commit_Details.output.outputVariables.gitShortSha>
              docker push registry.example.com/backend-api:<+pipeline.stages.Build_Publish.steps.Get_Commit_Details.output.outputVariables.gitShortSha>
            shell: sh`,
  },
  {
    name: "terraform-approval-v1",
    resourceType: "pipeline_v1",
    description: "Multi-stage Terraform pipeline with approval gates and rollback",
    tags: ["v1", "cd", "terraform", "approval", "iac", "infrastructure", "multi-stage"],
    yaml: `pipeline:
  clone:
    connector: account.github_connector
    enabled: true
    ref:
      name: <+trigger.targetBranch>
      type: branch
    repo: infrastructure/cloud-platform
  id: infra_deploy
  name: Infrastructure Deploy
  stages:
    - clone:
        enabled: true
      id: Plan_Dev
      name: Plan Dev
      runtime:
        shell: true
      steps:
        - id: Terraform_Plan
          name: Terraform Plan
          template:
            uses: TerraformPlan
          timeout: 20m
    - id: Approval_Deploy_Prod
      name: Approval - Deploy Prod
      steps:
        - approval:
            uses: harness
            with:
              approvers-min-count: 1
              auto-approve: false
              block-executor: false
              execution-details: true
              message: |-
                Please review the Terraform plan
                and approve the pipeline to proceed
              user-groups:
                - platform_engineers
          id: Approval_Deploy_Prod
          name: Approval - Deploy Prod
          timeout: 2d
    - delegate:
        - kubernetes-delegate
      id: Deploy_Prod
      name: Deploy Prod
      runtime:
        shell: true
      steps:
        - id: Terraform_Plan
          name: Terraform Plan
          template:
            uses: TerraformPlan
          timeout: 20m
        - id: Terraform_Apply
          name: Terraform Apply
          template:
            uses: TerraformApply
          timeout: 20m
        - id: Terraform_Rollback
          if: <+OnStageFailure>
          name: Terraform Rollback
          template:
            uses: TerraformRollback
          timeout: 20m`,
  },
  {
    name: "multi-region-hotfix-v1",
    resourceType: "pipeline_v1",
    description: "Multi-region deployment with barriers, canary strategy, and configurable inputs",
    tags: ["v1", "cd", "multi-region", "barriers", "canary", "hotfix", "inputs"],
    yaml: `pipeline:
  barriers:
    - sync-none-canary
    - sync-canary-preprod
    - sync-canary-prod-eu
    - sync-canary-prod-na
  clone:
    enabled: false
  delegate:
    - <+variable.delegate_selector>
  id: hotfix_deployment
  inputs:
    LiveTicket:
      required: true
      type: string
      value: LIVE-12345
    SkipCanary:
      enum:
        - "True"
        - "False"
      required: true
      type: string
      value: "False"
    TargetEnvironment:
      enum:
        - prod-eu
        - prod-na
        - prod-ap
      required: true
      type: string
      value: prod-eu
  name: Hotfix Deployment
  notifications:
    - id: deployment_webhook
      name: Deployment Webhook
      "on":
        - pipeline: all
        - stage: all
      uses: webhook
      with:
        url: <+secrets.getValue("account.deploy_webhook_url")>
  stages:
    - delegate:
        - <+variable.delegate_selector>
      environment:
        deploy-to: nonprod
        id: account.deploy_util
        name: account.deploy_util
      id: deployment_setup
      if: <+Always>
      name: deployment-setup
      on-failure:
        - action:
            retry:
              attempts: 3
              failure-action: stage-rollback
              interval: 10s
          errors:
            - delegate-provisioning
        - action: stage-rollback
          errors:
            - all
      service: platform_gateway
      steps:
        - id: export_infra_vars
          name: Export Infra Vars
          run:
            output:
              - alias: prod_eu_namespace
                name: prod_eu_namespace
              - alias: prod_na_namespace
                name: prod_na_namespace
              - alias: prod_ap_namespace
                name: prod_ap_namespace
            shell: bash
          timeout: 10m`,
  },
  {
    name: "ecs-fargate-deploy-v1",
    resourceType: "pipeline_v1",
    description: "ECS Fargate deployment with rolling deploy and rollback",
    tags: ["v1", "cd", "ecs", "fargate", "aws", "deploy", "rolling"],
    yaml: `pipeline:
  clone:
    connector: cd
    enabled: true
    repo: <+pipeline.variables.RepoName>
  id: ecs_fargate_deploy
  inputs:
    AppName:
      required: true
      type: string
      value: backend-api
    RepoName:
      required: true
      type: string
      value: my-org.backend
    region:
      enum:
        - us-east-1
        - us-west-2
      required: true
      type: string
      value: us-east-1
  name: ECS Fargate Deploy
  stages:
    - environment:
        deploy-to: ecs_prod
        id: prod
        name: prod
      id: prod
      if: <+OnPipelineSuccess>
      name: prod
      on-failure:
        - action: stage-rollback
          errors:
            - all
      rollback:
        - id: ecsRollingRollback
          name: ECS Rolling Rollback
          template:
            uses: EcsRollingRollback
          timeout: 20m
      service: ecs_fargate_service
      steps:
        - id: ecsRollingDeploy
          name: ECS Rolling Deploy
          template:
            uses: EcsRollingDeploy
          timeout: 20m`,
  },
  {
    name: "k8s-blue-green-v1",
    resourceType: "pipeline_v1",
    description: "Kubernetes Blue-Green deployment with step groups, parallel steps, and artifact retrieval",
    tags: ["v1", "cd", "kubernetes", "blue-green", "parallel", "step-group", "helm"],
    yaml: `pipeline:
  clone:
    connector: account.github_connector
    enabled: true
    repo: <+pipeline.name>
  id: k8s_blue_green_deploy
  name: K8s Blue-Green Deploy
  stages:
    - delegate:
        - helm-delegate-cd
      environment:
        deploy-to: dev_cluster
        id: dev
        name: dev
      id: Deploy_to_dev
      inputs:
        BuildVersion:
          type: string
          value: main-2026-01-15.42
        change_request:
          required: true
          type: string
          value: CHG0000001
      name: Deploy to dev
      on-failure:
        - action: stage-rollback
          errors:
            - all
      rollback:
        - id: K8sBGSwapServices
          name: Blue-Green Swap Rollback
          template:
            uses: k8sBlueGreenSwapServicesSelectorsStep
            with:
              is_openshift: \${{rollback.data.HARNESS_IS_OPENSHIFT}}
              stable_service: \${{rollback.data.PLUGIN_STABLE_SERVICE}}
              stage_service: \${{rollback.data.PLUGIN_STAGE_SERVICE}}
          timeout: 10m
      service: <+pipeline.identifier>
      steps:
        - group:
            inputs:
              namespace:
                type: string
                value: app-dev
            steps:
              - parallel:
                  steps:
                    - id: setKubeconfig
                      name: Set Kubeconfig
                      run:
                        container:
                          connector: account.container_registry
                          image: bitnami/kubectl:latest
                        script: |-
                          kubectl config set-cluster deploy-cluster --server=<+group.variables.kubeserver>
                          kubectl config set-credentials deploy-user --token=<+group.variables.kubetoken>
                          kubectl config set-context deploy-context --cluster=deploy-cluster --user=deploy-user --namespace=<+group.variables.namespace>
                          kubectl config use-context deploy-context
                          kubectl get pods
                        shell: bash
                    - id: Clone_Helm_Charts
                      name: Clone Helm Charts
                      template:
                        uses: gitCloneStep
                        with:
                          branch: main
                          cloneDirectory: /harness/helm-charts
                          connector: account.github_connector
                          depth: 1
                          repoName: helm-charts
              - id: Helm_Deploy
                name: Helm Deploy
                run:
                  container:
                    connector: account.container_registry
                    image: alpine/helm:3.14
                  script: |-
                    helm upgrade --install <+pipeline.name> /harness/helm-charts/src/app-config \
                      --namespace <+group.variables.namespace> \
                      --set image.tag=<+stage.variables.BuildVersion>
                  shell: bash
          id: Deploy_Group
          name: Deploy Group`,
  },
  {
    name: "pr-teardown-v1",
    resourceType: "pipeline_v1",
    description: "PR environment teardown pipeline that cleans up ephemeral deployments",
    tags: ["v1", "cd", "pr", "teardown", "cleanup", "kubernetes", "ephemeral"],
    yaml: `pipeline:
  clone:
    enabled: false
  id: pr_environment_teardown
  inputs:
    branch:
      type: string
      value: main
  name: PR Environment Teardown
  stages:
    - environment:
        deploy-to: pr
        id: pr
        name: pr
      id: Delete_PR
      name: Delete PR
      on-failure:
        - action: fail
          errors:
            - all
      service: app_service
      steps:
        - id: Delete_PR
          name: Delete PR Resources
          run:
            script: |-
              set -x
              export KUBECONFIG=\${HARNESS_KUBE_CONFIG_PATH}

              # Delete PR objects created by helm chart
              kubectl delete deployment,pod,replicaset,service,ingress,configmap \\
                -l app.kubernetes.io/instance=pr-<+trigger.prNumber>-<+service.name>

              # Delete PR TLS secret
              kubectl delete secret --ignore-not-found=true \\
                <+service.name>-pr-<+trigger.prNumber>-tls

              # Delete Harness ConfigMap for this deployment
              kubectl delete configmap/pr-<+trigger.prNumber>-<+service.name> \\
                --ignore-not-found=true
            shell: bash
          timeout: 10m`,
  },
  {
    name: "k8s-rolling-deploy-v1",
    resourceType: "pipeline_v1",
    description: "Kubernetes rolling deployment with dry run, verification, and rollback",
    tags: ["v1", "cd", "kubernetes", "k8s", "rolling", "deploy", "verify"],
    yaml: `pipeline:
  clone:
    enabled: false
  id: k8s_rolling_deploy
  name: K8s Rolling Deploy
  stages:
    - environment:
        deploy-to: production_cluster
        id: prod
        name: prod
      id: Rolling_Deploy
      name: Rolling Deploy
      on-failure:
        - action:
            retry:
              attempts: 2
              failure-action: stage-rollback
              interval: 30s
          errors:
            - connectivity
            - delegate-provisioning
        - action: stage-rollback
          errors:
            - all
      rollback:
        - id: rollingRollback
          name: Rolling Rollback
          template:
            uses: k8sRollingRollbackStep
            with:
              pruning: false
          timeout: 10m
      service: backend_service
      steps:
        - id: dryRun
          name: Dry Run
          template:
            uses: k8sDryRunStep
          timeout: 5m
        - id: rollingDeploy
          name: Rolling Deploy
          template:
            uses: k8sRollingDeployStep
            with:
              pruning: true
              skip_dry_run: false
          timeout: 10m
        - id: verify
          name: Verify Deployment
          template:
            uses: Verify
          timeout: 15m`,
  },
  {
    name: "k8s-canary-deploy-v1",
    resourceType: "pipeline_v1",
    description: "Kubernetes canary deployment with percentage-based traffic shifting, verification, and approval",
    tags: ["v1", "cd", "kubernetes", "k8s", "canary", "traffic", "verify", "approval"],
    yaml: `pipeline:
  clone:
    enabled: false
  delegate:
    - <+variable.delegate_selector>
  id: k8s_canary_deploy
  name: K8s Canary Deploy
  stages:
    - environment:
        deploy-to: production_cluster
        id: prod
        name: prod
      id: Canary_Deploy
      name: Canary Deploy
      on-failure:
        - action:
            retry:
              attempts: 3
              failure-action: stage-rollback
              interval: 1m
          errors:
            - connectivity
            - delegate-provisioning
            - delegate-restart
        - action: stage-rollback
          errors:
            - all
      rollback:
        - id: canaryDelete
          name: Canary Delete
          template:
            uses: k8sCanaryDeleteStep
          timeout: 10m
        - id: rollingRollback
          name: Rolling Rollback
          template:
            uses: k8sRollingRollbackStep
            with:
              pruning: false
          timeout: 10m
      service: platform_service
      steps:
        - group:
            steps:
              - id: canary_deploy
                name: Canary Deployment
                template:
                  uses: k8sCanaryDeployStep
                  with:
                    instances: 25
                    skip_dry_run: false
                    unit_type: percentage
                timeout: 10m
              - id: verify_canary
                name: Verify Canary
                template:
                  uses: Verify
                timeout: 30m
              - approval:
                  uses: harness
                  with:
                    approvers-min-count: 1
                    auto-approve: false
                    block-executor: false
                    execution-details: true
                    message: |-
                      Canary verification passed.
                      Approve to promote canary to full rollout.
                    user-groups:
                      - platform_engineers
                id: canary_approval
                name: Canary Approval
                timeout: 1d
              - id: canary_delete
                name: Canary Delete
                template:
                  uses: k8sCanaryDeleteStep
                timeout: 10m
              - id: rolling_deploy
                name: Full Rolling Deploy
                template:
                  uses: k8sRollingDeployStep
                  with:
                    pruning: true
                    skip_dry_run: false
                timeout: 10m
          id: canary_phase
          name: Canary Phase`,
  },
  {
    name: "ecs-blue-green-v1",
    resourceType: "pipeline_v1",
    description: "ECS Blue-Green deployment with target group swap and rollback",
    tags: ["v1", "cd", "ecs", "blue-green", "aws", "target-group", "swap"],
    yaml: `pipeline:
  clone:
    enabled: false
  id: ecs_blue_green_deploy
  name: ECS Blue-Green Deploy
  stages:
    - environment:
        deploy-to: ecs_production
        id: prod
        name: prod
      id: Deploy_Prod
      name: Deploy Prod
      on-failure:
        - action: stage-rollback
          errors:
            - all
      rollback:
        - id: ecsBlueGreenRollback
          name: ECS Blue Green Rollback
          template:
            uses: EcsBlueGreenRollback
          timeout: 10m
      service: api_service
      steps:
        - group:
            steps:
              - id: blueGreenCreateService
                name: Blue Green Create Service
                template:
                  uses: EcsBlueGreenCreateService
                timeout: 10m
              - id: blueGreenSwapTargetGroups
                name: Swap Target Groups
                template:
                  uses: EcsBlueGreenSwapTargetGroups
                timeout: 10m
          id: blueGreenDeployment
          name: Blue Green Deployment`,
  },
  {
    name: "serverless-lambda-v1",
    resourceType: "pipeline_v1",
    description: "AWS Lambda serverless deployment with build, package, and deploy stages",
    tags: ["v1", "cd", "serverless", "lambda", "aws", "function", "sam"],
    yaml: `pipeline:
  clone:
    connector: account.github_connector
    enabled: true
    repo: serverless-functions
  id: serverless_lambda_deploy
  name: Serverless Lambda Deploy
  stages:
    - build-intelligence:
        enabled: true
      cache:
        enabled: true
        override: false
        path:
          - node_modules
          - .serverless
      clone:
        enabled: true
      id: Build_Package
      name: Build & Package
      runtime:
        shell: true
      steps:
        - id: install_deps
          name: Install Dependencies
          run:
            script: |-
              npm ci
              npm run build
              npm run test
            shell: bash
          timeout: 10m
        - id: package_function
          name: Package Function
          run:
            output:
              - alias: ARTIFACT_PATH
                name: ARTIFACT_PATH
            script: |-
              npx serverless package --stage <+pipeline.variables.stage>
              ARTIFACT_PATH=".serverless/service.zip"
            shell: bash
          timeout: 10m
    - environment:
        deploy-to: lambda_<+pipeline.variables.stage>
        id: <+pipeline.variables.stage>
        name: <+pipeline.variables.stage>
      id: Deploy_Lambda
      name: Deploy Lambda
      on-failure:
        - action: stage-rollback
          errors:
            - all
      service: lambda_function
      steps:
        - id: deploy_function
          name: Deploy Function
          run:
            env:
              AWS_REGION: <+pipeline.variables.region>
            script: |-
              npx serverless deploy --stage <+pipeline.variables.stage> --region <+spec.env.AWS_REGION>
            shell: bash
          timeout: 15m
        - id: smoke_test
          name: Smoke Test
          run:
            script: |-
              FUNCTION_URL=$(aws lambda get-function-url-config \
                --function-name <+service.name>-<+pipeline.variables.stage> \
                --query 'FunctionUrl' --output text)
              curl -f --retry 3 --retry-delay 5 "\${FUNCTION_URL}/health"
            shell: bash
          timeout: 5m
  inputs:
    stage:
      enum:
        - dev
        - staging
        - prod
      required: true
      type: string
      value: dev
    region:
      enum:
        - us-east-1
        - eu-west-1
        - ap-southeast-1
      type: string
      value: us-east-1`,
  },
  {
    name: "tanzu-deploy-v1",
    resourceType: "pipeline_v1",
    description: "Tanzu Application Service (TAS) deployment with blue-green route mapping",
    tags: ["v1", "cd", "tanzu", "tas", "cloudfoundry", "cf", "blue-green", "route"],
    yaml: `pipeline:
  clone:
    enabled: false
  id: tanzu_app_deploy
  name: Tanzu App Deploy
  stages:
    - environment:
        deploy-to: tas_production
        id: prod
        name: prod
      id: TAS_Deploy
      name: TAS Deploy
      on-failure:
        - action: stage-rollback
          errors:
            - all
      service: web_app
      steps:
        - id: app_setup
          name: App Setup
          run:
            env:
              CF_API: <+infra.connector.spec.endpointUrl>
              CF_ORG: <+infra.connector.spec.organization>
              CF_SPACE: <+infra.connector.spec.space>
            script: |-
              cf api \${CF_API}
              cf auth
              cf target -o \${CF_ORG} -s \${CF_SPACE}
            shell: bash
          timeout: 5m
        - id: blue_green_push
          name: Blue-Green Push
          run:
            env:
              APP_NAME: <+service.name>
              INSTANCES: "3"
              MEMORY: 1G
              ROUTE: <+pipeline.variables.app_route>
            script: |-
              # Push new version with temporary route
              cf push \${APP_NAME}-new -f manifest.yml -i \${INSTANCES} -m \${MEMORY} --no-route
              cf map-route \${APP_NAME}-new apps.internal --hostname \${APP_NAME}-canary

              # Validate new version
              cf app \${APP_NAME}-new | grep running

              # Swap routes
              cf map-route \${APP_NAME}-new \${ROUTE}
              cf unmap-route \${APP_NAME} \${ROUTE}

              # Rename and cleanup
              cf rename \${APP_NAME} \${APP_NAME}-old
              cf rename \${APP_NAME}-new \${APP_NAME}
              cf delete \${APP_NAME}-old -f
            shell: bash
          timeout: 15m
  inputs:
    app_route:
      required: true
      type: string
      value: apps.example.com`,
  },
  {
    name: "azure-web-app-v1",
    resourceType: "pipeline_v1",
    description: "Azure Web App deployment with slot swap strategy and health check",
    tags: ["v1", "cd", "azure", "web-app", "slot", "swap", "cloud"],
    yaml: `pipeline:
  clone:
    connector: account.azure_devops_connector
    enabled: true
    repo: webapp-source
  id: azure_webapp_deploy
  name: Azure Web App Deploy
  stages:
    - build-intelligence:
        enabled: true
      cache:
        enabled: true
        override: false
      clone:
        enabled: true
      id: Build
      name: Build
      runtime:
        shell: true
      steps:
        - id: build_app
          name: Build App
          run:
            script: |-
              dotnet restore
              dotnet build --configuration Release
              dotnet publish --configuration Release --output ./publish
            shell: bash
          timeout: 10m
        - id: push_image
          name: Push to ACR
          run:
            env:
              ACR_NAME: <+pipeline.variables.acr_name>
              IMAGE_TAG: <+pipeline.sequenceId>
            script: |-
              az acr login --name \${ACR_NAME}
              docker build -t \${ACR_NAME}.azurecr.io/<+service.name>:\${IMAGE_TAG} .
              docker push \${ACR_NAME}.azurecr.io/<+service.name>:\${IMAGE_TAG}
            shell: bash
          timeout: 10m
    - environment:
        deploy-to: azure_production
        id: prod
        name: prod
      id: Deploy_Prod
      name: Deploy Prod
      on-failure:
        - action: stage-rollback
          errors:
            - all
      service: webapp_service
      steps:
        - id: deploy_to_slot
          name: Deploy to Staging Slot
          run:
            env:
              RESOURCE_GROUP: <+pipeline.variables.resource_group>
              APP_NAME: <+service.name>
              IMAGE_TAG: <+pipeline.sequenceId>
              ACR_NAME: <+pipeline.variables.acr_name>
            script: |-
              az webapp config container set \
                --resource-group \${RESOURCE_GROUP} \
                --name \${APP_NAME} \
                --slot staging \
                --container-image-name \${ACR_NAME}.azurecr.io/\${APP_NAME}:\${IMAGE_TAG}
            shell: bash
          timeout: 10m
        - id: health_check
          name: Health Check Staging
          run:
            env:
              APP_NAME: <+service.name>
            script: |-
              SLOT_URL="https://\${APP_NAME}-staging.azurewebsites.net/health"
              for i in {1..10}; do
                STATUS=$(curl -s -o /dev/null -w "%{http_code}" "\${SLOT_URL}")
                if [ "\${STATUS}" = "200" ]; then
                  echo "Health check passed"
                  exit 0
                fi
                echo "Attempt \${i}: Status \${STATUS}, retrying..."
                sleep 10
              done
              echo "Health check failed after 10 attempts"
              exit 1
            shell: bash
          timeout: 5m
        - id: swap_slots
          name: Swap to Production
          run:
            env:
              RESOURCE_GROUP: <+pipeline.variables.resource_group>
              APP_NAME: <+service.name>
            script: |-
              az webapp deployment slot swap \
                --resource-group \${RESOURCE_GROUP} \
                --name \${APP_NAME} \
                --slot staging \
                --target-slot production
              echo "Slot swap complete — staging is now production"
            shell: bash
          timeout: 10m
  inputs:
    resource_group:
      required: true
      type: string
      value: rg-production
    acr_name:
      required: true
      type: string
      value: myacr`,
  },
  {
    name: "custom-deployment-v1",
    resourceType: "pipeline_v1",
    description: "Custom deployment using shell scripts with fetch instance and artifact download",
    tags: ["v1", "cd", "custom", "shell", "ssh", "traditional", "artifact"],
    yaml: `pipeline:
  clone:
    enabled: false
  id: custom_deploy
  name: Custom Deployment
  stages:
    - environment:
        deploy-to: on_prem_servers
        id: prod
        name: prod
      id: Deploy
      name: Deploy
      on-failure:
        - action: stage-rollback
          errors:
            - all
      service: legacy_app
      steps:
        - id: download_artifact
          name: Download Artifact
          run:
            env:
              ARTIFACT_URL: <+artifact.url>
              VERSION: <+artifact.tag>
            output:
              - alias: ARTIFACT_PATH
                name: ARTIFACT_PATH
            script: |-
              WORK_DIR="/tmp/deploy_<+pipeline.executionId>"
              mkdir -p "\${WORK_DIR}"
              curl -fSL -o "\${WORK_DIR}/app-\${VERSION}.tar.gz" "\${ARTIFACT_URL}"
              tar -xzf "\${WORK_DIR}/app-\${VERSION}.tar.gz" -C "\${WORK_DIR}"
              ARTIFACT_PATH="\${WORK_DIR}/package"
            shell: bash
          timeout: 10m
        - id: deploy_to_hosts
          name: Deploy to Hosts
          strategy:
            repeat:
              items: <+infra.hosts>
          template:
            uses: Command
          timeout: 30m
        - id: fetch_instances
          name: Fetch Instances
          template:
            uses: FetchInstanceScript
          timeout: 5m
        - id: cleanup
          name: Cleanup
          run:
            script: |-
              WORK_DIR="/tmp/deploy_<+pipeline.executionId>"
              rm -rf "\${WORK_DIR}"
            shell: bash
          timeout: 5m`,
  },
  {
    name: "parallel-environments-v1",
    resourceType: "pipeline_v1",
    description: "Parallel deployment to multiple environments with environment-specific overrides",
    tags: ["v1", "cd", "parallel", "multi-env", "matrix", "environments"],
    yaml: `pipeline:
  clone:
    enabled: false
  id: multi_env_deploy
  name: Multi-Environment Deploy
  stages:
    - id: Build
      name: Build
      runtime:
        shell: true
      steps:
        - id: build_artifact
          name: Build Artifact
          run:
            output:
              - alias: IMAGE_TAG
                name: IMAGE_TAG
            script: |-
              IMAGE_TAG="<+pipeline.sequenceId>-<+codebase.shortCommitSha>"
            shell: bash
          timeout: 10m
    - parallel:
        stages:
          - environment:
              deploy-to: us_east_cluster
              id: us_east
              name: us-east
            id: Deploy_US_East
            name: Deploy US-East
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
            service: api_service
            steps:
              - id: deploy
                name: Rolling Deploy
                template:
                  uses: k8sRollingDeployStep
                  with:
                    pruning: true
                    skip_dry_run: false
                timeout: 10m
          - environment:
              deploy-to: eu_west_cluster
              id: eu_west
              name: eu-west
            id: Deploy_EU_West
            name: Deploy EU-West
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
            service: api_service
            steps:
              - id: deploy
                name: Rolling Deploy
                template:
                  uses: k8sRollingDeployStep
                  with:
                    pruning: true
                    skip_dry_run: false
                timeout: 10m`,
  },
  {
    name: "gitops-sync-v1",
    resourceType: "pipeline_v1",
    description: "GitOps pipeline that updates manifests in a config repo and syncs via ArgoCD",
    tags: ["v1", "cd", "gitops", "argocd", "sync", "config-repo", "declarative"],
    yaml: `pipeline:
  clone:
    connector: account.github_connector
    enabled: true
    repo: infra-config
  id: gitops_sync
  name: GitOps Sync
  stages:
    - clone:
        enabled: true
      id: Update_Manifests
      name: Update Manifests
      runtime:
        shell: true
      steps:
        - id: update_image_tag
          name: Update Image Tag
          run:
            env:
              IMAGE_TAG: <+pipeline.variables.image_tag>
              APP_NAME: <+pipeline.variables.app_name>
              ENV: <+pipeline.variables.target_env>
            script: |-
              cd environments/\${ENV}/\${APP_NAME}
              sed -i "s|image:.*|image: registry.example.com/\${APP_NAME}:\${IMAGE_TAG}|g" deployment.yaml
              git config user.name "Harness Pipeline"
              git config user.email "pipeline@example.com"
              git add .
              git commit -m "chore: update \${APP_NAME} to \${IMAGE_TAG} in \${ENV}"
              git push origin main
            shell: bash
          timeout: 5m
        - id: argocd_sync
          name: ArgoCD Sync
          run:
            env:
              APP_NAME: <+pipeline.variables.app_name>
              ENV: <+pipeline.variables.target_env>
              ARGOCD_SERVER: <+variable.argocd_server>
            script: |-
              argocd app sync \${APP_NAME}-\${ENV} --server \${ARGOCD_SERVER}
              argocd app wait \${APP_NAME}-\${ENV} --health --timeout 300
            shell: bash
          timeout: 10m
  inputs:
    app_name:
      required: true
      type: string
      value: backend-api
    image_tag:
      required: true
      type: string
      value: latest
    target_env:
      enum:
        - dev
        - staging
        - prod
      required: true
      type: string
      value: dev`,
  },
];

registerExamples(examples);
export default examples;
