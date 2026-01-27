package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/harness/mcp-server/pkg/test"
)

func main() {
	tools, err := test.GetAllTools()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting tools: %v\n", err)
		os.Exit(1)
	}

	jsonBytes, err := json.MarshalIndent(tools, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling tools: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(jsonBytes))
}
