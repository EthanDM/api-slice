export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";

export type ApiErrorPayload = {
  code: ApiErrorCode;
  message: string;
  status: number;
  details?: unknown;
};

export type ApiErrorInput = {
  code?: ApiErrorCode;
  message?: string;
  status?: number;
  details?: unknown;
  cause?: unknown;
};

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

export class ApiError extends Error implements ApiErrorPayload {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(input: ApiErrorInput = {}) {
    const code = input.code ?? codeFromStatus(input.status) ?? "UNKNOWN_ERROR";
    super(input.message ?? defaultMessages[code], { cause: input.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = input.status ?? statusCodes[code] ?? 500;
    this.details = input.details;
  }

  toJSON(): ApiErrorPayload {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
    };
  }
}

export function createApiError(input: ApiErrorInput = {}): ApiError {
  return new ApiError(input);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

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

export function getApiErrorMessage(error: unknown): string {
  return normalizeApiError(error).message;
}

export function toApiErrorPayload(error: unknown): ApiErrorPayload {
  const normalized = normalizeApiError(error);

  return {
    code: normalized.code,
    message: normalized.message,
    status: normalized.status,
    details: normalized.details,
  };
}

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

function isErrorLike(error: unknown): error is Error {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
}
