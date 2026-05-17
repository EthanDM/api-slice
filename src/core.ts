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
export {
  createSliceRecorder,
  getSliceSnapshot,
} from "./recorder.js";
export type {
  HttpClient,
  HttpMethod,
  HttpRequestMeta,
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
export type {
  SliceRecorder,
  SliceRecorderConfig,
  SliceRecorderEvent,
  SliceRecorderEventType,
  SliceRecorderRequest,
  SliceRecorderUnsubscribe,
  SliceSnapshot,
} from "./recorder.js";
