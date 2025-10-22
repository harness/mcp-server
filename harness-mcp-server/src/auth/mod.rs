//! Authentication and authorization middleware

pub mod types;
pub mod middleware;

pub use types::{
    AuthProvider, ApiKeyAuth, BearerTokenAuth, JwtAuth, JwtClaims,
    AuthSession, Principal, PrincipalType, AuthContext,
};
pub use middleware::{
    auth_middleware, authenticate_stdio_session, extract_auth_context,
};