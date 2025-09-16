pub mod module;
pub mod registry;
pub mod core;
pub mod ci;
pub mod cd;
pub mod ccm;
pub mod sto;
pub mod scs;
pub mod idp;
pub mod chaos;

pub use module::{Module, ModuleInfo};
pub use registry::ModuleRegistry;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}