import { xdr, Address, nativeToScVal, scValToNative, Contract } from "@stellar/stellar-sdk";
import { ContractError } from "../errors/index.js";

// ---------------------------------------------------------------------------
// Centralized XDR encoding/decoding utilities for Soroban contract calls.
// Never construct raw XDR strings manually.
// ---------------------------------------------------------------------------

/**
 * Encode a hex string (32 bytes) as a Soroban BytesN<32> ScVal.
 */
export function encodeBytes32(hex: string): xdr.ScVal {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 32) {
    throw new ContractError(`Expected 32-byte hex string, got ${bytes.length} bytes`);
  }
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

/**
 * Encode a Stellar address string as a Soroban Address ScVal.
 */
export function encodeAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

/**
 * Encode a bigint as an i128 ScVal.
 */
export function encodeI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

/**
 * Encode a boolean as a bool ScVal.
 */
export function encodeBool(value: boolean): xdr.ScVal {
  return xdr.ScVal.scvBool(value);
}

/**
 * Encode a u32 as a uint32 ScVal.
 */
export function encodeU32(value: number): xdr.ScVal {
  return xdr.ScVal.scvU32(value);
}

/**
 * Decode a BytesN<32> ScVal to a hex string.
 */
export function decodeBytes32(val: xdr.ScVal): string {
  const bytes = val.bytes();
  return Buffer.from(bytes).toString("hex");
}

/**
 * Decode an Address ScVal to a Stellar address string.
 */
export function decodeAddress(val: xdr.ScVal): string {
  return Address.fromScVal(val).toString();
}

/**
 * Decode an i128 ScVal to bigint.
 */
export function decodeI128(val: xdr.ScVal): bigint {
  return BigInt(scValToNative(val) as string | number | bigint);
}

/**
 * Decode a u64 ScVal to bigint.
 */
export function decodeU64(val: xdr.ScVal): bigint {
  return BigInt(scValToNative(val) as string | number | bigint);
}

/**
 * Decode a bool ScVal.
 */
export function decodeBool(val: xdr.ScVal): boolean {
  return val.b();
}

/**
 * Safely decode an Option ScVal — returns null for void/none.
 */
export function decodeOption<T>(val: xdr.ScVal, decoder: (v: xdr.ScVal) => T): T | null {
  if (val.switch() === xdr.ScValType.scvVoid()) return null;
  // SCV_LEDGER_KEY_NONCE or similar None encoding
  try {
    return decoder(val);
  } catch {
    return null;
  }
}

/**
 * Build a contract function call argument list.
 */
export function buildArgs(...args: xdr.ScVal[]): xdr.ScVal[] {
  return args;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
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

export { hexToBytes };
