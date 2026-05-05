import { registerExamples } from "./index.js";
import type { ResourceExample } from "./types.js";

const examples: ResourceExample[] = [
  {
    name: "minimal-v1",
    resourceType: "pipeline_v1",
    description: "Minimal v1 pipeline with a single run step",
    tags: ["v1", "minimal", "starter", "ci", "simplified"],
    yaml: `pipeline:
  name: Simple Build
  identifier: simple_build
  stages:
    - name: build
      steps:
        - type: run
          spec:
            shell: sh
            command: |
              echo "Building..."
              npm install
              npm test`,
  },
  {
    name: "agent-pipeline",
    resourceType: "pipeline_v1",
    description: "AI agent pipeline with tools, MCP servers, and skills",
    tags: ["v1", "agent", "ai", "mcp", "tools", "agentic"],
    yaml: `pipeline:
  name: Code Review Agent
  identifier: code_review_agent
  version: 1
  stages:
    - name: review
      steps:
        - type: agent
          spec:
            model: claude-sonnet-4-6
            prompt: "Review the PR for correctness, security, and performance issues"
            tools:
              - name: read_file
              - name: search_code
            mcp_servers:
              - url: https://mcp.harness.io
            rules:
              - "Focus on security vulnerabilities"
              - "Check for breaking API changes"`,
  },
];

registerExamples(examples);
export default examples;
