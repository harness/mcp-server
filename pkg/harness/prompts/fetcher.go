package prompts

import (
	"embed"
)

//go:embed files/**/*.txt
var PromptFiles embed.FS // Exported to be accessible from other packages

// GetModulePrompts retrieves prompts for a specific module from a given filesystem
// GetModulePrompts retrieves prompts for a specific module from a given filesystem.
// It loads common prompts from the "files/common" directory and mode-specific prompts
// from the "files/internal" or "files/external" directory, depending on the value of `isInternal`.
// It returns a slice of PromptFile containing the loaded prompts.
func GetModulePrompts(fs embed.FS, module string, isInternal bool, mode string) ([]PromptFile, error) {
	// Use embedded filesystem instead of file system paths
	// Use the provided embedded filesystem
	fileLoader := NewEmbedFileLoader(fs)

	var allPrompts []PromptFile

	filename := module + ".txt"
	// Load common prompt for the module directly
	commonPath := "files/common/" + filename
	commonPrompt, err := fileLoader.loadPromptFileFromEmbed(commonPath)
	if err == nil {
		allPrompts = append(allPrompts, commonPrompt)
	}

	// Load mode-specific prompt for the module directly
	var modePath string
	if isInternal {
		modePath = "files/internal/" + mode + "/" + filename
	} else {
		modePath = "files/external/" + filename
	}

	modePrompt, err := fileLoader.loadPromptFileFromEmbed(modePath)
	if err == nil {
		allPrompts = append(allPrompts, modePrompt)
	}

	return allPrompts, nil
}
