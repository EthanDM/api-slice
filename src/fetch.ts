/**
 * Fetch-based transport adapter for Slice resource clients. It stays dependency
 * free so browser, Node, and React Native apps can provide the runtime fetch
 * implementation that fits their environment.
 */
import { ApiError, type ApiErrorPayload } from "./errors.js";
import type { HttpClient } from "./resource.js";

type HttpRequest = Parameters<HttpClient>[0];

/** Event fields shared by all fetch adapter logging callbacks. */
export type FetchHttpClientLogEvent = {
  /** HTTP verb emitted by the resource client. */
  method: HttpRequest["method"];
  /** Resource-relative path before `baseUrl` is applied. */
  path: string;
  /** Final URL passed to fetch, including serialized query params. */
  url: string;
  /** Original query object from the resource client, before URL serialization. */
  query?: unknown;
  /** Original request body before JSON serialization. */
  body?: unknown;
  /** Millisecond timestamp captured before request logging and fetch execution. */
  startedAt: number;
  /** Resolved headers after defaults and auth callbacks have run. */
  headers?: Record<string, string>;
};

/** Emitted immediately before the fetch adapter starts a network request. */
export type FetchHttpClientRequestLogEvent = FetchHttpClientLogEvent;

/** Emitted after a successful HTTP response has been parsed. */
export type FetchHttpClientResponseLogEvent = FetchHttpClientLogEvent & {
  /** HTTP status returned by fetch for successful responses. */
  status: number;
  /** Milliseconds elapsed from request log event creation to response logging. */
  durationMs: number;
};

/** Emitted for network failures and non-2xx responses after normalization. */
export type FetchHttpClientErrorLogEvent = FetchHttpClientLogEvent & {
  /** Thrown network error or normalized ApiError for non-2xx responses. */
  error: unknown;
  /** Milliseconds elapsed from request log event creation to error logging. */
  durationMs: number;
  /** Available when the failure was normalized to an ApiError. */
  status?: number;
};

/**
 * Optional observer hooks for integrating with console logs, Sentry
 * breadcrumbs, Datadog, or app-specific telemetry. Slice never redacts by
 * default because it cannot know which fields are sensitive for a given API.
 */
export type FetchHttpClientLogger = {
  /** Called before fetch starts. */
  request?: (event: FetchHttpClientRequestLogEvent) => void;
  /** Called after a successful response is parsed. */
  response?: (event: FetchHttpClientResponseLogEvent) => void;
  /** Called after a network failure or normalized non-2xx response. */
  error?: (event: FetchHttpClientErrorLogEvent) => void;
  /** Last chance to remove tokens, PII, or payloads before callbacks receive events. */
  redact?: <Event extends FetchHttpClientLogEvent>(event: Event) => Event;
};

/** Configuration for the dependency-free JSON fetch adapter. */
export type FetchHttpClientConfig = {
  /** Optional base URL; omitted means paths remain relative for app-local APIs. */
  baseUrl?: string;
  /** Runtime fetch implementation, useful for tests and non-browser environments. */
  fetch?: typeof fetch;
  /** Static or async headers resolved for every request. */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  /** Optional structured observer callbacks around request lifecycle. */
  logger?: FetchHttpClientLogger;
};

/**
 * Creates an `HttpClient` backed by fetch. The adapter sends JSON bodies,
 * parses JSON/text/empty responses, normalizes non-2xx responses as `ApiError`,
 * and emits optional structured log events around the request lifecycle.
 *
 * @throws When no fetch implementation is available, or when the response body
 * cannot be parsed according to its content type.
 */
