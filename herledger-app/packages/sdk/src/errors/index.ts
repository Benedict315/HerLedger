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

export class RpcError extends Error {
  readonly kind = "RpcError" as const;
  constructor(
    message: string,
    public readonly cause?: unknown
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
