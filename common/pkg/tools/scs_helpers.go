package tools

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	config "github.com/harness/mcp-server/common"
	generated "github.com/harness/mcp-server/common/client/scs/generated"
)

// mapLastScan extracts last scan data from PipelineDetails into a map
func mapLastScan(lastScan *generated.PipelineDetails) map[string]interface{} {
	scan := map[string]interface{}{}
	if lastScan.Id != nil {
		scan["pipeline"] = *lastScan.Id
	}
	if lastScan.ExecutionId != nil {
		scan["execution"] = *lastScan.ExecutionId
	}
	if lastScan.Status != nil {
		scan["status"] = *lastScan.Status
	}
	if lastScan.TriggeredAt != nil {
		tsMillis := *lastScan.TriggeredAt
		tsSecs := tsMillis / 1000
		t := time.Unix(tsSecs, 0)
		scan["last_scan"] = t.Format("02/01/2006 15:04")
	}
	return scan
}

// formatScorecard formats a scorecard value as a float with 2 decimal places
func formatScorecard(scorecardValue string) interface{} {
	// Parse string to float before formatting
	if score, err := strconv.ParseFloat(scorecardValue, 64); err == nil {
		return fmt.Sprintf("%.2f", score)
	}
	// Fallback to the original string if parsing fails

	return scorecardValue
}

// mapCompliance extracts compliance data from RiskAndCompliance into a map
func mapCompliance(riskAndCompliance *generated.RiskAndCompliance) map[string]interface{} {
	compliance := map[string]interface{}{}
	if riskAndCompliance.Critical != nil {
		compliance["critical"] = *riskAndCompliance.Critical
	}
	if riskAndCompliance.High != nil {
		compliance["high"] = *riskAndCompliance.High
	}
	if riskAndCompliance.Medium != nil {
		compliance["medium"] = *riskAndCompliance.Medium
	}
	if riskAndCompliance.Low != nil {
		compliance["low"] = *riskAndCompliance.Low
	}
	return compliance
}

// mapVulnerabilities extracts vulnerability data from StoIssueCount into a map
func mapVulnerabilities(stoIssueCount *generated.StoIssueCount) map[string]interface{} {
	vuln := map[string]interface{}{}
	if stoIssueCount.Critical != nil {
		vuln["critical"] = *stoIssueCount.Critical
	}
	if stoIssueCount.High != nil {
		vuln["high"] = *stoIssueCount.High
	}
	if stoIssueCount.Medium != nil {
		vuln["medium"] = *stoIssueCount.Medium
	}
	if stoIssueCount.Low != nil {
		vuln["low"] = *stoIssueCount.Low
	}
	if stoIssueCount.Total != nil {
		vuln["total"] = *stoIssueCount.Total
	}
	return vuln
}

// artifactRuleBasedFollowUps generates follow-up prompts based on license filters
func artifactRuleBasedFollowUps(licenseFilterList *[]generated.LicenseFilter) []string {
	var prompts []string
	if licenseFilterList != nil && len(*licenseFilterList) > 0 {
		var licenses []string
		for _, lf := range *licenseFilterList {
			if lf.Value != "" {
				licenses = append(licenses, lf.Value)
			}
		}
		licenseStr := strings.Join(licenses, ", ")
		prompts = append(prompts, fmt.Sprintf("Would you like to create a policy to prevent artifacts with %s licenses from being deployed?", licenseStr))
	} else {
		prompts = append(prompts, "Summarise key risks for 1 artifact")
	}

	return prompts
}

// extractPaginationFromHeaders extracts pagination info from HTTP response headers
func extractPaginationFromHeaders(headers map[string][]string) PaginationInfo {
	pagination := PaginationInfo{}

	if vals, ok := headers["X-Page-Number"]; ok && len(vals) > 0 {
		if num, err := strconv.Atoi(vals[0]); err == nil {
			pagination.PageNumber = num
		}
	}
	if vals, ok := headers["X-Page-Size"]; ok && len(vals) > 0 {
		if num, err := strconv.Atoi(vals[0]); err == nil {
			pagination.PageSize = num
		}
	}
	if vals, ok := headers["X-Total-Elements"]; ok && len(vals) > 0 {
		if num, err := strconv.Atoi(vals[0]); err == nil {
			pagination.TotalElements = num
		}
	}

	return pagination
}

// buildSCSBaseURL constructs the SCS service base URL from config
func buildSCSBaseURL(cfg *config.McpServerConfig) string {
	return cfg.BaseURL + "/ssca-manager"
}
