package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
)

const (
	ccmBasePath        = "ccm/api"
	ccmGetOverviewPath = ccmBasePath + "/overview?accountIdentifier=%s&startTime=%d&endTime=%d&groupBy=%s"
)

type CloudCostManagementService struct {
	Client *Client
}

func (c *CloudCostManagementService) GetOverview(ctx context.Context, accID string, startTime int64, endTime int64, groupBy string) (*dto.CEView, error) {
	path := fmt.Sprintf(ccmGetOverviewPath, accID, startTime, endTime, groupBy)
	params := make(map[string]string)

	ccmOverview := new(dto.CEView)
	err := c.Client.Get(ctx, path, params, nil, ccmOverview)
	if err != nil {
		return nil, fmt.Errorf("failed to get ccm overview: %w", err)
	}

	return ccmOverview, nil
}
