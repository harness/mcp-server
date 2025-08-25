# API Compatibility Validation for Rust Migration

## Overview
This document outlines the comprehensive validation strategy to ensure the Rust implementation maintains 100% API compatibility with the existing Go implementation of the Harness MCP Server.

## Validation Strategy

### 1. Test Infrastructure Analysis

#### Existing Go Test Structure
```
test/
├── e2e/                    # End-to-end integration tests
│   ├── setup_test.go       # Test setup and client initialization
│   ├── audit_test.go       # Audit API tests
│   ├── idp_test.go         # Internal Developer Portal tests
│   ├── connectors_test.go  # Connector API tests
│   └── ...
├── unit/                   # Unit tests
│   └── register_prompts_test.go
pkg/harness/
├── tools/
│   ├── ccmperspectives_test.go  # CCM perspectives unit tests
│   └── tools_test.go            # Tool framework tests
├── auth/
│   ├── api_key_test.go     # API key authentication tests
│   └── jwt_test.go         # JWT authentication tests
client/
└── client_test.go          # HTTP client tests
```

#### Test Environment Requirements
- **Environment Variables**:
  - `HARNESS_MCP_SERVER_E2E_TOKEN`: Authentication token for E2E tests
  - Account ID, Organization ID, Project ID extraction from token
- **Test Tags**: `//go:build e2e` for integration tests
- **Dependencies**: Uses `github.com/stretchr/testify` for assertions

### 2. API Endpoint Validation Matrix

#### Core Platform APIs

| Service | Endpoint Pattern | Test Coverage | Validation Method |
|---------|------------------|---------------|-------------------|
| **Pipelines** | `/ng/api/pipelines/*` | E2E + Unit | Request/Response comparison |
| **Connectors** | `/ng/api/connectors/*` | E2E + Unit | Catalog and detail validation |
| **Services** | `/ng/api/services/*` | E2E + Unit | CRUD operation validation |
| **Environments** | `/ng/api/environments/*` | E2E + Unit | Configuration validation |
| **Infrastructure** | `/ng/api/infrastructure/*` | E2E + Unit | Definition validation |

#### Advanced Platform APIs

| Service | Endpoint Pattern | Test Coverage | Validation Method |
|---------|------------------|---------------|-------------------|
| **CCM Perspectives** | `/ccm/api/perspective/*` | E2E + Unit | Cost data validation |
| **CCM GraphQL** | `/ccm/api/graphql` | E2E | Query response validation |
| **SCS** | `/scs/api/*` | E2E | Artifact and SBOM validation |
| **STO** | `/sto/api/*` | E2E | Security scan validation |
| **IDP** | `/idp/api/*` | E2E | Entity catalog validation |

#### Authentication & Authorization

| Component | Test Type | Validation Method |
|-----------|-----------|-------------------|
| **API Key Auth** | Unit + E2E | Token extraction and validation |
| **Bearer Token** | Unit + E2E | JWT parsing and claims validation |
| **Scope Resolution** | Unit | Account/Org/Project hierarchy |

### 3. Compatibility Test Suite Design

#### 3.1 Request/Response Validation

```rust
// Rust test framework structure
#[cfg(test)]
mod compatibility_tests {
    use super::*;
    use serde_json::Value;
    use std::collections::HashMap;
    
    #[tokio::test]
    async fn test_pipeline_list_compatibility() {
        let go_response = get_go_baseline_response("pipeline_list").await;
        let rust_response = call_rust_implementation("pipeline_list", &params).await;
        
        assert_json_compatibility(&go_response, &rust_response);
    }
    
    fn assert_json_compatibility(go_json: &Value, rust_json: &Value) {
        // Deep comparison of JSON structures
        // Validate field presence, types, and values
        // Allow for ordering differences in arrays where appropriate
    }
}
```

#### 3.2 MCP Protocol Validation

