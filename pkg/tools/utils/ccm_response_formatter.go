package utils

import (
	"encoding/json"
	"fmt"

	dto "github.com/harness/mcp-server/common/client/dto"
	commonUtils "github.com/harness/mcp-server/common/pkg/tools/utils"
	"github.com/mark3labs/mcp-go/mcp"
)

type CCMTextResponseFormatter struct{}

func NewCCMTextResponseFormatter() commonUtils.CCMResponseFormatter {
	return CCMTextResponseFormatter{}
}

func (f CCMTextResponseFormatter) FormatEC2AnalysisResponse(response *dto.CommitmentEC2AnalysisResponse) ([]mcp.Content, error) {
	rawJSON, err := json.Marshal(response)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal commitment ec2 analysis: %w", err)
	}

	return []mcp.Content{
		mcp.NewTextContent(string(rawJSON)),
	}, nil
}
