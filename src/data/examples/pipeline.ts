import { registerExamples } from "./index.js";
import type { ResourceExample } from "./types.js";

const examples: ResourceExample[] = [
  {
    name: "minimal-ci",
    resourceType: "pipeline",
    description: "Minimal CI pipeline with a single build stage running tests",
    tags: ["ci", "build", "test", "minimal", "starter"],
    yaml: `pipeline:
  name: Build and Test
  identifier: build_and_test
  projectIdentifier: <+input>
  orgIdentifier: <+input>
  stages:
    - stage:
        name: Build
        identifier: build
        type: CI
        spec:
          cloneCodebase: true
          execution:
            steps:
              - step:
                  type: Run
                  name: Run Tests
                  identifier: run_tests
                  spec:
                    shell: Sh
                    command: |
                      npm install
                      npm test`,
  },
  {
    name: "deploy-k8s",
    resourceType: "pipeline",
    description: "Deploy to Kubernetes with rolling update strategy",
    tags: ["cd", "deploy", "kubernetes", "k8s", "rolling"],
    yaml: `pipeline:
  name: Deploy to K8s
  identifier: deploy_k8s
  projectIdentifier: <+input>
  orgIdentifier: <+input>
  stages:
    - stage:
        name: Deploy
        identifier: deploy
        type: Deployment
        spec:
          deploymentType: Kubernetes
          service:
            serviceRef: <+input>
          environment:
            environmentRef: <+input>
            infrastructureDefinitions:
              - identifier: <+input>
          execution:
            steps:
              - step:
                  type: K8sRollingDeploy
                  name: Rolling Deploy
                  identifier: rolling_deploy
                  spec:
                    skipDryRun: false
            rollbackSteps:
              - step:
                  type: K8sRollingRollback
                  name: Rollback
                  identifier: rollback
                  spec: {}`,
  },
  {
    name: "docker-build",
    resourceType: "pipeline",
    description: "Build and push Docker image to a container registry",
    tags: ["ci", "docker", "build", "push", "image", "container"],
    yaml: `pipeline:
  name: Docker Build and Push
  identifier: docker_build_push
  projectIdentifier: <+input>
  orgIdentifier: <+input>
  stages:
    - stage:
        name: Build Image
        identifier: build_image
        type: CI
        spec:
          cloneCodebase: true
          execution:
            steps:
              - step:
                  type: BuildAndPushDockerRegistry
                  name: Build and Push
                  identifier: build_and_push
                  spec:
                    connectorRef: <+input>
                    repo: <+input>
                    tags:
                      - latest
                      - <+pipeline.sequenceId>
                    caching: true`,
  },
];

registerExamples(examples);
export default examples;
