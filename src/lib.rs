pub mod config;
pub mod harness;
pub mod modules;
pub mod toolsets;
pub mod types;
pub mod utils;

pub use config::Config;
pub use harness::HarnessServer;
pub use types::{HarnessError, TransportType, Scope, LicenseInfo, PaginationOptions};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Default tools that are enabled when no specific toolsets are requested
pub const DEFAULT_TOOLS: &[&str] = &[];

/// Re-export commonly used types
pub mod prelude {
    pub use crate::config::Config;
    pub use crate::harness::HarnessServer;
    pub use crate::types::{HarnessError, TransportType, Scope};
    pub use crate::toolsets::{Tool, Toolset, ToolsetGroup};
    pub use crate::modules::{Module, ModuleRegistry};
}