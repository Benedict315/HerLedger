import {
  getStellarNetworkConfig,
  getContractConfig as getRawContractConfig,
} from "@herledger/config";
import { registerCurrentNetworkAddresses, buildContractConfig } from "@herledger/sdk/contracts";
import type { ContractConfig, StellarNetworkConfig } from "@herledger/sdk/types";

// ---------------------------------------------------------------------------
// Server-only Stellar network + contract config, for API routes that need to
// make on-chain RPC calls (e.g. re-validating an attestation server-side).
// Mirrors indexer/src/jobs/sync-ledger.ts's construction — do not import
// this from client components, it reads server-only env vars.
// ---------------------------------------------------------------------------
export function getServerStellarConfig(): StellarNetworkConfig {
  return getStellarNetworkConfig();
}

export function getServerContractConfig(): ContractConfig {
  const stellarConfig = getStellarNetworkConfig();
  const rawContractConfig = getRawContractConfig();
  const registry = registerCurrentNetworkAddresses(stellarConfig.network, rawContractConfig);
  return buildContractConfig(registry, stellarConfig.network, rawContractConfig);
}
