package prompts

import (
	"bufio"
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
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
	baseDir string
	embedFS embed.FS
	useEmbed bool
}

// NewFileLoader creates a new file loader with the specified base directory
func NewFileLoader(baseDir string) *FileLoader {
	return &FileLoader{
		baseDir: baseDir,
		useEmbed: false,
	}
}

// NewEmbedFileLoader creates a new file loader with embedded filesystem
func NewEmbedFileLoader(embedFS embed.FS) *FileLoader {
	return &FileLoader{
		embedFS: embedFS,
		useEmbed: true,
	}
}

// LoadPromptsFromDirectory loads all prompt files from a directory
func (fl *FileLoader) LoadPromptsFromDirectory(dir string) ([]PromptFile, error) {
	var prompts []PromptFile

	if fl.useEmbed {
		// Use embedded filesystem
		err := fs.WalkDir(fl.embedFS, dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			// Only process .txt files
			if !d.IsDir() && strings.HasSuffix(path, ".txt") {
				prompt, loadErr := fl.loadPromptFileFromEmbed(path)
				if loadErr != nil {
					return fmt.Errorf("failed to load prompt file %s: %w", path, loadErr)
				}
				prompts = append(prompts, prompt)
			}

			return nil
		})

		if err != nil {
			return nil, fmt.Errorf("failed to walk embedded directory %s: %w", dir, err)
		}
	} else {
		// Use regular filesystem
		fullPath := filepath.Join(fl.baseDir, dir)
		err := filepath.Walk(fullPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			// Only process .txt files
			if !info.IsDir() && strings.HasSuffix(path, ".txt") {
				prompt, loadErr := fl.loadPromptFile(path)
				if loadErr != nil {
					return fmt.Errorf("failed to load prompt file %s: %w", path, loadErr)
				}
				prompts = append(prompts, prompt)
			}

			return nil
		})

		if err != nil {
			return nil, fmt.Errorf("failed to walk directory %s: %w", fullPath, err)
		}
	}

	return prompts, nil
}

// loadPromptFile loads a single prompt file with YAML frontmatter
func (fl *FileLoader) loadPromptFile(filePath string) (PromptFile, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return PromptFile{}, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var lines []string
	var inFrontmatter bool
	var frontmatterLines []string
	var contentLines []string

	for scanner.Scan() {
		line := scanner.Text()
		lines = append(lines, line)

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

	if err := scanner.Err(); err != nil {
		return PromptFile{}, fmt.Errorf("failed to read file: %w", err)
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
	content := strings.Join(contentLines, "\n")
	content = strings.TrimSpace(content)

	return PromptFile{
		Metadata: metadata,
		Content:  content,
		FilePath: filePath,
	}, nil
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

// LoadCommonPrompts loads prompts from the common directory
func (fl *FileLoader) LoadCommonPrompts() ([]PromptFile, error) {
	return fl.LoadPromptsFromDirectory("files/common")
}

// LoadInternalPrompts loads prompts from the internal directory
func (fl *FileLoader) LoadInternalPrompts() ([]PromptFile, error) {
	return fl.LoadPromptsFromDirectory("files/internal")
}

// LoadExternalPrompts loads prompts from the external directory
func (fl *FileLoader) LoadExternalPrompts() ([]PromptFile, error) {
	return fl.LoadPromptsFromDirectory("files/external")
}

// LoadModulePrompts loads prompts for a specific module from a directory
func (fl *FileLoader) LoadModulePrompts(dir, module string) ([]PromptFile, error) {
	prompts, err := fl.LoadPromptsFromDirectory(dir)
	if err != nil {
		return nil, err
	}

	// Filter by module
	var modulePrompts []PromptFile
	for _, prompt := range prompts {
		if prompt.Metadata.Module == module {
			modulePrompts = append(modulePrompts, prompt)
		}
	}

	return modulePrompts, nil
}
