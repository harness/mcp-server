package resources

import (
	"embed"
)

//go:embed templates/opa/scs_opa.rego
var Templates embed.FS
