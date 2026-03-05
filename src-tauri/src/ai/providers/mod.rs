use std::sync::Arc;

use super::AIProvider;

pub mod ppio;

pub use ppio::PPIOProvider;

pub fn build_default_providers() -> Vec<Arc<dyn AIProvider>> {
    vec![Arc::new(PPIOProvider::new())]
}
