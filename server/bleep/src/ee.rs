//! Modules for Bloop's Enterprise Edition.
//! Please see `LICENSE` for details.

#[cfg(feature = "ee-cloud")]
pub(crate) mod embedder;
#[cfg(feature = "ee-pro")]
pub(crate) mod webserver;
