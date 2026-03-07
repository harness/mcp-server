import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerBuildDeployAppPrompt } from "../../src/prompts/build-deploy-app.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerBuildDeployAppPrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

describe("build-deploy-app prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "build-deploy-app");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("End-to-end workflow");
  });

  it("has the correct arguments", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "build-deploy-app")!;

    const argNames = prompt.arguments!.map((a) => a.name);
    expect(argNames).toContain("repoUrl");
    expect(argNames).toContain("imageName");
    expect(argNames).toContain("projectId");
    expect(argNames).toContain("namespace");

    const repoUrl = prompt.arguments!.find((a) => a.name === "repoUrl")!;
    expect(repoUrl.required).toBe(true);

    const imageName = prompt.arguments!.find((a) => a.name === "imageName")!;
    expect(imageName.required).toBe(true);

    const projectId = prompt.arguments!.find((a) => a.name === "projectId")!;
    expect(projectId.required).toBe(false);

    const namespace = prompt.arguments!.find((a) => a.name === "namespace")!;
    expect(namespace.required).toBe(false);
  });

  it("returns workflow text with repo URL and image name interpolated", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "build-deploy-app",
      arguments: {
        repoUrl: "https://github.com/acme/webapp",
        imageName: "docker.io/acme/webapp",
      },
    });

    expect(result.messages).toHaveLength(1);
    const text = result.messages[0].content as { type: string; text: string };
    expect(text.type).toBe("text");
    expect(text.text).toContain("https://github.com/acme/webapp");
    expect(text.text).toContain("docker.io/acme/webapp");
  });

  it("includes all workflow phases", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "build-deploy-app",
      arguments: {
        repoUrl: "https://github.com/acme/webapp",
        imageName: "docker.io/acme/webapp",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    // Phase 1: Local Discovery
    expect(text).toContain("Phase 1: Local Discovery");
    expect(text).toContain("Clone & verify the repo");
    expect(text).toContain("Scan for Dockerfile");
    expect(text).toContain("Analyze the application");
    expect(text).toContain("Scan for existing Kubernetes manifests");

    // Phase 2: CI Pipeline
    expect(text).toContain("Phase 2: CI Pipeline");
    expect(text).toContain("Check existing Harness resources");
    expect(text).toContain("Ensure connectors exist");
    expect(text).toContain("Generate CI pipeline YAML");
    expect(text).toContain("CI FAILURE RETRY LOOP (up to 5 attempts)");

    // Phase 3: CD Pipeline
    expect(text).toContain("Phase 3: CD Pipeline");
    expect(text).toContain("Prepare Kubernetes manifests");
    expect(text).toContain("Create Harness service & environment");
    expect(text).toContain("Generate CD pipeline YAML");
    expect(text).toContain("CD FAILURE RETRY LOOP (up to 3 attempts)");

    // Verify & report
    expect(text).toContain("Success: Verify & report");
  });

  it("includes retry and failure recovery instructions", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "build-deploy-app",
      arguments: {
        repoUrl: "https://github.com/acme/webapp",
        imageName: "docker.io/acme/webapp",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    // CI retry loop details
    expect(text).toContain("up to 5 attempts");
    expect(text).toContain("The CI build has failed 5 times");
    expect(text).toContain("harness_update");

    // CD retry loop details
    expect(text).toContain("up to 3 attempts");
    expect(text).toContain("The deployment has failed 3 times");
    expect(text).toContain("manually update some configuration in Harness");
    expect(text).toContain("deep links");
  });

  it("references correct MCP tools", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "build-deploy-app",
      arguments: {
        repoUrl: "https://github.com/acme/webapp",
        imageName: "docker.io/acme/webapp",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("harness_list");
    expect(text).toContain("harness_describe");
    expect(text).toContain("harness_create");
    expect(text).toContain("harness_execute");
    expect(text).toContain("harness_status");
    expect(text).toContain("harness_get");
    expect(text).toContain("harness_update");
  });

  it("interpolates optional projectId and namespace", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "build-deploy-app",
      arguments: {
        repoUrl: "https://github.com/acme/webapp",
        imageName: "docker.io/acme/webapp",
        projectId: "my-project",
        namespace: "production",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain('project_id="my-project"');
    expect(text).toContain("production");
    expect(text).toContain("Project: my-project");
  });

  it("uses default namespace when not provided", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "build-deploy-app",
      arguments: {
        repoUrl: "https://github.com/acme/webapp",
        imageName: "docker.io/acme/webapp",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain("K8s namespace: default");
  });

  it("includes manifest discovery paths", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "build-deploy-app",
      arguments: {
        repoUrl: "https://github.com/acme/webapp",
        imageName: "docker.io/acme/webapp",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    // Should mention common K8s manifest directories
    expect(text).toContain("k8s/");
    expect(text).toContain("kubernetes/");
    expect(text).toContain("deploy/");
    expect(text).toContain("manifests/");
    expect(text).toContain("helm/");
  });
});
