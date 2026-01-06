package common

import (
	"strings"

	"github.com/harness/mcp-server/common/client/dto"
)

const (
	// Scope constants
	AccountScope = "account"
	OrgScope     = "org"
	ProjectScope = "project"

	// Prefix constants
	AccountPrefix = "account."
	OrgPrefix     = "org."
)

// GetScopeOfEntity determines the scope level of an entity reference
func GetScopeOfEntity(entityRef string) string {
	if strings.HasPrefix(entityRef, AccountPrefix) {
		return AccountScope
	}
	if strings.HasPrefix(entityRef, OrgPrefix) {
		return OrgScope
	}
	return ProjectScope
}

// GetEntityIDFromRef extracts the actual entity ID from a scoped reference
func GetEntityIDFromRef(entityRef string) string {
	if entityRef == "" {
		return ""
	}
	if strings.HasPrefix(entityRef, AccountPrefix) {
		if len(entityRef) <= len(AccountPrefix) {
			return ""
		}
		return entityRef[len(AccountPrefix):]
	}
	if strings.HasPrefix(entityRef, OrgPrefix) {
		if len(entityRef) <= len(OrgPrefix) {
			return ""
		}
		return entityRef[len(OrgPrefix):]
	}
	return entityRef
}

// IsScopeValid checks if the provided scope parameters are valid
func IsScopeValid(scope dto.Scope, entityScope string) bool {
	switch entityScope {
	case AccountScope:
		return scope.AccountID != ""
	case OrgScope:
		return scope.AccountID != "" && scope.OrgID != ""
	case ProjectScope:
		return scope.AccountID != "" && scope.OrgID != "" && scope.ProjectID != ""
	default:
		return false
	}
}

// GetScopeFromEntityRef creates a scope object from an entity reference
func GetScopeFromEntityRef(baseScope dto.Scope, entityRef string) dto.Scope {
	entityScope := GetScopeOfEntity(entityRef)

	switch entityScope {
	case AccountScope:
		return dto.Scope{
			AccountID: baseScope.AccountID,
		}
	case OrgScope:
		return dto.Scope{
			AccountID: baseScope.AccountID,
			OrgID:     baseScope.OrgID,
		}
	default: // ProjectScope
		return baseScope
	}
}
