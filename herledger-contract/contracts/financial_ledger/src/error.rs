use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    AlreadyExists = 2,
    NotFound = 3,
    Unauthorized = 4,
    Inactive = 5,
    InvalidState = 6,
    UnsupportedAsset = 7,
    DuplicateEvent = 8,
    InvalidAmount = 9,
    InvalidReference = 10,
    DisputeNotAllowed = 11,
    ResolutionNotAllowed = 12,
}
