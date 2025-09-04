// Build script for harness-mcp

fn main() {
    // Set build-time environment variables
    println!("cargo:rustc-env=VERGEN_GIT_SHA_SHORT=dev");
    println!("cargo:rustc-env=VERGEN_BUILD_TIMESTAMP=unknown");
}