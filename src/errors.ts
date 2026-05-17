/** Stable machine-readable categories shared by server payloads and clients. */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";

/** JSON-safe error envelope that can cross HTTP boundaries. */
export type ApiErrorPayload = {
  /** Stable category that callers can branch on without parsing message text. */
  code: ApiErrorCode;
  /** Human-readable fallback message suitable for logs or simple UI. */
  message: string;
  /** HTTP-style status used by fetch and server adapters. */
  status: number;
  /** Optional structured validation/backend details preserved for advanced callers. */
  details?: unknown;
};

/** Constructor input for errors created inside adapters or server handlers. */
export type ApiErrorInput = {
  /** Optional category; inferred from status when omitted. */
  code?: ApiErrorCode;
  /** Optional message; falls back to the code's default message when omitted. */
  message?: string;
  /** Optional HTTP-style status; inferred from code when omitted. */
  status?: number;
  /** Optional structured payload for validation errors or backend diagnostics. */
  details?: unknown;
  /** Original thrown value retained on the Error instance but omitted from JSON. */
  cause?: unknown;
};

/** Error payload plus the original thrown value when normalization preserves it. */
export type NormalizedApiError = ApiErrorPayload & {
  cause?: unknown;
};

const defaultMessages: Record<ApiErrorCode, string> = {
  BAD_REQUEST: "Bad request",
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Not found",
  CONFLICT: "Conflict",
  VALIDATION_ERROR: "Validation failed",
  INTERNAL_ERROR: "Internal server error",
  UNKNOWN_ERROR: "Something went wrong",
};

const statusCodes: Partial<Record<ApiErrorCode, number>> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
  UNKNOWN_ERROR: 500,
};

/**
 * Error type used when Slice can represent a failure as an HTTP-like API
 * problem. `details` intentionally remains unknown so validation libraries and
 * backend envelopes can keep their own structured payloads.
 */
export class ApiError extends Error implements ApiErrorPayload {
  /** Stable category inferred from status when callers do not provide one. */
  readonly code: ApiErrorCode;
  /** HTTP-style status inferred from code when callers do not provide one. */
  readonly status: number;
  /** Structured backend or validation details; never interpreted by ApiError itself. */
  readonly details?: unknown;

  /** Creates an API error, inferring missing code/status defaults when possible. */
  constructor(input: ApiErrorInput = {}) {
    const code = input.code ?? codeFromStatus(input.status) ?? "UNKNOWN_ERROR";
    super(input.message ?? defaultMessages[code], { cause: input.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = input.status ?? statusCodes[code] ?? 500;
    this.details = input.details;
  }

  /** Serializes the error into the payload shape understood by Slice clients. */
  toJSON(): ApiErrorPayload {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
    };
  }
}

/** Convenience factory for call sites that prefer functions over `new`. */
export function createApiError(input: ApiErrorInput = {}): ApiError {
  return new ApiError(input);
}

/** Narrows errors created by Slice without treating arbitrary envelopes as trusted. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Converts any thrown value into a displayable API error shape. Unknown
 * non-Error values intentionally collapse to a generic message to avoid leaking
 * arbitrary payloads into user-facing UI.
 */
export function normalizeApiError(error: unknown): NormalizedApiError {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
      cause: error.cause,
    };
  }

  if (isErrorLike(error)) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
      status: 500,
      cause: error,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: defaultMessages.UNKNOWN_ERROR,
    status: 500,
    cause: error,
  };
}

/** Returns the safest user-facing message Slice can derive from a thrown value. */
export function getApiErrorMessage(error: unknown): string {
  return normalizeApiError(error).message;
}

/**
 * Drops non-serializable `cause` data so server adapters can send normalized
 * failures over HTTP.
 */
export function toApiErrorPayload(error: unknown): ApiErrorPayload {
  const normalized = normalizeApiError(error);

  return {
    code: normalized.code,
    message: normalized.message,
    status: normalized.status,
    details: normalized.details,
  };
}

/** Maps common HTTP statuses to stable Slice error codes. */
function codeFromStatus(status?: number): ApiErrorCode | undefined {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION_ERROR";
    default:
      return status && status >= 500 ? "INTERNAL_ERROR" : undefined;
  }
}

/** Accepts Error-like objects from runtimes or test doubles without trusting shape fully. */
function isErrorLike(error: unknown): error is Error {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
}
