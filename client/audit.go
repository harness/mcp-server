package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	auditPath = "gateway/audit/api/audits/list"
)

type AuditService struct {
	Client *Client
}

// ListUserAuditTrail fetches the audit trail.
func (a *AuditService) ListUserAuditTrail(ctx context.Context, scope dto.Scope, userID string, page int, size int, startTime int64, endTime int64, opts *dto.ListAuditEventsFilter) (*dto.AuditOutput[dto.AuditListItem], error) {
	if opts == nil {
		opts = &dto.ListAuditEventsFilter{}
	}

	params := make(map[string]string)
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

	opts.StartTime = startTime // or use a date range with UnixMillis
	opts.EndTime = endTime

	resp := &dto.AuditOutput[dto.AuditListItem]{}
	err := a.Client.Post(ctx, auditPath, params, opts, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list the audit trail: %w", err)
	}

	return resp, nil
}
