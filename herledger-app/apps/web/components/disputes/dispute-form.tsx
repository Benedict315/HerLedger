"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ErrorMessage } from "@/components/ui/error-message";
import { disputeFinancialEvent, getConnectedAddress } from "@herledger/sdk";
import { getPublicEnv } from "@herledger/config";
import { Account } from "@stellar/stellar-sdk";
import type { StellarNetworkConfig, ContractConfig } from "@herledger/sdk";

interface DisputeFormProps {
  eventId: string;
  onSuccess: () => void;
}

function getConfigs(): { stellar: StellarNetworkConfig; contracts: ContractConfig } {
  const env = getPublicEnv();
  return {
    stellar: {
      network: env.NEXT_PUBLIC_STELLAR_NETWORK,
      rpcUrl: env.NEXT_PUBLIC_STELLAR_RPC_URL,
      horizonUrl: "",
      networkPassphrase:
        env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
          ? "Public Global Stellar Network ; September 2015"
          : "Test SDF Network ; September 2015",
    },
    contracts: {
      businessRegistryId: env.NEXT_PUBLIC_BUSINESS_REGISTRY_CONTRACT_ID,
      financialLedgerId: env.NEXT_PUBLIC_FINANCIAL_LEDGER_CONTRACT_ID,
      attestationRegistryId: env.NEXT_PUBLIC_ATTESTATION_REGISTRY_CONTRACT_ID,
    },
  };
}

function hashReason(reason: string): string {
  let hash = 0;
  for (let i = 0; i < reason.length; i++) {
    hash = (hash << 5) - hash + reason.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

export function DisputeForm({ eventId, onSuccess }: DisputeFormProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaveWarning(null);
    setLoading(true);

    try {
      const ownerAddress = await getConnectedAddress();
      if (!ownerAddress) {
        setError("No Stellar wallet connected. Please connect your wallet first.");
        setLoading(false);
        return;
      }

      const reasonHash = hashReason(reason);
      const { stellar, contracts } = getConfigs();
      const sourceAccount = new Account(ownerAddress, "0");

      const result = await disputeFinancialEvent(
        {
          eventId,
          reasonHash,
          owner: ownerAddress,
          sourceAccount,
        },
        stellar,
        contracts
      );

      if (result.success) {
        setTxHash(result.hash);

        // The on-chain dispute is now the source of truth (EventStatus is
        // already Disputed). Persisting the plaintext reason off-chain is a
        // best-effort follow-up -- if it fails, we surface a warning but do
        // NOT treat the dispute submission itself as failed, since retrying
        // the on-chain call would raise a duplicate dispute.
        try {
          const saveRes = await fetch("/api/disputes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, reason, reasonHash }),
          });
          if (!saveRes.ok) {
            setSaveWarning(
              "Your dispute was recorded on-chain, but we could not save your reason text for later reference. Keep a copy of it yourself."
            );
          }
        } catch {
          setSaveWarning(
            "Your dispute was recorded on-chain, but we could not save your reason text for later reference. Keep a copy of it yourself."
          );
        }

      } else {
        setError("Dispute transaction did not succeed. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispute submission failed.");
    } finally {
      setLoading(false);
    }
  }

  if (txHash) {
    const network = getPublicEnv().NEXT_PUBLIC_STELLAR_NETWORK;
    return (
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Dispute submitted
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9375rem", marginBottom: "1rem" }}>
          This event's status is now Disputed. You can track its resolution
          from the dispute list.
        </p>
        <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
          <a
            href={`https://stellar.expert/explorer/${network}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View dispute transaction on Stellar Expert
          </a>
        </p>
        {saveWarning && <ErrorMessage message={saveWarning} />}
        <button
          type="button"
          onClick={onSuccess}
          style={{
            width: "100%",
            padding: "0.625rem 1rem",
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius)",
            fontSize: "1rem",
            fontWeight: 500,
            cursor: "pointer",
            marginTop: "0.5rem",
          }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        Challenge this record
      </h2>
      <p style={{ color: "var(--muted)", fontSize: "0.9375rem", marginBottom: "1rem" }}>
        Submitting a dispute changes the HerLedger record state to Disputed.
        It does not alter the original Stellar transaction — blockchain history
        cannot be modified.
      </p>

      {error && <ErrorMessage message={error} />}

      <form onSubmit={(e) => void handleSubmit(e)}>
        <FormField
          id="reason"
          label="Reason for dispute"
          type="text"
          value={reason}
          onChange={setReason}
          required
          description="Your reason is hashed on-chain, and the full text is saved encrypted so you can look it up later."
        />
        <SubmitButton loading={loading}>Submit dispute</SubmitButton>
      </form>
    </div>
  );
}
