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
    InvalidAttester = 7,
    InactiveAttester = 8,
    DuplicateAttestation = 9,
    InvalidAttestation = 10,
}
