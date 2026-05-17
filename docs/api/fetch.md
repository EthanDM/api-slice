# Fetch Adapter

`createFetchHttpClient()` creates a dependency-free JSON transport for Slice resource clients.

```ts
const http = createFetchHttpClient({
  baseUrl: "https://api.example.com",
  headers: () => ({ authorization: `Bearer ${getToken()}` }),
});
```

## Responsibilities

The fetch adapter owns:

- URL/query serialization
- JSON request bodies
- JSON/text/empty response parsing
- non-2xx normalization to `ApiError`
- optional auth callbacks
- optional logging
- optional request recording

It does not own:

- token storage
- navigation
- retries
- refresh-token policy
- app-specific redaction policy

## Auth Callbacks

```ts
createFetchHttpClient({
  auth: {
    onUnauthorized: () => {
      clearToken();
      redirectToLogin();
    },
    onForbidden: () => {
      showForbiddenScreen();
    },
  },
});
```

## Logging

```ts
createFetchHttpClient({
  logger: {
    request: (event) => console.log(event.method, event.path),
    response: (event) => console.log(event.status, event.durationMs),
    error: (event) => captureException(event.error),
    redact: (event) => ({
      ...event,
      headers: { authorization: "[redacted]" },
    }),
  },
});
```

## Recorder

```ts
const recorder = createSliceRecorder();

const http = createFetchHttpClient({
  recorder,
  recorderRedact: (event) => ({
    ...event,
    request: { ...event.request, body: "[redacted]" },
  }),
});
```

Successful response bodies are not retained unless `recordResponseBody: true` is set.
