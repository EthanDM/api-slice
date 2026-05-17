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
export { describeResource } from "./resource.js";
export {
  createSliceRecorder,
  getSliceSnapshot,
} from "./recorder.js";
export {
  command,
  describeStore,
  mutation,
  query,
  store,
} from "./store.js";
export type {
  HttpClient,
  HttpMethod,
  HttpRequestMeta,
  Id,
  Resource,
  ResourceActionDescription,
  ResourceActionConfig,
  ResourceActionMap,
  ResourceActionOutput,
  ResourceActionRequest,
  ResourceActionsClient,
  ResourceClient,
  ResourceConfig,
  ResourceDescription,
  ResourceInvalidation,
  ResourceKeys,
  ResourceMutationName,
  ResourceOperationArgs,
  ResourceOperationConfig,
  ResourceOperationName,
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
export type {
  Store,
  StoreAction,
  StoreActionConfig,
  StoreActionInput,
  StoreActionKind,
  StoreActionMap,
  StoreActionMetadata,
  StoreActionOutput,
  StoreActionRunArgs,
  StoreConfig,
  StoreDescription,
  StoreRunArgs,
  StoreRunOutput,
} from "./store.js";
