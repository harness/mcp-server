package prompts

import (
	"embed"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// PromptMetadata represents the YAML frontmatter in prompt files
type PromptMetadata struct {
	Name              string `yaml:"name"`
	Description       string `yaml:"description"`
	ResultDescription string `yaml:"result_description"`
	Module            string `yaml:"module"`
}

// PromptFile represents a loaded prompt file with metadata and content
type PromptFile struct {
	Metadata PromptMetadata
	Content  string
	FilePath string
}

// FileLoader handles loading prompts from text files
type FileLoader struct {
	embedFS embed.FS
}

// NewEmbedFileLoader creates a new file loader with embedded filesystem
func NewEmbedFileLoader(embedFS embed.FS) *FileLoader {
	return &FileLoader{
		embedFS: embedFS,
	}
}

// loadPromptFileFromEmbed loads a single prompt file from embedded filesystem with YAML frontmatter
func (fl *FileLoader) loadPromptFileFromEmbed(filePath string) (PromptFile, error) {
	data, err := fl.embedFS.ReadFile(filePath)
	if err != nil {
		return PromptFile{}, fmt.Errorf("failed to read embedded file: %w", err)
	}

	content := string(data)
	lines := strings.Split(content, "\n")

	var inFrontmatter bool
	var frontmatterLines []string
	var contentLines []string

	for _, line := range lines {
		if line == "---" {
			if !inFrontmatter {
				inFrontmatter = true
				continue
			} else {
				inFrontmatter = false
				continue
			}
		}

		if inFrontmatter {
			frontmatterLines = append(frontmatterLines, line)
		} else if !inFrontmatter && len(frontmatterLines) > 0 {
			contentLines = append(contentLines, line)
		}
	}

	// Parse YAML frontmatter
	var metadata PromptMetadata
	if len(frontmatterLines) > 0 {
		yamlContent := strings.Join(frontmatterLines, "\n")
		if err := yaml.Unmarshal([]byte(yamlContent), &metadata); err != nil {
			return PromptFile{}, fmt.Errorf("failed to parse YAML frontmatter: %w", err)
		}
	}

	// Join content lines
	fileContent := strings.Join(contentLines, "\n")
	fileContent = strings.TrimSpace(fileContent)

	return PromptFile{
		Metadata: metadata,
		Content:  fileContent,
		FilePath: filePath,
	}, nil
}
