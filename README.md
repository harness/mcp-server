# Harness MCP Server

The Harness MCP Server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that provides seamless integration with Harness APIs, enabling advanced automation and interaction capabilities for developers and tools.

## Table of Contents

- [Components](#components)
  - [Tools](#tools)
    - [Default Toolset](#default-toolset)
    - [Pipelines Toolset](#pipelines-toolset)
    - [Pull Requests Toolset](#pull-requests-toolset)
    - [Services Toolset](#services-toolset)
    - [Environments Toolset](#environments-toolset)
    - [Infrastructure Toolset](#infrastructure-toolset)
    - [Connectors Toolset](#connectors-toolset)
    - [Secrets Toolset](#secrets-toolset)
    - [Repositories Toolset](#repositories-toolset)
    - [Registries Toolset](#registries-toolset)
    - [Dashboards Toolset](#dashboards-toolset)
    - [Cloud Cost Management Toolset](#cloud-cost-management-toolset)
    - [Chaos Engineering Toolset](#chaos-engineering-toolset)
    - [Supply Chain Security (SCS) Toolset](#supply-chain-security-scs-toolset)
    - [Security Test Orchestration (STO) Toolset](#security-test-orchestration-sto-toolset)
    - [Logs Toolset](#logs-toolset)
    - [Templates Toolset](#templates-toolset)
    - [Internal Developer Portal Toolset](#internal-developer-portal-toolset)
    - [Audit Trail Toolset](#audit-trail-toolset)
    - [Feature Management and Experimentation (FME) Toolset](#feature-management-and-experimentation-fme-toolset)
    - [Sei Toolset](#sei-toolset)
- [Prerequisites](#prerequisites)
- [Quickstart](#quickstart)
- [Makefile Usage](#makefile-usage)
- [Build from Source](#build-from-source)
- [Use Docker Image](#use-docker-image)
- [Integration with AI Assistants](#integration-with-ai-assistants)
  - [Usage with Gemini CLI](#usage-with-gemini-cli)
  - [Claude Desktop Configuration](#claude-desktop-configuration)
  - [Usage with Claude Code](#usage-with-claude-code)
  - [Usage with Windsurf](#usage-with-windsurf)
  - [Usage with Amazon Q Developer CLI](#usage-with-amazon-q-developer-cli)
  - [Cursor Configuration](#cursor-configuration)
  - [VS Code Configuration](#vs-code-configuration)
- [Development](#development)
  - [Command Line Arguments](#command-line-arguments)
  - [Environment Variables](#environment-variables)
  - [Authentication](#authentication)
- [Debugging](#debugging)

## Components

### Tools

The server implements several toolsets:

#### Default Toolset

The default toolset contains essential tools from various services:

Toolset Name: `default`

- `get_connector_details`: Get details of a specific connector
- `list_connector_catalogue`: List the Harness connector catalogue
- `list_connectors`: List connectors with filtering options
- `list_pipelines`: List pipelines in a repository
- `get_pipeline`: Get details of a specific pipeline
- `get_execution`: Get details of a specific pipeline execution
- `list_executions`: List pipeline executions
- `fetch_execution_url`: Fetch the execution URL for a pipeline execution
- `list_dashboards`: Lists all available Harness dashboards
- `get_dashboard_data`: Retrieves the data from a specific Harness dashboard

#### Pipelines Toolset 

Toolset Name: `pipelines`

- `get_pipeline`: Get details of a specific pipeline
- `list_pipelines`: List pipelines in a repository
- `get_execution`: Get details of a specific pipeline execution
- `list_executions`: List pipeline executions
- `fetch_execution_url`: Fetch the execution URL for a pipeline execution
- `list_input_sets`: List input sets for a pipeline
- `get_input_set`: Get details of a specific input set for a pipeline
- `get_pipeline_summary` : Provides a concise summary of a pipeline's overall structure and execution info highlighting key aspects rather than detailed pipeline definition such as pipeline yaml, external references, etc.
- `list_triggers`: List triggers in a Harness pipeline

#### Pull Requests Toolset

Toolset Name: `pullrequests`

- `get_pull_request`: Get details of a specific pull request
- `list_pull_requests`: List pull requests in a repository
- `get_pull_request_checks`: Get status checks for a specific pull request
- `get_pull_request_activities`: Get activities and comments for a specific pull request
- `create_pull_request`: Create a new pull request

#### Services Toolset

Toolset Name: `services` 

- `get_service`: Get details of a specific service
- `list_services`: List services

#### Environments Toolset

Toolset Name: `environments` 

- `get_environment`: Get details of a specific environment
- `list_environments`: List environments
- `move_environment_configs`: Move environment YAML from inline to remote

#### Infrastructure Toolset

Toolset Name: `infrastructure` 

- `list_infrastructures`: List infrastructure definitions
- `move_infrastructure_configs`: Move infrastructure YAML between inline and remote

#### Connectors Toolset

Toolset Name: `connectors`

- `list_connector_catalogue`: List the Harness connector catalogue
- `get_connector_details`: Get details of a specific connector
- `list_connectors`: List connectors with filtering options

#### Secrets Toolset

Toolset Name: `secrets`

- `list_secrets`: List secrets from Harness with filtering and pagination options.
- `get_secret`: Get a secret by identifier from Harness

#### Repositories Toolset

Toolset Name: `repositories`

- `get_repository`: Get details of a specific repository
- `list_repositories`: List repositories

#### Registries Toolset

Toolset Name: `registries`

- `get_registry`: Get details of a specific registry in Harness artifact registry
- `list_artifact_files`: List files for a specific artifact version in a Harness artifact registry
- `list_artifact_versions`: List artifact versions in a Harness artifact registry
- `list_artifacts`: List artifacts in a Harness artifact registry
- `list_registries`: List registries in Harness artifact registry

#### Dashboards Toolset

Toolset Name: `dashboards`

- `list_dashboards`: Lists all available Harness dashboards
- `get_dashboard_data`: Retrieves the data from a specific Harness dashboard

#### Cloud Cost Management Toolset

Toolset Name: `ccm`

- `get_ccm_overview`: Retrieves the cost overview for a specific account.
- `list_ccm_cost_categories`: List all cost categories names for a specified account.
- `list_ccm_cost_categories_detail`: List all cost categories details for a specified account.
- `get_ccm_cost_category`: Retrieve a cost category detail by Id  for a specified account.
- `list_ccm_perspectives_detail`: List all perspectives for a specified account.
- `get_ccm_perspective`: Retrieves a perspective by Id for a specified account.
- `get_last_period_cost_ccm_perspective`:  Retrieves the cost for a specified period and perspective within a given account.
- `get_last_twelve_months_cost_ccm_perspective`:  Retrieves a monthly cost breakdown for the past 12 months for a perspective within a specified account.
- `create_ccm_perspective`: Creates a perspective for a specified account. 
- `update_ccm_perspective`: Updates a perspective for a specified account. 
- `delete_ccm_perspective`: Deletes a perspective for a specified account. 
- `ccm_perspective_grid`: Query detailed cost perspective data in Harness Cloud Cost Management.
- `ccm_perspective_time_series`: Query detailed cost perspective data, grouped by time in Harness Cloud Cost Management.
- `ccm_perspective_summary_with_budget`: Query a summary of cost perspectives with budget information in Harness Cloud Cost Management, including detailed cost and budget data grouped by time.
- `ccm_perspective_budget`: Query the budget information for a perspective in Harness Cloud Cost Management.
- `get_ccm_metadata`: Retrieves metadata about available cloud connectors, cost data sources, default perspectives, and currency preferences in Harness Cloud Cost Management.
- `ccm_perspective_recommendations`: Returns monthly cost, savings, and a list of open recommendations for a perspective in Harness Cloud Cost Management.
- `ccm_perspective_filter_values`: Returns available filter values for a cost perspective, enabling dynamic discovery of valid options for advanced queries in Harness Cloud Cost Management.
- `list_ccm_recommendations`: Returns a filterable list of cost-optimization recommendations in Harness Cloud Cost Management.
- `list_ccm_recommendations_by_resource_type`: Returns a aggregated statistics of cloud cost optimization recommendations grouped by resource type within a given account in Harness Cloud Cost Management.
- `get_ccm_recommendations_stats`: Returns overall statistics for cloud cost optimization recommendations within a given account in Harness Cloud Cost Management.
- `update_ccm_recommendation_state`: Marks a recommendation as Applied/Open/Ignored in Harness Cloud Cost Management.
- `override_ccm_recommendation_savings`: Overrides savings for a recommendation in Harness Cloud Cost Management.
- `create_jira_ticket_for_ccm_recommendation`: Creates a Jira ticket for a recommendation in Harness Cloud Cost Management.
- `create_service_now_ticket_for_ccm_recommendation`: Creates a Service Now ticket for a recommendation in Harness Cloud Cost Management.
- `get_ec2_recommendation_detail`: Returns ECS Recommendation details for the given Recommendation identifier.
- `get_azure_vm_recommendation_detail`: Returns Azure Vm Recommendation details for the given Recommendation identifier.
- `get_ecs_service_recommendation_detail`: Returns ECS Service Recommendation details for the given Recommendation identifier.
- `get_node_pool_recommendation_detail`: Returns Node Pool Recommendation details for the given Recommendation identifier.
- `get_workload_recommendation_detail`: Returns Workload Recommendation details for the given Recommendation identifier.
- `list_jira_projects`: Returns a list of Jira projects available to create tickets for recommendations in Harness Cloud Cost Management.
- `list_jira_issue_types`: Returns a list of Jira Issue types available to create tickets for recommendations in Harness Cloud Cost Management.
- `get_ccm_anomalies_summary`: Returns a summary of cost anomalies for a specified account in Harness Cloud Cost Management.
- `list_ccm_anomalies`: Returns a list of cost anomalies for a specified account in Harness Cloud Cost Management.
- `list_ccm_ignored_anomalies`: Returns a list of ignored cost anomalies for a specified account in Harness Cloud Cost Management.
- `get_ccm_anomalies_for_perspective`: Returns a anomalies for a perspective and account in Harness Cloud Cost Management.
- `list_all_ccm_anomalies`: Returns a list of all cost anomalies for a specified account in Harness Cloud Cost Management.
- `list_filter_values_ccm_anomalies`: Returns the list of distinct values for all the specified anomalies for a specified account in Harness Cloud Cost Management.
- `report_ccm_anomaly_feedback`: Reports feedback for an anomaly and account in Harness Cloud Cost Management.
- `get_ccm_commitment_coverage`: Get commitment coverage information for an account in Harness Cloud Cost Management.
- `get_ccm_commitment_savings`: Get commitment savings information for an account in Harness Cloud Cost Management.
- `get_ccm_commitment_utilisation`: Get commitment utilisation information for an account in Harness Cloud Cost Management broken down by Reserved Instances and Savings Plans in day wise granularity.
- `get_ccm_estimated_savings`: Get estimated savings information for a cloud account in Harness Cloud Cost Management
- `get_ccm_commitment_ec2_analysis`: Get AWS EC2 commitment analysis for an account in Harness Cloud Cost Management, including RI/SP commitment spend, utilization breakdown, current savings, estimated annualized savings, and ESR.

#### Chaos Engineering Toolset

Toolset Name: `chaos`

- `chaos_experiments_list`: List all the chaos experiments based on matching scope and filters.
- `chaos_experiment_describe`: Get details of a specific chaos experiment.
- `chaos_experiment_run`:  Run a specific chaos experiment.
- `chaos_experiment_run_result`:  Get the result of a specific chaos experiment run.
- `chaos_probes_list`: List all the chaos probes based on matching scope and filters.
- `chaos_probe_describe`: Get details of a specific chaos probe.
- `chaos_create_experiment_from_template`: Create a new chaos experiment from a template.
- `chaos_experiment_template_list`: List all the chaos experiment templates based on matching scope and filters.
- `chaos_experiment_variables_list`: List all the variables for a specific chaos experiment

#### Supply Chain Security (SCS) Toolset

Toolset Name: `scs`

- `list_artifact_sources`: List all artifact sources available in Harness SCS for a specific organization and project.
- `list_artifacts_per_source`: List all artifacts within a specific artifact source.
- `get_artifact_overview`: Get metadata, security findings, SBOM, and compliance status for a specific artifact.
- `get_artifact_chain_of_custody`: Retrieve the full chain of custody (event history) for a specific artifact.
- `fetch_compliance_results_by_artifact`: Fetch compliance results for a specific artifact.
- `get_code_repository_overview`: Get an overview of vulnerabilities, SBOM, compliance issues, and policy violations for a code repository.
- `list_scs_code_repos`: List all code repositories scanned by Harness SCS.

#### Security Test Orchestration (STO) Toolset

Toolset Name: `sto`

- `get_all_security_issues`: List and filter security issues in Harness STO by target, pipeline, tool, severity, exemption status, and type.
- `global_exemptions`: List all global exemptions in Harness STO.
- `promote_exemption`: Promote a specific exemption to a global exemption.
- `approve_exemption`: Approve a specific exemption.

#### Logs Toolset

Toolset Name: `logs`

- `download_execution_logs`: Download logs for a pipeline execution

#### Templates Toolset

Toolset Name: `templates`

- `list_templates`: List templates at a given scope

#### Internal Developer Portal Toolset

Toolset Name: `idp`

- `get_entity`: Get details of a specific entity in the Harness IDP Catalog
- `list_entities`: List entities in the Harness Internal Developer Portal Catalog
- `get_scorecard`: Get details of a specific entity in the Harness IDP Catalog
- `list_scorecards`: List scorecards in the Harness Internal Developer Portal Catalog
- `get_score_summary`: Get Score Summary for Scorecards in the Harness Internal Developer Portal Catalog.
- `get_scores`: Get Scores for Scorecards in the Harness Internal Developer Portal Catalog.
- `get_scorecard_stats` : Get Stats for Scorecards in the Harness Internal Developer Portal i.e. the scores for all the entities that have this scorecard configured.
- `get_scorecard_check` : Get details of a specific check configured in a scorecard. A check is a query performed against a data point for a software component which results in either Pass or Fail.
- `list_scorecard_checks` : List checks in the Harness Internal Developer Portal Catalog. A check is a query performed against a data point for a software component which results in either Pass or Fail.
- `get_scorecard_check_stats` : Get Stats for checks in the Harness Internal Developer Portal i.e. the status (PASS or FAIL) for all the entities that have a scorecard configured which has this check.
- `execute_workflow` : Execute a workflow in the Harness Internal Developer Portal Catalog. This tool takes in the entity metadata of the workflow and a set of values to be used for the execution
- `search_tech_docs` : Searches documentation related to Harness entities in the internal developer portal — including services, APIs, workflows, user groups, and environments — to retrieve information that supports answering or reasoning about those entities. Common examples include debugging issues in a service, understanding an API's configuration, setting up a workflow, managing user groups, or installation steps for a specific environment.

#### Audit Trail Toolset

Toolset Name: `audit`

- `list_user_audits`: Retrieve the complete audit trail for a specified user.

#### Feature Management and Experimentation (FME) Toolset

Toolset Name: `fme`

- `list_fme_workspaces`: List all FME workspaces
- `list_fme_environments`: List environments for a specific workspace
- `list_fme_feature_flags`: List feature flags for a specific workspace
- `get_fme_feature_flag_definition`: Get the definition of a specific feature flag in an environment

#### SEI Toolset

Toolset Name: `sei`

- `sei_productivity_feature_metrics`: Get productivity metrics for a collection
- `sei_efficiency_lead_time`: Get lead time for a project
- `sei_deployment_frequency`: Get deployment frequency metrics for a project
- `sei_change_failure_rate`: Get change failure rate metrics for a project
- `sei_mttr`: Get Mean Time to Restore metrics for a project
- `sei_deployment_frequency_drilldown`: Get deployment frequency drilldown data for detailed pipeline executions
- `sei_change_failure_rate_drilldown`: Get change failure rate drilldown data for detailed deployment records with failure status
- `sei_get_team`: Get team information by team reference ID
- `sei_get_teams_list`: Get list of teams with pagination
- `sei_get_team_integrations`: Get team integrations by team reference ID
- `sei_get_team_developers`: Get team developers by team reference ID
- `sei_get_team_integration_filters`: Get team integration filters by team reference ID
- `sei_get_org_trees`: Get organization trees with pagination
- `sei_get_org_tree_by_id`: Get a specific organization tree by ID
- `sei_get_org_tree_efficiency_profile`: Get efficiency profile reference ID for an organization tree
- `sei_get_org_tree_productivity_profile`: Get productivity profile reference ID for an organization tree
- `sei_get_org_tree_business_alignment_profile`: Get business alignment profile reference ID for an organization tree
- `sei_get_org_tree_integrations`: Get integrations associated with an organization tree
- `sei_get_org_tree_teams`: Get team hierarchy for an organization tree
- `sei_get_ba_all_profiles`: Get all BA profiles
- `sei_get_ba_insight_metrics`: Get BA insight metrics
- `sei_get_ba_insight_summary`: Get BA insight summary
- `sei_get_ba_drilldown_data`: Get BA drilldown data

## Prerequisites

1. You will need to have Go 1.23 or later installed on your system.
2. A Harness API key for authentication.

## Quickstart

## Makefile Usage

This project provides a `Makefile` to simplify common development tasks. The main targets are:

- `make build` – Build the mcp-server binary with version information embedded.
- `make init` – Set up git hooks and submodules for pre-commit checks.
- `make dep` – Download Go module dependencies.
- `make tools` – Install tools required for the build (if any are specified).
- `make format` – Format Go code using goimports and gci.

You can run any of these commands from the project root. For example:

```sh
make build
make format
```


### Build from Source

1. Clone the repository:
```bash
git clone https://github.com/harness/mcp-server.git
cd mcp-server
```

2. Build the binary:
```bash
go build -o external/cmd/harness-mcp-server/harness-mcp-server ./external/cmd/harness-mcp-server
```

3. Run the server:

To run in stdio mode:
```bash
HARNESS_API_KEY="<PAT>" HARNESS_BASE_URL="https://app.harness.io" ./external/cmd/harness-mcp-server/harness-mcp-server stdio
```

Optional environment variables:
1. HARNESS_DEFAULT_ORG_ID
2. HARNESS_DEFAULT_PROJECT_ID
3. HARNESS_TOOLSETS - Comma separated list of toolsets to enable. For e.g. HARNESS_TOOLSETS="pipelines,sei,scs,sto". If not specified, ONLY the default toolset is enabled.

To run in http mode:
```bash
HARNESS_API_KEY="<PAT>" HARNESS_BASE_URL="https://app.harness.io" ./external/cmd/harness-mcp-server/harness-mcp-server http-server
```

Optional environment variables:
1. HARNESS_TOOLSETS - Comma separated list of toolsets to enable. For e.g. HARNESS_TOOLSETS="pipelines,sei,scs,sto". If not specified, ONLY the default toolset is enabled.

### Use Docker Image

#### Stdio mode
Alternatively, you can use the pre-built Docker image:

```bash
docker run -i --rm \
  -e HARNESS_API_KEY="<PAT>" \
  -e HARNESS_BASE_URL="https://app.harness.io" \
  harness/mcp-server stdio
```

Optional environment variables:

1. HARNESS_DEFAULT_ORG_ID
2. HARNESS_DEFAULT_PROJECT_ID
3. HARNESS_TOOLSETS - Comma separated list of toolsets to enable. For e.g. HARNESS_TOOLSETS="pipelines,sei,scs,sto". If not specified, ONLY the default toolset is enabled.

#### Http mode
Alternatively, you can use the pre-built Docker image and run the server in http-mode locally:

```bash
docker run -i --rm \
  -e HARNESS_API_KEY="<PAT>" \
  -e HARNESS_BASE_URL="https://app.harness.io" \
  harness/mcp-server http-server
```

Optional environment variables:

1. HARNESS_TOOLSETS - Comma separated list of toolsets to enable. For e.g. HARNESS_TOOLSETS="pipelines,sei,scs,sto". If not specified, ONLY the default toolset is enabled.

## Integration with AI Assistants

### Usage with Gemini CLI

Add the server configuration to your Gemini config file at: `~/.gemini/settings.json`

```json
{
  "theme": "Default",
  "selectedAuthType": "oauth-personal",
  "mcpServers": {
    "Harness": {
      "command": "/path/to/harness-mcp-server",  // ${workspaceFolder}/external/cmd/harness-mcp-server
      "args": ["stdio"],  // or ["http-server]
      "env": {
        "HARNESS_API_KEY": "<YOUR_API_KEY>",
        "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
        "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>",
      }
    }
  }
}
```

### Usage with Gemini CLI Extensions

You will need to run the following command to install the Harness MCP as an extension:

```sh
gemini extensions install https://github.com/harness/mcp-server
```

Then you will need to set the environment variables for the extension:

```sh
export HARNESS_API_KEY="your_api_key_here"
```

Launch Gemini and start asking questions about Harness!

```sh
gemini
```


### Claude Desktop Configuration

On MacOS: `~/Library/Application\ Support/Claude/claude_desktop_config.json`  
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

<details>
  <summary>Server Configuration</summary>
  
  ```json
  {
    "mcpServers": {
      "harness": {
        "command": "/path/to/harness-mcp-server",  // ${workspaceFolder}/external/cmd/harness-mcp-server
        "args": ["stdio"],  // or ["http-server"]
        "env": {
          "HARNESS_API_KEY": "<YOUR_API_KEY>",
          "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
          "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>"
        }
      }
    }
  }
  ```
</details>

## Usage with Claude Code

Add the server configuration to your Claude config file at: `~/.claude.json`

```json
{
  "mcpServers": {
    "Harness": {
      "command": "/path/to/harness-mcp-server",  // ${workspaceFolder}/external/cmd/harness-mcp-server
      "args": ["stdio"],  // or ["http-server"]
      "env": {
        "HARNESS_API_KEY": "<YOUR_API_KEY>",
        "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
        "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>",
        "HARNESS_BASE_URL": "<YOUR_BASE_URL>"
      }
    }
  }
}
```

## Usage with Windsurf

To use the Harness MCP Server with Windsurf:

1. Add the server configuration to your Windsurf config file:

### Using Local Binary

```json
{
  "mcpServers": {
    "harness": {
      "command": "/path/to/harness-mcp-server",  // ${workspaceFolder}/external/cmd/harness-mcp-server
      "args": ["stdio"],  // or ["http-server"]
      "env": {
        "HARNESS_API_KEY": "<YOUR_API_KEY>",
        "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
        "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>",
        "HARNESS_BASE_URL": "<YOUR_BASE_URL>"
      }
    }
  }
}
```

### Using Docker Image

```json
{
  "mcpServers": {
    "harness": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "HARNESS_API_KEY",
        "-e",
        "HARNESS_DEFAULT_ORG_ID",
        "-e",
        "HARNESS_DEFAULT_PROJECT_ID",
        "-e",
        "HARNESS_BASE_URL",
        "harness/mcp-server",
        "stdio"                    // or "http-server"
      ],
      "env": {
        "HARNESS_API_KEY": "<YOUR_API_KEY>",
        "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
        "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>",
        "HARNESS_BASE_URL": "<YOUR_BASE_URL>"
      }
    }
  }
}
```
## Usage with Amazon Q Developer CLI

To use the Harness MCP Server with Amazon Q Developer CLI:

1. Add the server configuration to your Amazon Q config file at: `~/.aws/amazonq/mcp.json`  

### Using Local Binary

```json
{
  "mcpServers": {
    "harness": {
      "command": "/path/to/harness-mcp-server",  // ${workspaceFolder}/external/cmd/harness-mcp-server
      "args": ["stdio"],  // or ["http-server"]
      "env": {
        "HARNESS_API_KEY": "<YOUR_API_KEY>",
        "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
        "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>",
        "HARNESS_BASE_URL": "<YOUR_BASE_URL>"
      }
    }
  }
}
```

### Cursor Configuration

```json
{
  "mcpServers": {
    "harness": {
      "command": "/path/to/harness-mcp-server",  // ${workspaceFolder}/external/cmd/harness-mcp-server
      "args": ["stdio"],  // or ["http-server"]
      "env": {
        "HARNESS_API_KEY": "your_api_key",
        "HARNESS_DEFAULT_ORG_ID": "your_org_id",
        "HARNESS_DEFAULT_PROJECT_ID": "your_project_id",
        "HARNESS_BASE_URL": "<if-needed>"
      }
    }
  }
}
```

[Cursor MCP Guide](https://docs.cursor.com/context/model-context-protocol#configuring-mcp-servers)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/install-mcp?name=harness&config=eyJjb21tYW5kIjoiZG9ja2VyIHJ1biAtaSAtLXJtIC1lIEhBUk5FU1NfQVBJX0tFWSAtZSBIQVJORVNTX0RFRkFVTFRfT1JHX0lEIC1lIEhBUk5FU1NfREVGQVVMVF9QUk9KRUNUX0lEIC1lIEhBUk5FU1NfQkFTRV9VUkwgaGFybmVzcy9tY3Atc2VydmVyIHN0ZGlvIiwiZW52Ijp7IkhBUk5FU1NfQVBJX0tFWSI6IjxZT1VSX0FQSV9LRVk%2BIiwiSEFSTkVTU19ERUZBVUxUX09SR19JRCI6IjxZT1VSX09SR19JRD4iLCJIQVJORVNTX0RFRkFVTFRfUFJPSkVDVF9JRCI6IjxZT1VSX1BST0pFQ1RfSUQ%2BIiwiSEFSTkVTU19CQVNFX1VSTCI6IjxZT1VSX0JBU0VfVVJMPiJ9fQ%3D%3D)

### VS Code Configuration

```json
{
  "mcp": {
    "servers": {
      "harness": {
        "command": "docker",
        "args": [
          "run",
          "-i",
          "--rm",
          "-e",
          "HARNESS_API_KEY",
          "-e",
          "HARNESS_DEFAULT_ORG_ID",
          "-e",
          "HARNESS_DEFAULT_PROJECT_ID",
          "-e",
          "HARNESS_BASE_URL",
          "harness/mcp-server",
          "stdio"       // or "http-server"
        ],
        "env": {
          "HARNESS_API_KEY": "<YOUR_API_KEY>",
          "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
          "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>",
          "HARNESS_BASE_URL": "<YOUR_BASE_URL>"
        }
      }
    }
  }
}

```

[VS Code MCP Guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)

## Tool Usage Guide

### Download Execution Logs

#### Using Docker:

We need to mount the logs directory to the container to download the logs.

```bash
docker run -d --name mcp-server -p 8080:8080 -v /path/to/logs/in/host:/path/in/container harness/mcp-server --output-dir=/path/in/container
```
This ensures that the logs downloaded to container are accessible in the host.

Example:

```bash
docker run -d --name mcp-server -p 8080:8080 -v /Users/testuser/logs:/logs harness/mcp-server --output-dir=/logs
```

Sample MCP Configuration:

```bash
{
  "mcpServers": {
    "harness": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/Users/testuser/logs:/logs",
        "-e",
        "HARNESS_MCP_USER_PAT",
        "-e",
        "HARNESS_DEFAULT_ORG_ID",
        "-e",
        "HARNESS_DEFAULT_PROJECT_ID",
        "-e",
        "HARNESS_MCP_BASE_URL",
        "harness/mcp-server",
        "stdio",
        "--output-dir=/logs", #/path/in/container
        "--toolsets=logs",
        "--api-key="
      ],
      "env": {
        "HARNESS_MCP_USER_PAT": "<YOUR_API_KEY>",
        "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
        "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>",
        "HARNESS_MCP_BASE_URL": "<YOUR_BASE_URL>"
      }
    }
  }
}
```

Example Tool Input:

```json
{
  "logs_directory": "pipeline-logs",
  "org_id": "<YOUR_ORG_ID>",
  "plan_execution_id": "<YOUR_PLAN_EXECUTION_ID>",
  "project_id": "<YOUR_PROJECT_ID>"
}
```

Sample Response:

```json
Files downloaded to : /Users/testuser/logs/pipeline-logs/logs-<YOUR_PLAN_EXECUTION_ID>/logs.zip
```

### Using Local Binary:

Example configuration:

```json
"args": ["stdio", "--toolsets=logs", "--api-key=", "--output-dir=/Users/testuser/log-files"]
```

Example Tool Input:

```json
{
  "logs_directory": "logs1",
  "project_id": "<YOUR_PROJECT_ID>",
  "plan_execution_id": "<YOUR_PLAN_EXECUTION_ID>",
  "org_id": "<YOUR_ORG_ID>"
}
```

Sample Response:

```json
Files downloaded to : /Users/testuser/log-files/logs1/logs-<YOUR_PLAN_EXECUTION_ID>/logs.zip
```

## Development

### Command Line Arguments

The Harness MCP Server supports the following command line arguments:

- `--toolsets`: Comma-separated list of tool groups to enable, if the list is empty or flag is not set, only default toolset is enabled. Use `--toolsets=all` to enable all available toolsets. Note: This flag is only effective when `--enable-license` is false (the default).
- `--enable-license`: Enable license validation and module-based toolset management (default is false, i.e OSS version). When set to true, toolsets are managed through modules.
- `--read-only`: Run the server in read-only mode
- `--log-file`: Path to log file for debugging
- `--log-level`: Set the logging level (debug, info, warn, error)
- `--version`: Show version information
- `--help`: Show help message
- `--base-url`: Base URL for Harness (default: "https://app.harness.io")
- `--output-dir`: Directory where the tool writes output files (e.g., pipeline logs)


### Environment Variables

Environment variables are prefixed with `HARNESS_`:

- `HARNESS_API_KEY`: Harness API key (required) - Account ID is automatically extracted from the API key
- `HARNESS_DEFAULT_ORG_ID`: Default Harness organization ID (optional, if not specified it would need to be passed in the request if it's required for that operation)
- `HARNESS_DEFAULT_PROJECT_ID`: Default Harness project ID (optional, if not specified it would need to be passed in the request if it's required for that operation)
- `HARNESS_TOOLSETS`: Comma-separated list of toolsets to enable (default: "default")
- `HARNESS_READ_ONLY`: Set to "true" to run in read-only mode
- `HARNESS_LOG_FILE`: Path to log file
- `HARNESS_LOG_LEVEL`: Set the logging level (debug, info, warn, error)
- `HARNESS_BASE_URL`: Base URL for Harness (default: "https://app.harness.io")

### Authentication

The server uses a Harness API key for authentication. This can be set via the `HARNESS_API_KEY` environment variable.

#### Parameters:

- `text`: The text to display on the button
- `action`: The action to perform (currently supports `OPEN_ENTITY_NEW_TAB`)
- `data`: Contains navigation information
  - `pageName`: The page to navigate to (e.g., `ExecutionPipelineView`, `PipelineStudio`, etc.)
  - `metadata`: Key-value pairs needed for the target page (e.g., `{"executionId": "abc123", "pipelineId": "xyz789"}`)

#### Example:

```go
actionData := `{"actions": [{"text": "View Pipeline", "action": "OPEN_ENTITY_NEW_TAB", "data": {"pageName": "PipelineStudio", "metadata": {"id": "pipeline-id"}}}]}`
```

#### Alternative: Quick Prompts

If you provide an array of strings instead of the actions object, these strings will be added to the message box as quick prompts that users can click on:

```go
// Add quick prompts to the message box
quickPrompts := `["Show me pipeline details", "List recent executions", "Analyze performance"]`
```

## Debugging

Since MCP servers run over stdio, debugging can be challenging. For the best debugging experience, we strongly recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

You can launch the MCP Inspector with this command:

```bash
npx @modelcontextprotocol/inspector /path/to/harness-mcp-server stdio
```

Upon launching, the Inspector will display a URL that you can access in your browser to begin debugging.

## Testing

### Running E2E Tests

The project includes end-to-end (E2E) tests that validate the integration with Harness services. To run these tests:

1. Set up the required environment variables:

```bash
export HARNESS_MCP_SERVER_E2E_TOKEN=<your_harness_api_token>
export HARNESS_MCP_SERVER_E2E_ACCOUNT_ID=<your_account_id>  
export HARNESS_MCP_SERVER_E2E_ORG_ID=<your_org_id>          
export HARNESS_MCP_SERVER_E2E_PROJECT_ID=<your_project_id>  
export HARNESS_MCP_SERVER_E2E_BASE_URL=<base_url>          
```

2. Run the E2E tests using the Go test command with the e2e build tag:

```bash
go test -tags=e2e ./test/e2e/... -v
```

3. To run specific E2E tests, use the `-run` flag:

```bash
go test -tags=e2e ./test/e2e/... -v -run TestPipelineWorkflow
```

4. In VS Code, you can run the E2E tests directly using the launch.json configuration. Simply open the Run and Debug view, select the E2E test configuration from the dropdown menu, and click the Run button.

The E2E tests create an in-process MCP client that communicates with the Harness API using your provided credentials.