export function createFetchHttpClient(
  config: FetchHttpClientConfig = {},
): HttpClient {
  const fetchImpl = config.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("createFetchHttpClient requires a fetch implementation");
  }

  return async <Output>(request: HttpRequest) => {
    const url = buildUrl(config.baseUrl, request.path, request.query);
    const headers = await buildHeaders(config.headers, request.body);
    const startedAt = Date.now();
    const logEvent: FetchHttpClientLogEvent = {
      method: request.method,
      path: request.path,
      url,
      query: request.query,
      body: request.body,
      startedAt,
      headers: headersToRecord(headers),
    };

    logRequest(config.logger, logEvent);

    try {
      const response = await fetchImpl(url, {
        method: request.method,
        headers,
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
      });
      const output = await readResponse(response);

      if (!response.ok) {
        throw createResponseError(response, output);
      }

      logResponse(config.logger, logEvent, response);

      return output as Output;
    } catch (error) {
      logError(config.logger, logEvent, error);
      throw error;
    }
  };
}

/** Builds headers after auth callbacks run and fills JSON defaults only when absent. */
async function buildHeaders(
  headers: FetchHttpClientConfig["headers"],
  body: unknown,
): Promise<Headers> {
  const resolvedHeaders =
    typeof headers === "function" ? await headers() : headers;
  const requestHeaders = new Headers(resolvedHeaders);

  if (body !== undefined && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }

  if (!requestHeaders.has("accept")) {
    requestHeaders.set("accept", "application/json");
  }

  return requestHeaders;
}

/** Builds absolute URLs when `baseUrl` is set and relative URLs for app-local calls. */
function buildUrl(baseUrl: string | undefined, path: string, query: unknown): string {
  const url = new URL(path, baseUrl ?? "http://slice.local");

  if (query && typeof query === "object") {
    for (const [key, value] of Object.entries(query)) {
      appendQueryValue(url.searchParams, key, value);
    }
  }

  if (!baseUrl) {
    return `${url.pathname}${url.search}`;
  }

  return url.toString();
}

/** Appends array query values as repeated keys and skips nullish values. */
function appendQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: unknown,
): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryValue(searchParams, key, item);
    }
    return;
  }

  searchParams.append(key, String(value));
}

/** Reads response bodies using HTTP semantics: 204 and empty bodies become undefined. */
async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();

  if (!text) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return text;
  }

  return JSON.parse(text) as unknown;
}

/** Converts backend error payloads into the shared Slice error model. */
function createResponseError(response: Response, output: unknown): ApiError {
  if (isApiErrorPayload(output)) {
    return new ApiError({
      code: output.code,
      message: output.message,
      status: output.status || response.status,
      details: output.details,
    });
  }

  return new ApiError({
    status: response.status,
    message: response.statusText || undefined,
    details: output,
  });
}

/** Detects the JSON error envelope produced by Slice-compatible servers. */
function isApiErrorPayload(output: unknown): output is ApiErrorPayload {
  return (
    typeof output === "object" &&
    output !== null &&
    "code" in output &&
    "message" in output &&
    typeof output.code === "string" &&
    typeof output.message === "string"
  );
}

/** Converts Headers into a plain object so logger events are serializable. */
function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

/** Emits request events after applying the caller-provided redaction policy. */
function logRequest(
  logger: FetchHttpClientLogger | undefined,
  event: FetchHttpClientLogEvent,
): void {
  logger?.request?.(redact(logger, event));
}

/** Emits response events with elapsed time measured from request construction. */
function logResponse(
  logger: FetchHttpClientLogger | undefined,
  event: FetchHttpClientLogEvent,
  response: Response,
): void {
  logger?.response?.(
    redact(logger, {
      ...event,
      status: response.status,
      durationMs: Date.now() - event.startedAt,
    }),
  );
}

/** Emits error events for both failed HTTP responses and thrown fetch errors. */
function logError(
  logger: FetchHttpClientLogger | undefined,
  event: FetchHttpClientLogEvent,
  error: unknown,
): void {
  logger?.error?.(
    redact(logger, {
      ...event,
      error,
      status: error instanceof ApiError ? error.status : undefined,
      durationMs: Date.now() - event.startedAt,
    }),
  );
}

/** Applies caller redaction without mutating the original log event object. */
function redact<Event extends FetchHttpClientLogEvent>(
  logger: FetchHttpClientLogger | undefined,
  event: Event,
): Event {
  return logger?.redact ? logger.redact(event) : event;
}
