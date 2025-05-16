API_DIR := api
SERVICES := $(shell find $(API_DIR) -mindepth 2 -maxdepth 2 -type f -name "openapi.yaml" | \
	            sed -E "s|$(API_DIR)/([^/]+)/openapi.yaml|\1|")
GOCMD := go

ifndef GOPATH
	GOPATH := $(shell go env GOPATH)
endif
ifndef GOBIN # derive value from gopath (default to first entry, similar to 'go get')
	GOBIN := $(shell go env GOPATH | sed 's/:.*//')/bin
endif

.PHONY: generate build clean

# Generate code for every service folder that owns an openapi.yaml
generate: $(SERVICES:%=generate-%)


tools = $(addprefix $(GOBIN)/, golangci-lint gci oapi-codegen)
tools: $(tools) ## Install tools required for the build
	@echo "Installed tools"

generate-%:
	@echo ">> Generating $*"
	$(GOBIN)/oapi-codegen -generate types,client -response-type-suffix Resp -package $* $(API_DIR)/$*/openapi.yaml > client/$*/$*_gen.go

# Remove generated clients
clean:
	rm -f client/*/*_gen.go

format: tools # Format go code and error if any changes are made
	@echo "Formatting ..."
	@goimports -w .
	@gci write --skip-generated --custom-order -s standard -s "prefix(github.com/harness/)" -s default -s blank -s dot .
	@echo "Formatting complete"
