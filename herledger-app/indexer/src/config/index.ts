import { getServerEnv } from "@herledger/config";
import type { StellarNetworkConfig, ContractConfig } from "@herledger/sdk";

export function getStellarNetworkConfig(): StellarNetworkConfig {
  const env = getServerEnv();
  return {
    network: env.STELLAR_NETWORK,
    rpcUrl: env.STELLAR_RPC_URL,
    horizonUrl: env.STELLAR_HORIZON_URL,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
  };
}

export function getContractConfig(): ContractConfig {
  const env = getServerEnv();
  return {
    businessRegistryId: env.BUSINESS_REGISTRY_CONTRACT_ID,
    financialLedgerId: env.FINANCIAL_LEDGER_CONTRACT_ID,
    attestationRegistryId: env.ATTESTATION_REGISTRY_CONTRACT_ID,
  };
}
