import { ApiError, type ApiErrorPayload } from "./errors.js";
import type { HttpClient } from "./resource.js";

type HttpRequest = Parameters<HttpClient>[0];

export type FetchHttpClientLogEvent = {
  method: HttpRequest["method"];
  path: string;
  url: string;
  query?: unknown;
  body?: unknown;
  startedAt: number;
  headers?: Record<string, string>;
};

export type FetchHttpClientRequestLogEvent = FetchHttpClientLogEvent;

export type FetchHttpClientResponseLogEvent = FetchHttpClientLogEvent & {
  status: number;
  durationMs: number;
};

export type FetchHttpClientErrorLogEvent = FetchHttpClientLogEvent & {
  error: unknown;
  durationMs: number;
  status?: number;
};

export type FetchHttpClientLogger = {
  request?: (event: FetchHttpClientRequestLogEvent) => void;
  response?: (event: FetchHttpClientResponseLogEvent) => void;
  error?: (event: FetchHttpClientErrorLogEvent) => void;
  redact?: <Event extends FetchHttpClientLogEvent>(event: Event) => Event;
};

export type FetchHttpClientConfig = {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  logger?: FetchHttpClientLogger;
};

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

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function logRequest(
  logger: FetchHttpClientLogger | undefined,
  event: FetchHttpClientLogEvent,
): void {
  logger?.request?.(redact(logger, event));
}

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

function redact<Event extends FetchHttpClientLogEvent>(
  logger: FetchHttpClientLogger | undefined,
  event: Event,
): Event {
  return logger?.redact ? logger.redact(event) : event;
}
