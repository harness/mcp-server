ifndef GOPATH
	GOPATH := $(shell go env GOPATH)
endif
ifndef GOBIN # derive value from gopath (default to first entry, similar to 'go get')
	GOBIN := $(shell go env GOPATH | sed 's/:.*//')/bin
endif

tools = $(addprefix $(GOBIN)/, goimports gci)

LDFLAGS = "-X github.com/harness/gitness/version.GitCommit=${GIT_COMMIT} -X github.com/harness/gitness/version.major=${GITNESS_VERSION_MAJOR} -X github.com/harness/gitness/version.minor=${GITNESS_VERSION_MINOR} -X github.com/harness/gitness/version.patch=${GITNESS_VERSION_PATCH}"

###############################################################################
#
# Build rules
#
###############################################################################
tools: $(tools) ## Install tools required for the build
	@echo "Installed tools"

build:  
	@echo "Building mcp-server"
	go build -ldflags=${LDFLAGS} -o cmd/harness-mcp-server/harness-mcp-server ./cmd/harness-mcp-server

###############################################################################
#
# Code Formatting and linting
#
###############################################################################

format: tools # Format go code and error if any changes are made
	@echo "Formating ..."
	@goimports -w .
	@gci write --custom-order -s standard -s "prefix(github.com/harness/gitness)" -s default -s blank -s dot .
	@echo "Formatting complete"

.PHONY: help format tools

$(GOBIN)/gci:
	go install github.com/daixiang0/gci@v0.13.1
	
# Install goimports to format code
$(GOBIN)/goimports:
	@echo "🔘 Installing goimports ... (`date '+%H:%M:%S'`)"
	@go install golang.org/x/tools/cmd/goimports

help: ## show help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[$$()% 0-9a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)