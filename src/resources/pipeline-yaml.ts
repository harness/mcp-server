import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("resource:pipeline-yaml");

export function registerPipelineYamlResource(server: McpServer, registry: Registry, client: HarnessClient, config: Config): void {
  const pipelineResourceType = (config.HARNESS_PIPELINE_VERSION ?? "0") === "0" ? "pipeline" : "pipeline_v1";

  const template = new ResourceTemplate("pipeline:///{pipelineId}", {
    list: async () => {
      try {
        const result = await registry.dispatch(client, pipelineResourceType, "list", {
          org_id: config.HARNESS_ORG,
          project_id: config.HARNESS_PROJECT ?? "",
          size: 20,
          page: 0,
        });
        const r = result as { items?: Array<{ identifier?: string; name?: string }> };
        return {
          resources: (r.items ?? [])
            .filter((p) => p.identifier)
            .map((p) => ({
              uri: `pipeline:///${p.identifier}`,
              name: p.name ?? p.identifier!,
            })),
        };
      } catch (err) {
        log.warn("Failed to list pipelines for resource discovery", { error: String(err) });
        return { resources: [] };
      }
    },
  });

  server.registerResource(
    "pipeline-yaml",
    template,
    {
      title: "Pipeline YAML",
      description: "Pipeline YAML definition. Provide orgId, projectId, and pipelineId in the URI path.",
      mimeType: "application/x-yaml",
    },
    async (uri) => {
      const path = uri.pathname.replace(/^\/+/, "");
      const parts = path.split("/");

      // URI format: pipeline:///pipelineId or pipeline:///orgId/projectId/pipelineId
      let orgId = config.HARNESS_ORG;
      let projectId = config.HARNESS_PROJECT ?? "";
      let pipelineId: string;

      if (parts.length >= 3) {
        orgId = parts[0] ?? orgId;
        projectId = parts[1] ?? projectId;
        pipelineId = parts[2] ?? "";
      } else {
        pipelineId = parts[0] ?? "";
      }

      log.info("Fetching pipeline YAML", { pipelineId, orgId, projectId });

      const result = await registry.dispatch(client, pipelineResourceType, "get", {
        pipeline_id: pipelineId,
        org_id: orgId,
        project_id: projectId,
      });

      const data = result as Record<string, unknown>;
      const yamlContent = data?.yamlPipeline ?? data?.yaml ?? JSON.stringify(data, null, 2);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/x-yaml",
          text: String(yamlContent),
        }],
      };
    },
  );
}
