/** Full package entrypoint that includes optional adapters. */
export * from "./core.js";
export { createFetchHttpClient } from "./fetch.js";
export type {
  FetchHttpClientAuth,
  FetchHttpClientConfig,
  FetchHttpClientErrorLogEvent,
  FetchHttpClientLogEvent,
  FetchHttpClientLogger,
  FetchHttpClientRequestLogEvent,
  FetchHttpClientResponseLogEvent,
} from "./fetch.js";
export { createHonoResourceRoutes } from "./hono.js";
export type {
  HonoResourceHandlerContext,
  HonoResourceHandlers,
} from "./hono.js";
export {
  clearResourceQueries,
  clearSliceQueries,
  createResourceHooks,
  getSliceQuerySnapshot,
  invalidateResource,
  invalidateResourceQueries,
} from "./react-query.js";
export type {
  DeleteVariables,
  ResourceHooks,
  ResourceMutationOptions,
  ResourceQueryOptions,
  SliceQuerySnapshot,
  SliceQuerySnapshotEntry,
  UpdateVariables,
} from "./react-query.js";
