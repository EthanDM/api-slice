/** Default entrypoint for dependency-light resource contracts and clients. */
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
