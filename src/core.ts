/** Dependency-light entrypoint for schemas, resources, and shared API errors. */
export {
  ApiError,
  createApiError,
  getApiErrorMessage,
  isApiError,
  normalizeApiError,
  toApiErrorPayload,
} from "./errors.js";
export type {
  ApiErrorCode,
  ApiErrorInput,
  ApiErrorPayload,
  NormalizedApiError,
} from "./errors.js";
export { resource } from "./resource.js";
export type {
  HttpClient,
  HttpMethod,
  Id,
  Resource,
  ResourceActionConfig,
  ResourceActionMap,
  ResourceActionOutput,
  ResourceActionRequest,
  ResourceActionsClient,
  ResourceClient,
  ResourceConfig,
  ResourceInvalidation,
  ResourceKeys,
  ResourceMutationName,
  ResourceOperationArgs,
  ResourceOperationConfig,
  ResourceOperations,
  ResourceSchemas,
} from "./resource.js";
