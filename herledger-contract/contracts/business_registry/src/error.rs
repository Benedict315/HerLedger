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
    InvalidOwner = 6,
    InvalidWallet = 7,
    AlreadyRegistered = 8,
}
