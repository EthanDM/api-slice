export {
  ApiError,
  createApiError,
  getApiErrorMessage,
  isApiError,
  normalizeApiError,
  toApiErrorPayload,
} from "./errors.js";
export { createFetchHttpClient } from "./fetch.js";
export type {
  FetchHttpClientConfig,
  FetchHttpClientErrorLogEvent,
  FetchHttpClientLogEvent,
  FetchHttpClientLogger,
  FetchHttpClientRequestLogEvent,
  FetchHttpClientResponseLogEvent,
} from "./fetch.js";
export type {
  ApiErrorCode,
  ApiErrorInput,
  ApiErrorPayload,
  NormalizedApiError,
} from "./errors.js";
export { resource } from "./resource.js";
export {
  createResourceHooks,
  invalidateResourceQueries,
} from "./react-query.js";
export { createHonoResourceRoutes } from "./hono.js";
export type {
  HonoResourceHandlerContext,
  HonoResourceHandlers,
} from "./hono.js";
export type {
  DeleteVariables,
  ResourceHooks,
  ResourceMutationOptions,
  ResourceQueryOptions,
  UpdateVariables,
} from "./react-query.js";
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
