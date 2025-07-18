package client

import (
	"context"
	"fmt"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	auditPath = "/api/audits/list"
)

type AuditService struct {
	Client *Client
}

// ListUserAuditTrail fetches the audit trail.
func (a *AuditService) ListUserAuditTrail(ctx context.Context, scope dto.Scope, userIDList string, actionsList string, page int, size int, startTime int64, endTime int64, opts *dto.ListAuditEventsFilter) (*dto.AuditOutput[dto.AuditListItem], error) {
	if opts == nil {
		opts = &dto.ListAuditEventsFilter{}
	}

	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID
	params["pageIndex"] = fmt.Sprintf("%d", page)
	params["pageSize"] = fmt.Sprintf("%d", size)

	addScope(scope, params)

	opts.FilterType = "Audit"
	if strings.TrimSpace(userIDList) != "" {
		rawIDs := strings.Split(userIDList, ",")
		userIDs := make([]string, 0)
		for _, id := range rawIDs {
			id = strings.TrimSpace(id)
			if id != "" {
				userIDs = append(userIDs, id)
			}
		}

		if len(userIDs) > 0 {
			principals := make([]dto.AuditPrincipal, 0, len(userIDs))
			for _, uid := range userIDs {
				principals = append(principals, dto.AuditPrincipal{
					Type:       "USER",
					Identifier: uid,
				})
			}
			opts.Principals = principals
		}
	}

	if strings.TrimSpace(actionsList) != "" {
		rawActions := strings.Split(actionsList, ",")
		actions := make([]string, 0)
		for _, action := range rawActions {
			action = strings.TrimSpace(action)
			if action != "" {
				actions = append(actions, action)
			}
		}

		if len(actions) > 0 {
			opts.Actions = actions
		}
	}

	opts.Scopes = []dto.AuditResourceScope{{
		AccountIdentifier: scope.AccountID,
		OrgIdentifier:     scope.OrgID,
		ProjectIdentifier: scope.ProjectID,
	}}

	opts.StartTime = startTime
	opts.EndTime = endTime

	resp := &dto.AuditOutput[dto.AuditListItem]{}
	err := a.Client.Post(ctx, auditPath, params, opts, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list the audit trail: %w", err)
	}

	for i := range resp.Data.Content {
		timestamp := resp.Data.Content[i].Timestamp
		resp.Data.Content[i].Time = dto.FormatUnixMillisToRFC3339(timestamp)
	}

	return resp, nil
}
