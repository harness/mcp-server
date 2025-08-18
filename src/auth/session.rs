//! Session management utilities

use crate::auth::Session;

/// Session context key for storing session in request context
#[derive(Debug, Clone, Copy)]
pub struct SessionKey;

/// Extension trait for adding session to context
pub trait SessionExt {
    /// Add session to context
    fn with_session(self, session: Session) -> Self;
    
    /// Get session from context
    fn session(&self) -> Option<&Session>;
}

// Note: In a real implementation, this would integrate with the HTTP framework
// being used (like axum) to provide request-scoped session storage.
// For now, this is a placeholder structure.