package client

import (
	"fmt"
	"context"
	"github.com/harness/harness-mcp/client/dto"
)

type AuditService struct {
	Client *Client
}

// ListUserAuditTrail fetches the audit trail of a specific user.
func (a *AuditService) ListUserAuditTrail(ctx context.Context, scope dto.Scope, userID string, page int, size int, startTime int64, endTime int64, opts *dto.ListAuditEventsFilter) (*dto.AuditOutput[dto.AuditListItem], error) {
    if opts == nil {
        opts = &dto.ListAuditEventsFilter{}
    }

    params := make(map[string]string)
    params["routingId"] = scope.AccountID
    params["accountIdentifier"] = scope.AccountID
    params["pageIndex"] = fmt.Sprintf("%d", page)
    params["pageSize"] = fmt.Sprintf("%d", size)

    addScope(scope, params)

    // Required fields
    opts.FilterType = "Audit"
    opts.Principals = []dto.AuditPrincipal{{
        Type:       "USER",
        Identifier: userID,
    }}

    opts.Scopes = []dto.AuditResourceScope{{
        AccountIdentifier: scope.AccountID,
        OrgIdentifier:     scope.OrgID,
        ProjectIdentifier: scope.ProjectID,
    }}

    opts.StartTime = startTime
	opts.EndTime = endTime

    resp := &dto.AuditOutput[dto.AuditListItem]{}
    err := a.Client.Post(ctx, "gateway/audit/api/audits/list", params, opts, resp)
    if err != nil {
        return nil, fmt.Errorf("failed to list pipeline executions by user: %w", err)
    }

    return resp, nil
}
