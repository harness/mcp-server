# Harness MCP Server

The Harness MCP Server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that provides seamless integration with Harness APIs, enabling advanced automation and interaction capabilities for developers and tools.

## Components

### Tools

The server implements several toolsets:

#### Default Toolset

The default toolset contains essential tools from various services:

Toolset Name: `default`

- `get_connector_details`: Get details of a specific connector
- `list_connector_catalogue`: List the Harness connector catalogue
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

#### Pull Requests Toolset

Toolset Name: `pullrequests`

- `get_pull_request`: Get details of a specific pull request
- `list_pull_requests`: List pull requests in a repository
- `get_pull_request_checks`: Get status checks for a specific pull request
- `get_pull_request_activities`: Get activities and comments for a specific pull request
- `create_pull_request`: Create a new pull request

#### Services Toolset

Toolset Name: `service` 

- `get_service`: Get details of a specific service
- `list_services`: List services

#### Environments Toolset

Toolset Name: `environment` 

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
- `get_ccm_commitment_coverage`: Get commitment coverage information for an account in Harness Cloud Cost Management
- `get_ccm_commitment_savings`: Get commitment savings information for an account in Harness Cloud Cost Management
- `get_ccm_commitment_utilisation`: Get commitment utilisation information for an account in Harness Cloud Cost Management broken down by Reserved Instances and Savings Plans in day wise granularity.

#### Database Operations Toolset

Toolset Name: `dbops`

- `get_database_schema_info`: Retrieves metadata about a database schema including its identifier, instance identifier, and database type.

#### Chaos Engineering Toolset

Toolset Name: `chaos`

- `chaos_experiments_list`: List all the chaos experiments for a specific account.
- `chaos_experiment_describe`: Get details of a specific chaos experiment.
- `chaos_experiment_run`:  Run a specific chaos experiment.
- `chaos_experiment_run_result`:  Get the result of a specific chaos experiment run.

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

- `frontend_all_issues_list`: List and filter security issues in Harness STO by target, pipeline, tool, severity, exemption status, and type.


#### Logs Toolset

Toolset Name: `logs`

- `download_execution_logs`: Download logs for a pipeline execution

#### Templates Toolset

Toolset Name: `templates`

- `list_templates`: List templates at a given scope
- `intelligent_template_search`: Find the most relevant templates based on a natural language description.

#### Internal Developer Portal Toolset

Toolset Name: `idp`

- `get_entity`: Get details of a specific entity in the Harness IDP Catalog
- `list_entities`: List entities in the Harness Internal Developer Portal Catalog
- `get_scorecard`: Get details of a specific entity in the Harness IDP Catalog
- `list_scorecards`: List scorecards in the Harness Internal Developer Portal Catalog
- `get_score_summary`: Get Score Summary for Scorecards in the Harness Internal Developer Portal Catalog.
- `get_scores`: Get Scores for Scorecards in the Harness Internal Developer Portal Catalog.

#### Audit Trail Toolset

Toolset Name: `audit`

- `list_user_audits`: Retrieve the complete audit trail for a specified user.


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
go build -o cmd/harness-mcp-server/harness-mcp-server ./cmd/harness-mcp-server
```

3. Run the server:
```bash
HARNESS_API_KEY=your_api_key HARNESS_DEFAULT_ORG_ID=your_org_id HARNESS_DEFAULT_PROJECT_ID=your_project_id ./cmd/harness-mcp-server/harness-mcp-server stdio
```

### Use Docker Image

Alternatively, you can use the pre-built Docker image:

```bash
docker run -i --rm \
  -e HARNESS_API_KEY=your_api_key \
  -e HARNESS_DEFAULT_ORG_ID=your_org_id \
  -e HARNESS_DEFAULT_PROJECT_ID=your_project_id \
  -e HARNESS_BASE_URL=your_base_url \
  harness/mcp-server stdio
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
        "command": "/path/to/harness-mcp-server",
        "args": ["stdio"],
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

