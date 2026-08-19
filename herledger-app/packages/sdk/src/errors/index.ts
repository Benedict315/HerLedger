// ---------------------------------------------------------------------------
// Typed application errors
// ---------------------------------------------------------------------------

export class WalletError extends Error {
  readonly kind = "WalletError" as const;
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "WalletError";
  }
}

/**
 * Known machine-readable error codes emitted by `RpcError`. Consumers can
 * branch on `error.code` without string-matching the human-readable message.
 */
export type RpcErrorCode =
  | "SIMULATION_FAILED"
  | "SUBMIT_FAILED"
  | "TRY_AGAIN_LATER_TIMEOUT"
  | "POLL_FAILED"
  | "POLL_TIMEOUT"
  | "ABORTED";

export class RpcError extends Error {
  readonly kind = "RpcError" as const;
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly code?: RpcErrorCode | string
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export class ContractError extends Error {
  readonly kind = "ContractError" as const;
  constructor(
    message: string,
    public readonly contractCode?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ContractError";
  }
}

export class ValidationError extends Error {
  readonly kind = "ValidationError" as const;
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends Error {
  readonly kind = "AuthenticationError" as const;
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export type AppError =
  | WalletError
  | RpcError
  | ContractError
  | ValidationError
  | AuthenticationError;
