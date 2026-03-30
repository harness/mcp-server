# Harness: build, push, and deploy `harness-mcp-v2`

This repo includes:

| File | Purpose |
|------|---------|
| [harness-mcp-v2-ci.yaml](./harness-mcp-v2-ci.yaml) | CI only — typecheck, `tsc`, Vitest |
| [harness-mcp-v2-build-deploy.yaml](./harness-mcp-v2-build-deploy.yaml) | Same CI steps + **Docker build & push** (default: **Harness Artifact Registry**) |
| [../Dockerfile](../Dockerfile) | Multi-stage image; HTTP transport on **3000**; `/health` |
| [../k8s/](../k8s/) | Deployment (2 replicas), Service, ConfigMap, Secret, Namespace |

## 1. Import the pipeline

In Harness: **Pipelines → Create pipeline → Import from YAML**, or store this file in Git and use **Pipeline Studio → YAML**.

Adjust under `properties.ci.codebase` if your Git connector or repo name differs (`connectorRef`, `repoName`, `branch`).

## 2. Push image — choose registry type

### A. Harness Artifact Registry (default in YAML)

The `BuildAndPushDockerRegistry` step uses **`registryRef`** and **`repo`** as pipeline inputs. It must **not** include `connectorRef`.

When you run the pipeline, provide:

- **registryRef** — your HAR registry resource (e.g. `org/myregistry` style identifier from Harness)
- **repo** — image repository name in that registry (e.g. `harness-mcp-v2`)

List registries: Harness UI **Artifact Registries**, or MCP `harness_list` with `resource_type="registry"`.

### B. Third-party registry (Docker Hub, ECR, GCR, ACR, …)

Replace the **entire** `build_and_push_har` step with this block. Use **`connectorRef`** only — **no** `registryRef`.

```yaml
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
                    dockerfile: Dockerfile
                    context: .
```

Create a **Docker Registry** connector in Harness if you do not already have one.

## 3. Deploy to Kubernetes (CD)

The pipeline YAML here stops after **pushing the image**. Full CD needs a Harness **Service** (Kubernetes manifests from Git) and **Environment** (cluster + namespace), then a **Deployment** pipeline stage — usually created in Harness UI or a second YAML that references `serviceRef` / `environmentRef`.

Recommended flow:

1. Ensure cluster credentials exist as a Harness **Kubernetes** connector.
2. Create a **Service** → deployment type **Kubernetes** → manifest source = same Git connector, path `k8s/` (apply order: namespace, configmap, secret, deployment, service).
3. Bind the **primary artifact** to the image produced by this CI pipeline (or to the same registry/repo/tags you push).
4. Point the Deployment manifest image at the pipeline artifact (e.g. `<+artifact.image>` in the manifest Harness uses for deploy), or maintain tags and use `kubectl set image` after push.

Local/dev manifests use `image: harness-mcp-server:latest` in [k8s/deployment.yaml](../k8s/deployment.yaml). For Harness-driven deploys, override that image with your registry path and tag (`latest` or `<+pipeline.sequenceId>`).

## 4. Secrets for runtime

The container expects `HARNESS_API_KEY` (and optionally `HARNESS_ACCOUNT_ID` for non-PAT keys). Store these in **Harness secrets** and wire them into the Kubernetes Service / workload, or keep using [k8s/secret.yaml](../k8s/secret.yaml) for non-Harness-managed clusters (do not commit real values).
