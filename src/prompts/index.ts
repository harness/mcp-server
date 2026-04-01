import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerDebugPipelinePrompt } from "./debug-pipeline.js";
import { registerCreatePipelinePrompt } from "./create-pipeline.js";
import { registerCreateAgentPrompt } from "./create-agent.js";
import { registerOptimizeCostsPrompt } from "./optimize-costs.js";
import { registerSecurityReviewPrompt } from "./security-review.js";
import { registerOnboardServicePrompt } from "./onboard-service.js";

// DevOps prompts
import { registerDoraMetricsPrompt } from "./dora-metrics.js";
import { registerSetupGitopsPrompt } from "./setup-gitops.js";
import { registerChaosResiliencePrompt } from "./chaos-resilience.js";
import { registerFeatureFlagRolloutPrompt } from "./feature-flag-rollout.js";
import { registerMigrateToTemplatePrompt } from "./migrate-to-template.js";
import { registerDelegateHealthPrompt } from "./delegate-health.js";
import { registerDeveloperScorecardPrompt } from "./developer-scorecard.js";

// FinOps prompts
import { registerCloudCostBreakdownPrompt } from "./cloud-cost-breakdown.js";
import { registerCommitmentUtilizationPrompt } from "./commitment-utilization.js";
import { registerCostAnomalyPrompt } from "./cost-anomaly.js";
import { registerRightsizingPrompt } from "./rightsizing.js";

// DevSecOps prompts
import { registerVulnerabilityTriagePrompt } from "./vulnerability-triage.js";
import { registerSbomCompliancePrompt } from "./sbom-compliance.js";
import { registerSupplyChainAuditPrompt } from "./supply-chain-audit.js";
import { registerExemptionReviewPrompt } from "./exemption-review.js";
import { registerAccessControlAuditPrompt } from "./access-control-audit.js";

// Harness Code prompts
import { registerCodeReviewPrompt } from "./code-review.js";
import { registerPrSummaryPrompt } from "./pr-summary.js";
import { registerBranchCleanupPrompt } from "./branch-cleanup.js";

// Approval prompts
import { registerPendingApprovalsPrompt } from "./pending-approvals.js";

// Deployment workflow prompts
import { registerBuildDeployAppPrompt } from "./build-deploy-app.js";

export function registerAllPrompts(server: McpServer): void {
  // Existing prompts
  registerDebugPipelinePrompt(server);
  registerCreatePipelinePrompt(server);
  registerCreateAgentPrompt(server);
  registerOptimizeCostsPrompt(server);
  registerSecurityReviewPrompt(server);
  registerOnboardServicePrompt(server);

  // DevOps
  registerDoraMetricsPrompt(server);
  registerSetupGitopsPrompt(server);
  registerChaosResiliencePrompt(server);
  registerFeatureFlagRolloutPrompt(server);
  registerMigrateToTemplatePrompt(server);
  registerDelegateHealthPrompt(server);
  registerDeveloperScorecardPrompt(server);

  // FinOps
  registerCloudCostBreakdownPrompt(server);
  registerCommitmentUtilizationPrompt(server);
  registerCostAnomalyPrompt(server);
  registerRightsizingPrompt(server);

  // DevSecOps
  registerVulnerabilityTriagePrompt(server);
  registerSbomCompliancePrompt(server);
  registerSupplyChainAuditPrompt(server);
  registerExemptionReviewPrompt(server);
  registerAccessControlAuditPrompt(server);

  // Harness Code
  registerCodeReviewPrompt(server);
  registerPrSummaryPrompt(server);
  registerBranchCleanupPrompt(server);

  // Approvals
  registerPendingApprovalsPrompt(server);

  // Deployment workflows
  registerBuildDeployAppPrompt(server);
}
