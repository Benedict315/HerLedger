#![no_std]

mod error;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractevent, contractimpl, Address, BytesN, Env};

use error::Error;
use storage::{
    load_admin, load_attestation, load_attester, save_admin, save_attestation, save_attester,
};
use types::{Attestation, AttestationStatus, Attester};

// ---------------------------------------------------------------------------
// Contract events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct AttesterRegistered {
    pub attester: Address,
}

#[contractevent]
pub struct AttesterDeactivated {
    pub attester: Address,
}

#[contractevent]
pub struct AttestationCreated {
    pub attestation_id: BytesN<32>,
    pub event_id: BytesN<32>,
    pub attester: Address,
}

#[contractevent]
pub struct AttestationRevoked {
    pub attestation_id: BytesN<32>,
    pub event_id: BytesN<32>,
    pub reason_hash: BytesN<32>,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/// AttestationRegistry contract — manages authorised attesters and the
/// contextual claims they issue against HerLedger financial events.
///
/// Attestations cover claims that Stellar transaction evidence alone cannot
/// establish (e.g. invoice settlement, commitment fulfilment).
/// This contract does not replace Stellar transaction verification.
#[contract]
pub struct AttestationRegistry;

#[contractimpl]
impl AttestationRegistry {
    /// Initialise the contract by setting the protocol administrator.
    ///
    /// # Authorization
    /// `admin` must authorise this call.
    ///
    /// # Errors
    /// - [`Error::AlreadyInitialized`] if already initialised.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if load_admin(&env).is_some() {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        save_admin(&env, &admin);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Attester lifecycle
    // -----------------------------------------------------------------------

    /// Register a new active attester.
    ///
    /// # Authorization
    /// Protocol administrator only.
    ///
    /// # Errors
    /// - [`Error::AlreadyExists`] if the attester is already active.
    pub fn register_attester(
        env: Env,
        attester: Address,
        metadata_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let admin = load_admin(&env).ok_or(Error::Unauthorized)?;
        admin.require_auth();

        if let Some(existing) = load_attester(&env, &attester) {
            if existing.active {
                return Err(Error::AlreadyExists);
            }
        }

        let record = Attester {
            address: attester.clone(),
            active: true,
            metadata_hash,
        };
        save_attester(&env, &record);
        AttesterRegistered { attester }.publish(&env);
        Ok(())
    }

    /// Deactivate an active attester. Historical attestations are preserved.
    ///
    /// # Authorization
    /// Protocol administrator only.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if the attester is not registered.
    /// - [`Error::Inactive`] if the attester is already inactive.
    pub fn deactivate_attester(env: Env, attester: Address) -> Result<(), Error> {
        let admin = load_admin(&env).ok_or(Error::Unauthorized)?;
        admin.require_auth();

        let mut record = load_attester(&env, &attester).ok_or(Error::NotFound)?;
        if !record.active {
            return Err(Error::Inactive);
        }

        record.active = false;
        save_attester(&env, &record);
        AttesterDeactivated { attester }.publish(&env);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Attestation lifecycle
    // -----------------------------------------------------------------------

    /// Create a new active attestation for a HerLedger financial event.
    ///
    /// # Authorization
    /// The calling attester must be registered and active.
    ///
    /// # Errors
    /// - [`Error::InvalidAttester`] if the attester is not registered.
    /// - [`Error::InactiveAttester`] if the attester is not active.
    /// - [`Error::DuplicateAttestation`] if `attestation_id` already exists.
    pub fn create_attestation(
        env: Env,
        attestation_id: BytesN<32>,
        event_id: BytesN<32>,
        attester: Address,
        claim_hash: BytesN<32>,
    ) -> Result<(), Error> {
        attester.require_auth();

        let attester_record = load_attester(&env, &attester).ok_or(Error::InvalidAttester)?;
        if !attester_record.active {
            return Err(Error::InactiveAttester);
        }

        if load_attestation(&env, &attestation_id).is_some() {
            return Err(Error::DuplicateAttestation);
        }

        let issued_at = env.ledger().sequence() as u64;

        let attestation = Attestation {
            id: attestation_id.clone(),
            event_id: event_id.clone(),
            attester: attester.clone(),
            claim_hash,
            issued_at,
            status: AttestationStatus::Active,
        };

        save_attestation(&env, &attestation);

        AttestationCreated {
            attestation_id,
            event_id,
            attester,
        }
        .publish(&env);

        Ok(())
    }

    /// Revoke an active attestation. The historical record is preserved.
    ///
    /// # Authorization
    /// The issuing attester must authorise this call.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if the attestation does not exist.
    /// - [`Error::InvalidState`] if the attestation is already revoked.
    pub fn revoke_attestation(
        env: Env,
        attestation_id: BytesN<32>,
        reason_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let mut attestation = load_attestation(&env, &attestation_id).ok_or(Error::NotFound)?;

        attestation.attester.require_auth();

        if attestation.status == AttestationStatus::Revoked {
            return Err(Error::InvalidState);
        }

        attestation.status = AttestationStatus::Revoked;
        save_attestation(&env, &attestation);

        AttestationRevoked {
            attestation_id,
            event_id: attestation.event_id,
            reason_hash,
        }
        .publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Read-only queries
    // -----------------------------------------------------------------------

    /// Retrieve an attestation by id. Returns `None` if not found.
    pub fn get_attestation(env: Env, attestation_id: BytesN<32>) -> Option<Attestation> {
        load_attestation(&env, &attestation_id)
    }

    /// Returns `true` if the attestation exists and is currently `Active`.
    pub fn is_valid_attestation(env: Env, attestation_id: BytesN<32>) -> bool {
        match load_attestation(&env, &attestation_id) {
            Some(a) => a.status == AttestationStatus::Active,
            None => false,
        }
    }
}
