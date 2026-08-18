import { getServerEnv, validateNetworkConsistency } from "@herledger/config";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const env = getServerEnv();
    validateNetworkConsistency(
      env.STELLAR_NETWORK,
      env.STELLAR_RPC_URL,
      env.STELLAR_NETWORK_PASSPHRASE
    );
  }
}
