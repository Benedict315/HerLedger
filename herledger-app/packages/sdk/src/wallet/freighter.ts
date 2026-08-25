import {
  isConnected,
  getAddress,
  signTransaction,
  requestAccess,
  getNetwork,
} from "@stellar/freighter-api";
import { WalletError, WalletErrorCode } from "../errors/index.js";

// ---------------------------------------------------------------------------
// FreighterWalletProvider
// Implements WalletProvider by delegating to the Freighter browser extension.
// ---------------------------------------------------------------------------

/**
 * Wallet adapter that wraps the Freighter browser extension.
 *
 * Use this class via the `WalletProvider` interface so that future adapters
 * (Albedo, xBull, WalletConnect …) can be swapped in without touching call
 * sites.
 *
 * @example
 * ```ts
 * const wallet: WalletProvider = new FreighterWalletProvider();
 * const { publicKey } = await wallet.connect();
 * const signed = await wallet.signTransaction(xdr, passphrase);
 * await wallet.disconnect();
 * ```
 */
export class FreighterWalletProvider implements WalletProvider {
  /**
   * Check whether the Freighter extension is installed and accessible.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await isConnected();
      return result.isConnected;
    } catch {
      return false;
    }
  }

/**
 * Request access to the user's Freighter wallet.
 * Returns the connected public key.
 * Throws WalletError on failure or rejection.
 */
export async function connectWallet(): Promise<WalletConnection> {
  const available = await isFreighterAvailable();
  if (!available) {
    throw new WalletError(
      WalletErrorCode.NOT_INSTALLED,
      "Freighter wallet extension is not installed or not available. Please install Freighter to continue."
    );
  }

  let accessResult: Awaited<ReturnType<typeof requestAccess>>;
  try {
    accessResult = await requestAccess();
  } catch (cause) {
    throw new WalletError(WalletErrorCode.ACCESS_DENIED, "Failed to request Freighter access", {
      cause,
    });
  }

  if (accessResult.error) {
    throw new WalletError(
      WalletErrorCode.ACCESS_DENIED,
      `Freighter access denied: ${accessResult.error}`,
      { context: { reason: accessResult.error } }
    );
  }

  let addressResult: Awaited<ReturnType<typeof getAddress>>;
  try {
    addressResult = await getAddress();
  } catch (cause) {
    throw new WalletError(
      WalletErrorCode.ADDRESS_UNAVAILABLE,
      "Failed to retrieve wallet address from Freighter",
      { cause }
    );
  }

  if (addressResult.error || !addressResult.address) {
    throw new WalletError(
      WalletErrorCode.ADDRESS_UNAVAILABLE,
      `Could not retrieve wallet address: ${addressResult.error ?? "unknown error"}`,
      { context: { reason: addressResult.error } }
    );
  }

  let networkResult: Awaited<ReturnType<typeof getNetwork>>;
  try {
    networkResult = await getNetwork();
  } catch (cause) {
    throw new WalletError(
      WalletErrorCode.UNAVAILABLE,
      "Failed to retrieve network from Freighter",
      { cause }
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton instance — convenient for components that don't need to
// construct a provider themselves.
// ---------------------------------------------------------------------------

/** Default shared FreighterWalletProvider instance. */
export const freighterWalletProvider = new FreighterWalletProvider();

// ---------------------------------------------------------------------------
// Backward-compatible functional API
// These exports preserve the pre-abstraction surface so existing call sites
// (wallet-connect.tsx, dispute-form.tsx, …) keep compiling while they are
// progressively migrated to useWallet().
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `FreighterWalletProvider.isAvailable()` or the `useWallet()` hook instead.
 */
export async function isFreighterAvailable(): Promise<boolean> {
  return freighterWalletProvider.isAvailable();
}

/**
 * @deprecated Use `FreighterWalletProvider.connect()` or the `useWallet()` hook instead.
 */
export async function connectWallet(): Promise<WalletConnection> {
  return freighterWalletProvider.connect();
}

/**
 * @deprecated Use `FreighterWalletProvider.getAddress()` or the `useWallet()` hook instead.
 */
export async function getConnectedAddress(): Promise<string | null> {
  return freighterWalletProvider.getAddress();
}

/**
 * @deprecated Use `FreighterWalletProvider.signTransaction()` or the `useWallet()` hook instead.
 */
export async function signTransactionWithFreighter(
  transactionXdr: string,
  networkPassphrase: string,
  accountToSign?: string
): Promise<string> {
  let result: Awaited<ReturnType<typeof signTransaction>>;
  try {
    result = await signTransaction(transactionXdr, {
      networkPassphrase,
      ...(accountToSign !== undefined && { address: accountToSign }),
    });
  } catch (cause) {
    throw new WalletError(
      WalletErrorCode.SIGNING_REJECTED,
      "Failed to sign transaction with Freighter",
      { cause }
    );
  }

  if (result.error) {
    throw new WalletError(
      WalletErrorCode.SIGNING_REJECTED,
      `Freighter signing rejected: ${result.error}`,
      { context: { reason: result.error } }
    );
  }

  if (!result.signedTxXdr) {
    throw new WalletError(WalletErrorCode.UNAVAILABLE, "Freighter returned no signed transaction XDR");
  }

  return result.signedTxXdr;
}

// Re-export types so consumers don't need a separate import.
export type { WalletConnection, WalletProvider };
