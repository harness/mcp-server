
# MCP Tooling Pull Request

## Tool Information

- **Tool Name**: [Clear, descriptive name without ambiguity]
- **Purpose**: [Briefly explain what this tool does and its use case]
- **Target Users**: [Who will be using this tool?]

## Tool Description

[Provide a clear, detailed description of the tool's functionality. Make it understandable for both humans and LLMs.]

### Key Features
- [ ] Feature 1
- [ ] Feature 2
- [ ] Feature 3

## Tool Naming and Clarity
- [ ] Tool name is clear, descriptive, and follows naming conventions
- [ ] No ambiguity or duplication with existing tool names
- [ ] All parameters and return values have clear, descriptive names
- [ ] Error messages are clear and actionable

## Example Responses

### Successful Response Example
```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "metadata": {
    "request_id": "req_12345",
    "timestamp": "2025-07-11T09:03:33Z"
  }
}
```

### Error Response Example
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Detailed error message",
    "details": {
      "field": "field_name",
      "issue": "must be a valid value"
    }
  }
}
```

## Screenshots

### Windsurf Client Integration
<!-- Add screenshot of the tool in action within Windsurf -->
![Windsurf Tool Usage](path/to/windsurf-screenshot.png)
*Figure 1: Tool usage in Windsurf client*

### GenAI Service Integration
<!-- Add screenshot of the tool being called from GenAI service -->
![GenAI Service Tool Call](path/to/genai-tool-call.png)
*Figure 2: Tool call in GenAI service*

### Sample Responses
<!-- Add screenshot of example responses -->
![Example Response](path/to/example-response.png)
*Figure 3: Example response visualization*

## Testing Requirements

### Client Verification
- [ ] Verified with actual client requests from Windsurf
- [ ] Verified with actual client requests from GenAI service
- [ ] All sample requests/responses in this PR match actual client behavior
- [ ] Error cases are properly handled and return appropriate error messages
- [ ] Rate limiting and authentication work as expected

### E2E Test Verification
- [ ] E2E tests added or not required (explain why if not required)

### Screenshot Verification
- [ ] Screenshots are up-to-date with the current UI
- [ ] Sensitive information is redacted from screenshots
- [ ] Screenshots clearly demonstrate the tool's functionality
