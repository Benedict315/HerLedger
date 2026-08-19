import { xdr, Address, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { ContractError } from "../errors/index.js";

// ---------------------------------------------------------------------------
// Centralized XDR encoding/decoding utilities for Soroban contract calls.
// Never construct raw XDR strings manually.
// ---------------------------------------------------------------------------

/**
 * Encode a 32-byte hex string as a Soroban `Bytes` ScVal.
 *
 * @param hex - 64-character hex string (optionally `0x`-prefixed) encoding
 *   exactly 32 bytes (e.g. a business ID, event ID, or metadata hash).
 * @returns An `xdr.ScVal` holding the raw 32 bytes.
 * @throws {ContractError} if `hex` does not decode to exactly 32 bytes.
 *
 * @example
 * ```ts
 * const businessIdScVal = encodeBytes32("a".repeat(64));
 * ```
 */
export function encodeBytes32(hex: string): xdr.ScVal {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 32) {
    throw new ContractError(`Expected 32-byte hex string, got ${bytes.length} bytes`);
  }
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

/**
 * Encode a Stellar address string as a Soroban `Address` ScVal.
 *
 * @param address - A `G...` (or muxed `M...`) Stellar public key.
 * @returns An `xdr.ScVal` address value.
 * @throws {Error} if `address` is not a well-formed Stellar StrKey.
 *
 * @example
 * ```ts
 * const walletScVal = encodeAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX");
 * ```
 */
export function encodeAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

/**
 * Encode a bigint as an i128 ScVal.
 *
 * @param value - The i128 amount to encode. May be negative.
 * @returns An `xdr.ScVal` i128 value.
 *
 * @example
 * ```ts
 * const amountScVal = encodeI128(10000000n);
 * ```
 */
export function encodeI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

/**
 * Encode a boolean as a Soroban bool ScVal.
 *
 * @param value - The boolean to encode.
 * @returns An `xdr.ScVal` bool value.
 *
 * @example
 * ```ts
 * const validScVal = encodeBool(true);
 * ```
 */
export function encodeBool(value: boolean): xdr.ScVal {
  return xdr.ScVal.scvBool(value);
}

/**
 * Encode a u32 as a Soroban uint32 ScVal.
 *
 * @param value - A non-negative integer within the u32 range.
 * @returns An `xdr.ScVal` u32 value.
 *
 * @example
 * ```ts
 * const limitScVal = encodeU32(20);
 * ```
 */
export function encodeU32(value: number): xdr.ScVal {
  return xdr.ScVal.scvU32(value);
}

/**
 * Decode a Soroban `Bytes` ScVal into a hex string.
 *
 * @param val - An `xdr.ScVal` holding bytes.
 * @returns The lowercase hex encoding of the bytes.
 *
 * @example
 * ```ts
 * const businessId = decodeBytes32(retval);
 * ```
 */
export function decodeBytes32(val: xdr.ScVal): string {
  const bytes = val.bytes();
  return Buffer.from(bytes).toString("hex");
}

/**
 * Decode a Soroban `Address` ScVal to a Stellar address string.
 *
 * @param val - An `xdr.ScVal` holding an address.
 * @returns The `G...` (or muxed) address string.
 *
 * @example
 * ```ts
 * const wallet = decodeAddress(fields.wallet);
 * ```
 */
export function decodeAddress(val: xdr.ScVal): string {
  return Address.fromScVal(val).toString();
}

/**
 * Decode an i128 ScVal to a bigint. Never casts through `Number`, so large
 * amounts preserve full precision.
 *
 * @param val - An `xdr.ScVal` holding an i128.
 * @returns The decoded value as a `bigint`.
 *
 * @example
 * ```ts
 * const amount = decodeI128(fields.amount);
 * ```
 */
export function decodeI128(val: xdr.ScVal): bigint {
  const native = scValToNative(val);
  if (typeof native === "bigint") return native;
  return BigInt(String(native));
}

/**
 * Decode a u64 ScVal to a bigint.
 *
 * @param val - An `xdr.ScVal` holding a u64.
 * @returns The decoded value as a `bigint`.
 *
 * @example
 * ```ts
 * const ledger = decodeU64(fields.created_at);
 * ```
 */
export function decodeU64(val: xdr.ScVal): bigint {
  const native = scValToNative(val);
  if (typeof native === "bigint") return native;
  return BigInt(String(native));
}

/**
 * Decode a Soroban bool ScVal.
 *
 * @param val - An `xdr.ScVal` holding a bool.
 * @returns The decoded boolean.
 *
 * @example
 * ```ts
 * const active = decodeBool(fields.active);
 * ```
 */
export function decodeBool(val: xdr.ScVal): boolean {
  return val.b();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a hex string (with or without a `0x` prefix) to a byte array.
 *
 * @param hex - Hex string of even length.
 * @returns A `Uint8Array` of the decoded bytes.
 * @throws {ContractError} if `hex` has an odd length or a non-hex character.
 *
 * @example
 * ```ts
 * const bytes = hexToBytes("0x00ff");
 * ```
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new ContractError(`Invalid hex string length: ${clean.length}`);
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new ContractError(`Invalid hex character at position ${i}`);
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}
