import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

export const chaosToolset: ToolsetDefinition = {
  name: "chaos",
  displayName: "Chaos Engineering",
  description: "Harness Chaos Engineering — experiments and probes",
  resources: [
    {
      resourceType: "chaos_experiment",
      displayName: "Chaos Experiment",
      description:
        "Chaos experiment definition. Supports list, get, and run action.",
      toolset: "chaos",
      scope: "project",
      identifierFields: ["experiment_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter chaos experiments by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/chaos/experiments/{experimentId}",
      operations: {
        list: {
          method: "POST",
          path: "/chaos/manager/api/experiments",
          queryParams: {
            page: "page",
            limit: "limit",
          },
          bodyBuilder: (input) => ({
            filter: { experimentName: input.search_term },
          }),
          responseExtractor: passthrough,
          description: "List chaos experiments",
        },
        get: {
          method: "GET",
          path: "/chaos/manager/api/experiments/{experimentId}",
          pathParams: { experiment_id: "experimentId" },
          responseExtractor: passthrough,
          description: "Get chaos experiment details",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "/chaos/manager/api/experiments/{experimentId}/run",
          pathParams: { experiment_id: "experimentId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Run a chaos experiment",
          bodySchema: { description: "No body required. Experiment is identified by path parameter.", fields: [] },
        },
      },
    },
    {
      resourceType: "chaos_probe",
      displayName: "Chaos Probe",
      description: "Chaos resilience probe. Supports list and get.",
      toolset: "chaos",
      scope: "project",
      identifierFields: ["probe_id"],
      operations: {
        list: {
          method: "POST",
          path: "/chaos/manager/api/probes",
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          description: "List chaos probes",
        },
        get: {
          method: "GET",
          path: "/chaos/manager/api/probes/{probeId}",
          pathParams: { probe_id: "probeId" },
          responseExtractor: passthrough,
          description: "Get chaos probe details",
        },
      },
    },
    {
      resourceType: "chaos_experiment_template",
      displayName: "Chaos Experiment Template",
      description: "Template for creating chaos experiments. Supports list.",
      toolset: "chaos",
      scope: "project",
      identifierFields: ["template_id"],
      operations: {
        list: {
          method: "GET",
          path: "/chaos/manager/api/experiments/templates",
          responseExtractor: passthrough,
          description: "List chaos experiment templates",
        },
      },
      executeActions: {
        create_from_template: {
          method: "POST",
          path: "/chaos/manager/api/experiments/template",
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          actionDescription: "Create a chaos experiment from a template",
          bodySchema: {
            description: "Chaos experiment from template",
            fields: [
              { name: "name", type: "string", required: true, description: "Experiment name" },
              { name: "templateId", type: "string", required: true, description: "Template ID to create from" },
              { name: "infraId", type: "string", required: false, description: "Chaos infrastructure ID" },
            ],
          },
        },
      },
    },
    {
      resourceType: "chaos_infrastructure",
      displayName: "Chaos Infrastructure",
      description: "Linux infrastructure registered for chaos experiments. Supports list.",
      toolset: "chaos",
      scope: "project",
      identifierFields: ["infra_id"],
      operations: {
        list: {
          method: "GET",
          path: "/chaos/manager/api/infrastructures",
          responseExtractor: passthrough,
          description: "List chaos Linux infrastructures",
        },
      },
    },
    {
      resourceType: "chaos_experiment_variable",
      displayName: "Chaos Experiment Variable",
      description: "Variables for a chaos experiment. Supports list.",
      toolset: "chaos",
      scope: "project",
      identifierFields: ["experiment_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/chaos/experiments/{experimentId}",
      operations: {
        list: {
          method: "GET",
          path: "/chaos/manager/api/experiments/{experimentId}/variables",
          pathParams: { experiment_id: "experimentId" },
          responseExtractor: passthrough,
          description: "List variables for a chaos experiment",
        },
      },
    },
    {
      resourceType: "chaos_experiment_run",
      displayName: "Chaos Experiment Run",
      description: "Result of a chaos experiment run. Supports list and get.",
      toolset: "chaos",
      scope: "project",
      identifierFields: ["experiment_id", "run_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/chaos/experiments/{experimentId}",
      operations: {
        list: {
          method: "POST",
          path: "/chaos/manager/api/experiments/{experimentId}/runs",
          pathParams: { experiment_id: "experimentId" },
          queryParams: {
            page: "page",
            limit: "limit",
          },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          description: "List runs for a chaos experiment",
        },
        get: {
          method: "GET",
          path: "/chaos/manager/api/experiments/{experimentId}/runs/{runId}",
          pathParams: {
            experiment_id: "experimentId",
            run_id: "runId",
          },
          responseExtractor: passthrough,
          description: "Get chaos experiment run result",
        },
      },
    },
    {
      resourceType: "chaos_loadtest",
      displayName: "Chaos Load Test",
      description: "Load test instance. Supports list, get, create, and delete. Run/stop via execute actions.",
      toolset: "chaos",
      scope: "project",
      identifierFields: ["loadtest_id"],
      operations: {
        list: {
          method: "GET",
          path: "/chaos/manager/api/loadtest/instances",
          responseExtractor: passthrough,
          description: "List load test instances",
        },
        get: {
          method: "GET",
          path: "/chaos/manager/api/loadtest/instances/{loadtestId}",
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: "Get load test instance details",
        },
        create: {
          method: "POST",
          path: "/chaos/manager/api/loadtest/instances/sample",
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          description: "Create a sample load test instance",
          bodySchema: {
            description: "Load test instance definition",
            fields: [
              { name: "name", type: "string", required: true, description: "Load test name" },
              { name: "type", type: "string", required: false, description: "Load test type" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/chaos/manager/api/loadtest/instances/{loadtestId}",
          pathParams: { loadtest_id: "loadtestId" },
          responseExtractor: passthrough,
          description: "Delete a load test instance",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "/chaos/manager/api/loadtest/instances/{loadtestId}/run",
          pathParams: { loadtest_id: "loadtestId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Run a load test instance",
          bodySchema: { description: "No body required. Load test is identified by path parameter.", fields: [] },
        },
        stop: {
          method: "POST",
          path: "/chaos/manager/api/loadtest/instances/{loadtestId}/stop",
          pathParams: { loadtest_id: "loadtestId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Stop a running load test",
          bodySchema: { description: "No body required. Load test is identified by path parameter.", fields: [] },
        },
      },
    },
  ],
};
