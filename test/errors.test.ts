import { describe, expect, it } from "vitest";

import {
  ApiError,
  createApiError,
  getApiErrorMessage,
  isApiError,
  normalizeApiError,
} from "../src/index.js";

describe("ApiError", () => {
  it("uses status defaults for known codes", () => {
    const error = new ApiError({
      code: "VALIDATION_ERROR",
      details: { name: ["Required"] },
    });

    expect(error.status).toBe(422);
    expect(error.message).toBe("Validation failed");
    expect(error.toJSON()).toEqual({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      status: 422,
      details: { name: ["Required"] },
    });
  });

  it("infers code from status", () => {
    const error = createApiError({ status: 404 });

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Not found");
  });

  it("normalizes unknown errors", () => {
    const error = new Error("Network failed");

    expect(isApiError(error)).toBe(false);
    expect(normalizeApiError(error)).toEqual({
      code: "UNKNOWN_ERROR",
      message: "Network failed",
      status: 500,
      cause: error,
    });
    expect(getApiErrorMessage("nope")).toBe("Something went wrong");
  });
});
