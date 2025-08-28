use std::process::Command;

fn main() {
    // Get git commit hash
    let output = Command::new("git")
        .args(&["rev-parse", "HEAD"])
        .output()
        .unwrap_or_else(|_| {
            std::process::Output {
                status: std::process::ExitStatus::from_raw(1),
                stdout: b"unknown".to_vec(),
                stderr: Vec::new(),
            }
        });

    let git_hash = if output.status.success() {
        String::from_utf8(output.stdout).unwrap_or_else(|_| "unknown".to_string())
    } else {
        "unknown".to_string()
    };

    println!("cargo:rustc-env=GIT_HASH={}", git_hash.trim());
    
    // Set build timestamp
    let timestamp = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC");
    println!("cargo:rustc-env=BUILD_TIMESTAMP={}", timestamp);
}