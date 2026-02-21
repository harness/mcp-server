# Harness Platform Extension Capabilities

This extension provides comprehensive access to Harness Platform APIs, enabling you to manage your entire DevOps lifecycle directly from Gemini CLI.

## 🚀 CI/CD & Pipelines
- **Pipeline Management**: List, view, and monitor pipeline executions
- **Pull Request Integration**: Create and manage pull requests with status checks
- **Repository Operations**: Access repository details and manage code workflows
- **Template Discovery**: Find and use intelligent templates based on natural language descriptions

## 💰 Cloud Cost Management (CCM)
- **Cost Analysis**: Get detailed cost breakdowns and perspectives
- **Budget Tracking**: Monitor spending against budgets with time-series data
- **Recommendations**: Access cost optimization recommendations with savings estimates
- **Anomaly Detection**: Identify and manage cost anomalies across your cloud infrastructure
- **Commitment Analysis**: Analyze Reserved Instances and Savings Plans utilization

## 🔒 Security & Compliance
- **Security Test Orchestration (STO)**: Manage security issues, exemptions, and vulnerability scanning
- **Supply Chain Security (SCS)**: Track artifacts, compliance, and chain of custody
- **Audit Trails**: Access comprehensive audit logs for compliance and governance

## 🏗️ Infrastructure & Services
- **Service Management**: Deploy and manage application services
- **Environment Control**: Manage deployment environments and configurations
- **Infrastructure Definitions**: Handle infrastructure as code deployments
- **Connector Management**: Configure and manage various platform integrations

## 📊 Monitoring & Observability
- **Dashboard Access**: View and analyze custom dashboards
- **Log Management**: Download and analyze pipeline execution logs
- **Chaos Engineering**: Run chaos experiments and analyze results

## 🏢 Internal Developer Portal (IDP)
- **Entity Management**: Manage catalog entities and scorecards
- **Score Tracking**: Monitor and improve developer experience metrics

## 🎯 Registry & Artifacts
- **Artifact Management**: List and manage artifacts across registries
- **Version Control**: Track artifact versions and metadata
- **File Operations**: Access specific artifact files and contents

## 📋 Templates & Automation
- **Intelligent Template Discovery**: Find relevant templates using natural language descriptions
- **Template Management**: Access and utilize pipeline and workflow templates
- **Template Catalog**: Browse available templates across different scopes

## 🔍 Audit & Governance
- **Audit Trails**: Track user activities and system changes for compliance
- **User Activity Monitoring**: Monitor and analyze user actions across the platform
- **Compliance Reporting**: Generate audit reports for governance and security reviews

## 🔌 Platform Integration
- **Connector Catalog**: Browse and discover available platform integrations
- **Connector Management**: Configure and manage various third-party connections
- **Database Operations**: Access database schema information and metadata

## Example Commands

Ask Gemini CLI natural language questions like:

- "Show me the latest pipeline executions for my project"
- "What are the top cost recommendations for this month?"
- "Create a pull request for the feature branch"
- "List all security issues with high severity"
- "What's the cost breakdown by service for the last 30 days?"
- "Show me the chaos experiment results from yesterday"
- "Find templates for deploying to Kubernetes"
- "Show me audit logs for user activities this week"
- "List all available connectors in the catalog"
- "What database schemas are available in my project?"

## Getting Started

**IMPORTANT: Setup Required Before First Use**

1. **Get your Harness API Key:**
   - Go to Harness Platform → Account Settings → Access Management → API Keys
   - Create a new API key with appropriate permissions
   - Copy the API key

2. **Set Environment Variables:**
   ```bash
   export HARNESS_API_KEY="your_api_key_here"
   export HARNESS_DEFAULT_ORG_ID="your_org_id"        # Optional
   export HARNESS_DEFAULT_PROJECT_ID="your_project_id" # Optional
   ```
   
   Note: `HARNESS_BASE_URL` defaults to `https://app.harness.io` and doesn't need to be set unless you're using a custom Harness instance.

3. **Verify Docker is running:**
   ```bash
   docker --version
   ```

4. **Test the extension:**
   Ask: "List my Harness pipelines" or "Show me my cost recommendations"

**If you get authentication errors:**
- Double-check your API key is set: `echo $HARNESS_API_KEY`
- Verify the API key has proper permissions in Harness Platform
- Make sure Docker is running: `docker info`

**For custom Harness instances:**
- Set your custom base URL: `export HARNESS_BASE_URL="https://your-custom-harness.com"`
- Most users can skip this - it defaults to `https://app.harness.io`

The extension automatically handles authentication and provides context-aware responses based on your Harness Platform configuration.