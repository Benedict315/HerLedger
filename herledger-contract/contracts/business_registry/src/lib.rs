#![no_std]

mod error;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractevent, contractimpl, Address, BytesN, Env};

use error::Error;
use storage::{
    load_business, load_owner_index, load_wallet_index, save_admin, save_business,
    save_owner_index, save_wallet_index,
};
use types::Business;

// ---------------------------------------------------------------------------
// Contract events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct BusinessRegistered {
    pub business_id: BytesN<32>,
    pub owner: Address,
    pub wallet: Address,
}

#[contractevent]
pub struct BusinessMetadataUpdated {
    pub business_id: BytesN<32>,
    pub owner: Address,
}

#[contractevent]
pub struct BusinessDeactivated {
    pub business_id: BytesN<32>,
    pub owner: Address,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/// BusinessRegistry contract — manages woman-owned business registration,
/// metadata integrity, and lifecycle state for the HerLedger protocol.
#[contract]
pub struct BusinessRegistry;

#[contractimpl]
impl BusinessRegistry {
    /// Initialise the contract by setting the protocol administrator.
    ///
    /// # Authorization
    /// Callable only once. The `admin` address must authorise this call.
    ///
    /// # Errors
    /// - [`Error::AlreadyInitialized`] if the contract has already been initialised.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if storage::load_admin(&env).is_some() {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        save_admin(&env, &admin);
        Ok(())
    }

    /// Register a new woman-owned business in the HerLedger protocol.
    ///
    /// # Authorization
    /// `owner` must authorise this call.
    ///
    /// # Rules
    /// - `business_id` must be unique.
    /// - `owner` must not already own an active business.
    /// - `wallet` must not already be registered to another active business.
    /// - Business starts active.
    ///
    /// # Errors
    /// - [`Error::AlreadyExists`] if `business_id` is already registered.
    /// - [`Error::AlreadyRegistered`] if `owner` already owns an active business.
    /// - [`Error::InvalidWallet`] if `wallet` is already in use by another active business.
    pub fn register_business(
        env: Env,
        business_id: BytesN<32>,
        owner: Address,
        wallet: Address,
        metadata_hash: BytesN<32>,
    ) -> Result<(), Error> {
        owner.require_auth();

        if load_business(&env, &business_id).is_some() {
            return Err(Error::AlreadyExists);
        }

        if let Some(existing_id) = load_owner_index(&env, &owner) {
            if let Some(existing) = load_business(&env, &existing_id) {
                if existing.active {
                    return Err(Error::AlreadyRegistered);
                }
            }
        }

        if let Some(existing_id) = load_wallet_index(&env, &wallet) {
            if let Some(existing) = load_business(&env, &existing_id) {
                if existing.active {
                    return Err(Error::InvalidWallet);
                }
            }
        }

        let business = Business {
            id: business_id.clone(),
            owner: owner.clone(),
            wallet: wallet.clone(),
            metadata_hash,
            active: true,
        };

        save_business(&env, &business);
        save_wallet_index(&env, &wallet, &business_id);
        save_owner_index(&env, &owner, &business_id);

        BusinessRegistered {
            business_id,
            owner,
            wallet,
        }
        .publish(&env);

        Ok(())
    }

    /// Update the off-chain metadata hash for an existing active business.
    ///
    /// # Authorization
    /// The registered business owner must authorise this call.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if the business does not exist.
    /// - [`Error::Inactive`] if the business is deactivated.
    pub fn update_metadata(
        env: Env,
        business_id: BytesN<32>,
        metadata_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let mut business = load_business(&env, &business_id).ok_or(Error::NotFound)?;

        if !business.active {
            return Err(Error::Inactive);
        }

        business.owner.require_auth();
        business.metadata_hash = metadata_hash;
        save_business(&env, &business);

        BusinessMetadataUpdated {
            business_id,
            owner: business.owner,
        }
        .publish(&env);

        Ok(())
    }

    /// Deactivate an active business. Historical financial events are preserved.
    ///
    /// # Authorization
    /// The registered business owner must authorise this call.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if the business does not exist.
    /// - [`Error::Inactive`] if the business is already deactivated.
    pub fn deactivate_business(env: Env, business_id: BytesN<32>) -> Result<(), Error> {
        let mut business = load_business(&env, &business_id).ok_or(Error::NotFound)?;

        if !business.active {
            return Err(Error::Inactive);
        }

        business.owner.require_auth();
        business.active = false;
        save_business(&env, &business);

        BusinessDeactivated {
            business_id,
            owner: business.owner,
        }
        .publish(&env);

        Ok(())
    }

    /// Retrieve a business record by its id. Returns `None` if not found.
    pub fn get_business(env: Env, business_id: BytesN<32>) -> Option<Business> {
        load_business(&env, &business_id)
    }

    /// Retrieve a business record by its registered wallet address.
    /// Returns `None` if no business is associated with that wallet.
    pub fn get_business_by_wallet(env: Env, wallet: Address) -> Option<Business> {
        let business_id = load_wallet_index(&env, &wallet)?;
        load_business(&env, &business_id)
    }
}
