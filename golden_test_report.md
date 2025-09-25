# Golden Test Report

**Generated:** 2025-09-25 10:13:15 UTC

## Summary

- **Total Tests:** 13
- **Passed:** 9
- **Failed:** 4
- **Success Rate:** 69%

## Test Categories

### Pipeline Tools
- ✅ list_pipelines
- ✅ get_pipeline
- ✅ list_executions
- ✅ get_execution
- ✅ fetch_execution_url

### Connector Tools
- ✅ list_connector_catalogue
- ✅ get_connector_details
- ✅ list_connectors

### Environment Tools
- ✅ list_environments
- ✅ get_environment

### Error Handling
- ❌ tool_not_found (Response format mismatch)
- ❌ missing_required_parameter (Error message differs)
- ❌ authentication_failed (Status code differs)

## Failed Tests

### error_tool_not_found

**Issue:** Response format mismatch

**Request:**
```json
{
  "name": "nonexistent_tool",
  "arguments": {}
}
```

**Go Response:**
```json
{
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

**Rust Response:**
```json
{
  "error": {
    "code": -32601,
    "message": "Tool not found"
  }
}
```

## Recommendations

1. **Standardize Error Messages**: Ensure error messages match exactly between implementations
2. **Response Format Consistency**: Validate JSON structure consistency
3. **Status Code Alignment**: Ensure HTTP status codes match for all scenarios
4. **Field Naming**: Verify all JSON field names are identical
5. **Null Handling**: Ensure null/undefined values are handled consistently

## Next Steps

1. Fix error message inconsistencies
2. Add more comprehensive test coverage
3. Implement automated regression testing
4. Set up continuous validation in CI/CD pipeline
