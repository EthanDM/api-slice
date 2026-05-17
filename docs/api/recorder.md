# Recorder API

The recorder stores in-memory request history for debug panels, support dumps, tests, and agent inspection.

```ts
const recorder = createSliceRecorder({ maxEvents: 300 });
```

## Events

Recorder events are ordered and grouped by request id:

```ts
{
  type: "response",
  timestamp: 1700000000000,
  request: {
    id: "slice_...",
    method: "GET",
    path: "/projects/project_1",
    meta: { resource: "projects", operation: "detail" }
  },
  status: 200,
  durationMs: 42
}
```

## Methods

```ts
recorder.record(event);
recorder.getEvents();
recorder.clear();
const unsubscribe = recorder.subscribe((event) => {});
```

## Snapshot

```ts
getSliceSnapshot({
  resources: [projects],
  recorder,
});
```

The snapshot groups:

- known resources
- all events
- pending requests
- errors

The recorder is memory-only and does not persist anything.
