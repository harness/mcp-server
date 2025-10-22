//! Module system for organizing tools and capabilities

pub mod types;

pub use types::{
    Module, ModuleInfo, ModuleRegistry, LicenseInfo, filter_modules_by_license,
};

// TODO: Implement specific modules
// pub mod core;
// pub mod ci;
// pub mod cd;
// pub mod ccm;
// pub mod sei;
// pub mod sto;
// pub mod chaos;
// pub mod code;
// pub mod idp;
// And more...