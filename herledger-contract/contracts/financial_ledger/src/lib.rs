#![no_std]

mod error;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractevent, contractimpl, Address, BytesN, Env, Vec};

use error::Error;
use storage::{
    append_business_event, load_admin, load_asset_status, load_business_events, load_event,
    load_recorder, load_resolver, save_admin, save_asset_status, save_event, save_recorder,
    save_resolver,
};
use types::{EventStatus, EventType, FinancialEvent};

// ---------------------------------------------------------------------------
// Contract events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct SupportedAssetAdded {
    pub asset: Address,
}

#[contractevent]
pub struct SupportedAssetRemoved {
    pub asset: Address,
}

#[contractevent]
pub struct FinancialEventRecorded {
    pub event_id: BytesN<32>,
    pub business_id: BytesN<32>,
}

#[contractevent]
pub struct FinancialEventVerified {
    pub event_id: BytesN<32>,
    pub business_id: BytesN<32>,
}

#[contractevent]
pub struct FinancialEventDisputed {
    pub event_id: BytesN<32>,
    pub business_id: BytesN<32>,
    pub reason_hash: BytesN<32>,
}

#[contractevent]
pub struct FinancialEventRevoked {
    pub event_id: BytesN<32>,
    pub business_id: BytesN<32>,
    pub reason_hash: BytesN<32>,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/// FinancialLedger contract — records and manages HerLedger financial event
/// lifecycle for registered businesses.
///
/// Financial history is never deleted. Revoked events are preserved.
#[contract]
pub struct FinancialLedger;

#[contractimpl]
#[allow(clippy::too_many_arguments)]
impl FinancialLedger {
    /// Initialise the contract with the protocol administrator, recorder, and
    /// resolver authorities.
    ///
    /// # Authorization
    /// `admin` must authorise this call.
    ///
    /// # Errors
    /// - [`Error::AlreadyInitialized`] if already initialised.
    pub fn initialize(
        env: Env,
        admin: Address,
        recorder: Address,
        resolver: Address,
    ) -> Result<(), Error> {
        if load_admin(&env).is_some() {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        save_admin(&env, &admin);
        save_recorder(&env, &recorder);
        save_resolver(&env, &resolver);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Supported asset registry
    // -----------------------------------------------------------------------

    /// Add an asset to the supported-asset registry.
    ///
    /// # Authorization
    /// Protocol administrator only.
    ///
    /// # Errors
    /// - [`Error::AlreadyExists`] if the asset is already enabled.
    pub fn add_supported_asset(env: Env, asset: Address) -> Result<(), Error> {
        let admin = load_admin(&env).ok_or(Error::Unauthorized)?;
        admin.require_auth();

        if load_asset_status(&env, &asset) {
            return Err(Error::AlreadyExists);
        }

        save_asset_status(&env, &asset, true);
        SupportedAssetAdded { asset }.publish(&env);
        Ok(())
    }

    /// Disable an asset in the supported-asset registry.
    /// Historical events using this asset remain valid.
    ///
    /// # Authorization
    /// Protocol administrator only.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if the asset is not currently enabled.
    pub fn remove_supported_asset(env: Env, asset: Address) -> Result<(), Error> {
        let admin = load_admin(&env).ok_or(Error::Unauthorized)?;
        admin.require_auth();

        if !load_asset_status(&env, &asset) {
            return Err(Error::NotFound);
        }

        save_asset_status(&env, &asset, false);
        SupportedAssetRemoved { asset }.publish(&env);
        Ok(())
    }

    /// Returns `true` if the asset is currently in the supported-asset registry.
    pub fn is_supported_asset(env: Env, asset: Address) -> bool {
        load_asset_status(&env, &asset)
    }

    // -----------------------------------------------------------------------
    // Financial event lifecycle
    // -----------------------------------------------------------------------

    /// Record a new HerLedger financial event.
    ///
    /// The application/indexer is responsible for verifying the underlying
    /// Stellar transaction before calling this function.
    ///
    /// # Authorization
    /// Authorised HerLedger recorder (set at initialisation).
    ///
    /// # Rules
    /// - `event_id` must be unique.
    /// - `amount` must be positive (> 0).
    /// - `stellar_reference` must be non-zero.
    /// - `PaymentReceived` and `PaymentSent` require a currently supported asset.
    /// - Event begins with `Pending` status.
    ///
    /// # Errors
    /// - [`Error::DuplicateEvent`] if `event_id` already exists.
    /// - [`Error::InvalidAmount`] if `amount` ≤ 0.
    /// - [`Error::InvalidReference`] if `stellar_reference` is all-zero bytes.
    /// - [`Error::UnsupportedAsset`] if asset is not supported for payment event types.
    #[allow(clippy::too_many_arguments)]
    pub fn record_event(
        env: Env,
        event_id: BytesN<32>,
        business_id: BytesN<32>,
        event_type: EventType,
        asset: Address,
        amount: i128,
        stellar_reference: BytesN<32>,
        metadata_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let recorder = load_recorder(&env).ok_or(Error::Unauthorized)?;
        recorder.require_auth();

        if load_event(&env, &event_id).is_some() {
            return Err(Error::DuplicateEvent);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        if stellar_reference == BytesN::from_array(&env, &[0u8; 32]) {
            return Err(Error::InvalidReference);
        }

        match event_type {
            EventType::PaymentReceived | EventType::PaymentSent => {
                if !load_asset_status(&env, &asset) {
                    return Err(Error::UnsupportedAsset);
                }
            }
            EventType::InvoiceSettled | EventType::CommitmentFulfilled => {}
        }

        let created_at = env.ledger().sequence() as u64;

        let event = FinancialEvent {
            id: event_id.clone(),
            business_id: business_id.clone(),
            event_type,
            asset,
            amount,
            stellar_reference,
            metadata_hash,
            status: EventStatus::Pending,
            created_at,
        };

        save_event(&env, &event);
        append_business_event(&env, &business_id, &event_id);

        FinancialEventRecorded {
            event_id,
            business_id,
        }
        .publish(&env);

        Ok(())
    }

    /// Transition a `Pending` event to `Verified`.
    ///
    /// The authorised verifier calls this after confirming the underlying
    /// Stellar transaction evidence off-chain.
    ///
    /// # Authorization
    /// Authorised HerLedger recorder/verifier (set at initialisation).
    ///
    /// # Errors
    /// - [`Error::NotFound`] if the event does not exist.
    /// - [`Error::InvalidState`] if the event is not `Pending`.
    pub fn verify_event(env: Env, event_id: BytesN<32>) -> Result<(), Error> {
        let recorder = load_recorder(&env).ok_or(Error::Unauthorized)?;
        recorder.require_auth();

        let mut event = load_event(&env, &event_id).ok_or(Error::NotFound)?;

        if event.status != EventStatus::Pending {
            return Err(Error::InvalidState);
        }

        event.status = EventStatus::Verified;
        save_event(&env, &event);

        FinancialEventVerified {
            event_id,
            business_id: event.business_id,
        }
        .publish(&env);

        Ok(())
    }

    /// Dispute a `Verified` event. Only the business owner may dispute their
    /// own events. The original event fields are preserved.
    ///
    /// # Authorization
    /// Registered business owner associated with the event's `business_id`.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if the event does not exist.
    /// - [`Error::DisputeNotAllowed`] if the event is not `Verified`.
    pub fn dispute_event(
        env: Env,
        event_id: BytesN<32>,
        business_owner: Address,
        reason_hash: BytesN<32>,
    ) -> Result<(), Error> {
        business_owner.require_auth();

        let mut event = load_event(&env, &event_id).ok_or(Error::NotFound)?;

        if event.status != EventStatus::Verified {
            return Err(Error::DisputeNotAllowed);
        }

        event.status = EventStatus::Disputed;
        save_event(&env, &event);

        FinancialEventDisputed {
            event_id,
            business_id: event.business_id,
            reason_hash,
        }
        .publish(&env);

        Ok(())
    }

    /// Resolve a `Disputed` event.
    ///
    /// - `valid = true`  → `Disputed` → `Verified`
    /// - `valid = false` → `Disputed` → `Revoked`
    ///
    /// # Authorization
    /// Authorised dispute resolver (set at initialisation).
    ///
    /// # Errors
    /// - [`Error::NotFound`] if the event does not exist.
    /// - [`Error::ResolutionNotAllowed`] if the event is not `Disputed`.
    pub fn resolve_dispute(
        env: Env,
        event_id: BytesN<32>,
        valid: bool,
        resolution_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let resolver = load_resolver(&env).ok_or(Error::Unauthorized)?;
        resolver.require_auth();

        let mut event = load_event(&env, &event_id).ok_or(Error::NotFound)?;

        if event.status != EventStatus::Disputed {
            return Err(Error::ResolutionNotAllowed);
        }

        if valid {
            event.status = EventStatus::Verified;
            save_event(&env, &event);
            FinancialEventVerified {
                event_id,
                business_id: event.business_id,
            }
            .publish(&env);
        } else {
            event.status = EventStatus::Revoked;
            save_event(&env, &event);
            FinancialEventRevoked {
                event_id,
                business_id: event.business_id,
                reason_hash: resolution_hash,
            }
            .publish(&env);
        }

        Ok(())
    }

    /// Revoke any non-revoked event. The record is preserved.
    ///
    /// # Authorization
    /// Authorised dispute resolver (set at initialisation).
    ///
    /// # Errors
    /// - [`Error::NotFound`] if the event does not exist.
    /// - [`Error::InvalidState`] if the event is already `Revoked`.
    pub fn revoke_event(
        env: Env,
        event_id: BytesN<32>,
        reason_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let resolver = load_resolver(&env).ok_or(Error::Unauthorized)?;
        resolver.require_auth();

        let mut event = load_event(&env, &event_id).ok_or(Error::NotFound)?;

        if event.status == EventStatus::Revoked {
            return Err(Error::InvalidState);
        }

        event.status = EventStatus::Revoked;
        save_event(&env, &event);

        FinancialEventRevoked {
            event_id,
            business_id: event.business_id,
            reason_hash,
        }
        .publish(&env);

        Ok(())
    }

    /// Retrieve a financial event by id. Returns `None` if not found.
    pub fn get_event(env: Env, event_id: BytesN<32>) -> Option<FinancialEvent> {
        load_event(&env, &event_id)
    }

    /// Retrieve a paginated list of financial events for a business.
    ///
    /// Events are ordered by insertion time (chronological).
    /// `offset` is zero-based. `limit` is capped at 100.
    pub fn get_business_events(
        env: Env,
        business_id: BytesN<32>,
        offset: u32,
        limit: u32,
    ) -> Vec<FinancialEvent> {
        load_business_events(&env, &business_id, offset, limit)
    }
}
