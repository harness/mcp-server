# Harness MCP Server Test Suite

This directory contains comprehensive tests for validating the Rust migration of the Harness MCP Server.

## Test Structure

```
tests/
├── rust/                    # Rust-specific test modules
│   ├── mod.rs              # Main test suite runner
│   ├── golden_tests.rs     # API parity validation tests
│   ├── auth_tests.rs       # Authentication tests
│   ├── core_tests.rs       # Core protocol tests
│   ├── client_tests.rs     # HTTP client tests
│   ├── tools_tests.rs      # Tool implementation tests
│   └── integration_tests.rs # End-to-end integration tests
├── e2e/                    # End-to-end tests (from Go)
└── unit/                   # Unit tests (from Go)
```

## Test Categories

### 1. Unit Tests
Located in each crate's `src/lib.rs` and `tests/` directories.

**Coverage:**
- Authentication providers (API key, JWT, Bearer token)
- Core MCP protocol types and serialization
- HTTP client functionality
- Tool definitions and handlers
- Configuration management
- Error handling

**Run with:**
```bash
cargo test --lib --workspace
```

### 2. Integration Tests
Located in `crates/*/tests/` directories.

**Coverage:**
- Server initialization and startup
- MCP protocol request/response handling
- Tool registration and execution
- Authentication middleware
- HTTP server endpoints

**Run with:**
```bash
cargo test --tests --workspace
```

### 3. Golden Tests (API Parity)
Located in `tests/rust/golden_tests.rs`.

**Purpose:**
- Validate JSON response compatibility between Go and Rust
- Ensure API behavior parity
- Catch breaking changes in migration

**Coverage:**
- All MCP tool endpoints
- Error response formats
- Authentication flows
- Request/response serialization

**Run with:**
```bash
cargo test golden_tests
```

### 4. End-to-End Tests
Located in `tests/rust/integration_tests.rs`.

**Coverage:**
- Complete workflows (initialize → list tools → call tool)
- Multi-step operations
- Real API interactions (with test credentials)
- Performance validation

**Run with:**
```bash
cargo test integration_tests
```

## Test Configuration

### Environment Variables

For running tests against real Harness APIs:

```bash
export HARNESS_MCP_SERVER_E2E_TOKEN="pat.account.token.value"
export HARNESS_MCP_SERVER_E2E_ACCOUNT_ID="your_account_id"
export HARNESS_MCP_SERVER_E2E_ORG_ID="your_org_id"
export HARNESS_MCP_SERVER_E2E_PROJECT_ID="your_project_id"
export HARNESS_MCP_SERVER_E2E_BASE_URL="https://app.harness.io"
```

### Test Modes

1. **Unit Mode**: Fast, isolated tests with mocks
2. **Integration Mode**: Tests with real HTTP clients but mocked responses
3. **E2E Mode**: Full tests against real Harness APIs (requires credentials)

## Running Tests

### Quick Test Run
```bash
# Run all unit tests
cargo test --workspace

# Run specific crate tests
cargo test -p harness-mcp-auth
cargo test -p harness-mcp-core
cargo test -p harness-mcp-server
```

### Comprehensive Test Run
```bash
# Use the test runner script
./test_runner.sh

# Or run manually
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
```

### Golden Test Validation
```bash
# Run API parity tests
cargo test golden_tests -- --nocapture

# Generate golden test report
cargo test golden_tests -- --nocapture > golden_test_report.txt
```

## Test Data

### Mock Data
- Located in `tests/data/` directory
- JSON fixtures for API responses
- Test configurations and scenarios

### Golden Data
- Expected JSON responses for API parity
- Normalized response formats
- Error response templates

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Run tests
        run: |
          cargo test --workspace
          cargo clippy --workspace -- -D warnings
          cargo fmt --all -- --check
```

### Test Coverage
```bash
# Install cargo-tarpaulin
cargo install cargo-tarpaulin

# Generate coverage report
cargo tarpaulin --workspace --out Html
```

## Test Guidelines

### Writing Tests

1. **Unit Tests**: Test individual functions and modules in isolation
2. **Integration Tests**: Test component interactions and workflows
3. **Golden Tests**: Validate API compatibility with expected responses
4. **Property Tests**: Use `proptest` for property-based testing

### Test Naming
- Use descriptive test names: `test_api_key_provider_with_valid_key`
- Group related tests in modules
- Use `#[should_panic]` for error condition tests

### Assertions
```rust
// Use specific assertions
assert_eq!(actual, expected);
assert!(condition, "descriptive message");
assert_matches!(result, Ok(value) if value.id == "expected");

// For async tests
#[tokio::test]
async fn test_async_function() {
    let result = async_function().await;
    assert!(result.is_ok());
}
```

### Mocking
```rust
// Use mockall for mocking traits
use mockall::mock;

mock! {
    MyService {}
    
    #[async_trait]
    impl ServiceTrait for MyService {
        async fn call_api(&self, request: Request) -> Result<Response>;
    }
}
```

## Performance Testing

### Benchmarks
```bash
# Run benchmarks
cargo bench

# Profile with flamegraph
cargo install flamegraph
cargo flamegraph --bench my_benchmark
```

### Load Testing
- Use `criterion` for micro-benchmarks
- Use `tokio-test` for async performance testing
- Validate memory usage and allocation patterns

## Debugging Tests

### Test Output
```bash
# Show test output
cargo test -- --nocapture

# Show only failing tests
cargo test -- --nocapture | grep -A 10 "FAILED"

# Run specific test
cargo test test_name -- --exact
```

### Test Debugging
```rust
// Add debug prints
#[test]
fn test_something() {
    println!("Debug info: {:?}", value);
    dbg!(&complex_value);
    assert_eq!(actual, expected);
}
```

## Migration Validation

### Parity Checklist
- [ ] All Go tools have Rust equivalents
- [ ] JSON request/response formats match exactly
- [ ] Error codes and messages are consistent
- [ ] Authentication flows work identically
- [ ] Performance is comparable or better
- [ ] All configuration options are supported

### Validation Process
1. Run Go server and capture API responses
2. Run Rust server with same inputs
3. Compare responses using golden tests
4. Validate error handling and edge cases
5. Performance comparison and optimization

## Troubleshooting

### Common Issues
1. **Serialization Differences**: Check serde attributes and field names
2. **Authentication Failures**: Verify API key format and headers
3. **Async Runtime Issues**: Ensure proper tokio runtime setup
4. **Network Timeouts**: Adjust timeout configurations for tests

### Debug Commands
```bash
# Check compilation
cargo check --workspace

# Verbose test output
RUST_LOG=debug cargo test -- --nocapture

# Test with backtrace
RUST_BACKTRACE=1 cargo test