```rust
#[tokio::test]
async fn test_mcp_tool_registration() {
    let client = create_test_client().await;
    
    // Test tool discovery
    let tools = client.list_tools().await.unwrap();
    assert!(tools.len() > 100); // Ensure all tools are registered
    
    // Validate each tool has required fields
    for tool in tools {
        assert!(!tool.name.is_empty());
        assert!(tool.description.is_some());
        assert!(!tool.input_schema.properties.is_empty());
    }
}

#[tokio::test]
async fn test_mcp_tool_execution() {
    let client = create_test_client().await;
    
    // Test each major tool category
    test_pipeline_tools(&client).await;
    test_connector_tools(&client).await;
    test_ccm_tools(&client).await;
    // ... etc
}
```

#### 3.3 Error Response Validation

```rust
#[tokio::test]
async fn test_error_response_compatibility() {
    let test_cases = vec![
        ("invalid_api_key", ExpectedError::Unauthorized),
        ("missing_org_id", ExpectedError::BadRequest),
        ("nonexistent_pipeline", ExpectedError::NotFound),
    ];
    
    for (test_case, expected_error) in test_cases {
        let go_error = get_go_error_response(test_case).await;
        let rust_error = get_rust_error_response(test_case).await;
        
        assert_error_compatibility(&go_error, &rust_error, expected_error);
    }
}
```

### 4. Automated Compatibility Testing

#### 4.1 Golden File Testing

```rust
// Generate baseline responses from Go implementation
#[tokio::test]
async fn generate_golden_files() {
    let test_cases = load_test_cases("test_data/api_calls.json");
    
    for test_case in test_cases {
        let response = call_go_implementation(&test_case).await;
        save_golden_file(&test_case.name, &response);
    }
}

// Validate Rust implementation against golden files
#[tokio::test]
async fn validate_against_golden_files() {
    let test_cases = load_test_cases("test_data/api_calls.json");
    
    for test_case in test_cases {
        let expected = load_golden_file(&test_case.name);
        let actual = call_rust_implementation(&test_case).await;
        
        assert_json_compatibility(&expected, &actual);
    }
}
```

#### 4.2 Property-Based Testing

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_pipeline_id_validation(pipeline_id in "[a-zA-Z0-9_-]{1,100}") {
        let go_result = validate_pipeline_id_go(&pipeline_id);
        let rust_result = validate_pipeline_id_rust(&pipeline_id);
        
        prop_assert_eq!(go_result.is_ok(), rust_result.is_ok());
        if go_result.is_err() {
            prop_assert_eq!(go_result.unwrap_err().kind(), rust_result.unwrap_err().kind());
        }
    }
}
```

### 5. Performance Compatibility Testing

#### 5.1 Benchmark Comparison

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_pipeline_list(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    c.bench_function("go_pipeline_list", |b| {
        b.iter(|| rt.block_on(call_go_pipeline_list(black_box(&test_params))))
    });
    
    c.bench_function("rust_pipeline_list", |b| {
        b.iter(|| rt.block_on(call_rust_pipeline_list(black_box(&test_params))))
    });
}

criterion_group!(benches, benchmark_pipeline_list);
criterion_main!(benches);
```

#### 5.2 Memory Usage Validation

```rust
#[tokio::test]
async fn test_memory_usage() {
    let initial_memory = get_memory_usage();
    
    // Execute 1000 API calls
    for _ in 0..1000 {
        let _ = call_rust_implementation(&test_case).await;
    }
    
    let final_memory = get_memory_usage();
    let memory_growth = final_memory - initial_memory;
    
    // Ensure memory growth is within acceptable bounds
    assert!(memory_growth < MAX_ACCEPTABLE_MEMORY_GROWTH);
}
```

### 6. Integration Test Migration

#### 6.1 E2E Test Framework

```rust
// Rust equivalent of Go E2E test setup
use tokio::sync::OnceCell;

static TEST_CLIENT: OnceCell<McpClient> = OnceCell::const_new();
static TEST_CONFIG: OnceCell<TestConfig> = OnceCell::const_new();

async fn get_test_client() -> &'static McpClient {
    TEST_CLIENT.get_or_init(|| async {
        let config = get_test_config().await;
        McpClient::new(config).await.expect("Failed to create test client")
    }).await
}

async fn get_test_config() -> &'static TestConfig {
    TEST_CONFIG.get_or_init(|| async {
        let token = std::env::var("HARNESS_MCP_SERVER_E2E_TOKEN")
            .expect("HARNESS_MCP_SERVER_E2E_TOKEN not set");
        
        TestConfig::from_token(token)
    }).await
}
```

