package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	ccmCommitmentMasterAccountsPath = ccmCommitmentBasePath + "/accounts/%s/v1/setup/listMasterAccounts?accountIdentifier=%s"
)

func (r *CloudCostManagementService) GetCommitmentMasterAccounts(ctx context.Context, scope dto.Scope) (*dto.CCMCommitmentBaseResponse, error) {
	path := fmt.Sprintf(ccmCommitmentMasterAccountsPath, scope.AccountID, scope.AccountID)
	params := make(map[string]string)
	addScope(scope, params)

	listMasterAccountsResponse := new(dto.CCMCommitmentBaseResponse)

	err := r.Client.Post(ctx, path, params, nil, listMasterAccountsResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to get cloud cost managment master accounts with path %s: %w", path, err)
	}

	return listMasterAccountsResponse, nil
}