```bash
HARNESS_API_KEY=your_api_key HARNESS_ACCOUNT_ID=your_account_id HARNESS_ORG_ID=your_org_id HARNESS_PROJECT_ID=your_project_id ./cmd/harness-mcp-server/harness-mcp-server stdio
```

## Usage with Windsurf

To use the Harness MCP Server with Windsurf:

1. Add the server configuration to your Windsurf config file:

### Using Local Binary

```json
{
  "mcpServers": {
    "harness": {
      "command": "/path/to/harness-mcp-server",
      "args": ["stdio"],
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
        "stdio"
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
      "command": "/path/to/harness-mcp-server",
      "args": ["stdio"],
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
      "command": "/path/to/harness-mcp-server",
      "args": ["stdio"],
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
          "stdio"
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


## Development

### Command Line Arguments

The Harness MCP Server supports the following command line arguments:

- `--toolsets`: Comma-separated list of tool groups to enable, if the list is empty or flag is not set, only default toolset is enabled. Use `--toolsets=all` to enable all available toolsets. Note: This flag is only effective when `--enable-license` is false (the default).
- `--enable-license`: Enable license validation and module-based toolset management (default is false, i.e OSS version). When set to true, toolsets are managed through modules.
- `--enable-modules`: Comma-separated list of modules to enable (only used when `--enable-license` is true). Use `--enable-modules=all` to enable all available modules, or specify individual modules like `--enable-modules=CORE,CI,CD`.
- `--read-only`: Run the server in read-only mode
- `--log-file`: Path to log file for debugging
- `--log-level`: Set the logging level (debug, info, warn, error)
- `--version`: Show version information
- `--help`: Show help message
- `--base-url`: Base URL for Harness (default: "https://app.harness.io")


### Environment Variables

Environment variables are prefixed with `HARNESS_`:

- `HARNESS_API_KEY`: Harness API key (required) - Account ID is automatically extracted from the API key
- `HARNESS_DEFAULT_ORG_ID`: Default Harness organization ID (optional, if not specified it would need to be passed in the request if it's required for that operation)
- `HARNESS_DEFAULT_PROJECT_ID`: Default Harness project ID (optional, if not specified it would need to be passed in the request if it's required for that operation)
- `HARNESS_TOOLSETS`: Comma-separated list of toolsets to enable (default: "all")
- `HARNESS_READ_ONLY`: Set to "true" to run in read-only mode
- `HARNESS_LOG_FILE`: Path to log file
- `HARNESS_LOG_LEVEL`: Set the logging level (debug, info, warn, error)
- `HARNESS_BASE_URL`: Base URL for Harness (default: "https://app.harness.io")

### Authentication

The server uses a Harness API key for authentication. This can be set via the `HARNESS_API_KEY` environment variable.

## Notes for Local Testing

There might be certain tools that are not added in external mode or vice-versa, for local testing, following changes in `pkg/harness/tools.go` need to be done in mcp-server code to enable that certain tool in both internal and external modes.

```
baseURL := "https://localhost:8000"
secret := <SERVICE_SECRET>
```

### Example

```
// registerGenai registers the genai toolset
func registerGenai(config *config.Config, tsg *toolsets.ToolsetGroup) error {

	// Determine the base URL and secret for genai service
	baseURL := "http://localhost:8000"
	secret := <GENAI_SECRET>

	// Create base client for genai with the default timeout
	c, err := CreateClient(baseURL, config, secret, defaultGenaiTimeout)
	if err != nil {
		return err
	}
  .
  .
  .
```

## Debugging

Since MCP servers run over stdio, debugging can be challenging. For the best debugging experience, we strongly recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

You can launch the MCP Inspector with this command:

```bash
npx @modelcontextprotocol/inspector /path/to/harness-mcp-server stdio
```

Upon launching, the Inspector will display a URL that you can access in your browser to begin debugging.