#### 6.2 Test Case Migration

```rust
// Migrate Go test cases to Rust
#[tokio::test]
async fn test_connector_list() {
    let client = get_test_client().await;
    
    let result = client.call_tool("list_connectors", json!({
        "page": 0,
        "size": 10
    })).await;
    
    assert!(result.is_ok());
    let response: ConnectorListResponse = serde_json::from_value(result.unwrap())?;
    assert!(!response.content.is_empty());
}

#[tokio::test]
async fn test_pipeline_execution() {
    let client = get_test_client().await;
    
    let result = client.call_tool("list_pipeline_executions", json!({
        "pipeline_id": "test_pipeline",
        "page": 0,
        "size": 5
    })).await;
    
    assert!(result.is_ok());
    // Validate response structure matches Go implementation
}
```

### 7. Validation Checklist

#### 7.1 Functional Compatibility
- [ ] All 37 tool categories implemented and tested
- [ ] All API endpoints return identical response structures
- [ ] All error conditions produce identical error responses
- [ ] All authentication mechanisms work identically
- [ ] All parameter validation behaves identically

#### 7.2 Protocol Compatibility
- [ ] MCP protocol implementation matches Go version exactly
- [ ] JSON-RPC 2.0 compliance maintained
- [ ] Tool registration produces identical tool lists
- [ ] Prompt system works identically
- [ ] Resource handling matches Go implementation

#### 7.3 Performance Compatibility
- [ ] Response times are equal or better than Go version
- [ ] Memory usage is equal or lower than Go version
- [ ] Throughput is equal or higher than Go version
- [ ] No performance regressions in any tool category

#### 7.4 Integration Compatibility
- [ ] All existing client integrations work without changes
- [ ] Claude Desktop integration works identically
- [ ] VS Code integration works identically
- [ ] All environment variable handling is identical
- [ ] All CLI flags and options work identically

### 8. Continuous Validation

#### 8.1 CI/CD Integration

```yaml
# GitHub Actions workflow for compatibility testing
name: API Compatibility Tests

on: [push, pull_request]

jobs:
  compatibility-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
          
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        
      - name: Generate Go baselines
        run: |
          cd go-implementation
          go test -tags=baseline ./test/e2e/...
          
      - name: Test Rust compatibility
        run: |
          cd rust-implementation
          cargo test --test compatibility
          
      - name: Performance comparison
        run: |
          cargo bench --bench api_performance
```

#### 8.2 Regression Detection

```rust
#[tokio::test]
async fn test_no_api_regressions() {
    let baseline_responses = load_baseline_responses();
    
    for (test_name, expected_response) in baseline_responses {
        let actual_response = execute_test_case(&test_name).await;
        
        // Detect any changes in API responses
        let diff = compare_responses(&expected_response, &actual_response);
        if !diff.is_empty() {
            panic!("API regression detected in {}: {:?}", test_name, diff);
        }
    }
}
```

### 9. Success Criteria

#### 9.1 Compatibility Metrics
- **100% API compatibility**: All endpoints return identical responses
- **100% error compatibility**: All error conditions produce identical errors
- **100% tool compatibility**: All tools work identically
- **Zero breaking changes**: No existing integrations require modifications

#### 9.2 Performance Targets
- **Response time**: ≤ 100% of Go implementation (equal or better)
- **Memory usage**: ≤ 70% of Go implementation
- **Throughput**: ≥ 120% of Go implementation
- **Startup time**: ≤ 80% of Go implementation

#### 9.3 Quality Metrics
- **Test coverage**: ≥ 95% for all API endpoints
- **Integration coverage**: 100% of existing integrations tested
- **Error coverage**: 100% of error conditions tested
- **Edge case coverage**: All known edge cases validated

This comprehensive validation strategy ensures that the Rust migration maintains perfect API compatibility while delivering improved performance and reliability.