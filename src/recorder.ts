import type { HttpMethod, HttpRequestMeta } from "./resource.js";

/** Event kinds retained by the in-memory Slice recorder. */
export type SliceRecorderEventType = "request" | "response" | "error";

/** Serializable request identity shared by every recorder event. */
export type SliceRecorderRequest = {
  /** Stable id that links request, response, and error events for one HTTP call. */
  id: string;
  /** HTTP verb emitted by the resource client or custom transport caller. */
  method: HttpMethod;
  /** Resource-relative path before any transport base URL is applied. */
  path: string;
  /** Final URL passed to the transport when the adapter can compute one. */
  url?: string;
  /** Original query object before transport serialization. */
  query?: unknown;
  /** Original request body before transport serialization. */
  body?: unknown;
  /** Optional resource metadata attached by `resource().client(...)`. */
  meta?: HttpRequestMeta;
};

/** One ordered history entry captured by a Slice recorder. */
export type SliceRecorderEvent = {
  /** Lifecycle point for the request. */
  type: SliceRecorderEventType;
  /** Millisecond timestamp captured when the event was recorded. */
  timestamp: number;
  /** Request identity and resource metadata for grouping/debug views. */
  request: SliceRecorderRequest;
  /** HTTP status for response/error events when available. */
  status?: number;
  /** Elapsed request time for response/error events when available. */
  durationMs?: number;
  /** Normalized response payload for successful calls when recording is enabled. */
  response?: unknown;
  /** Thrown error or transport error payload for failed calls. */
  error?: unknown;
};

/** Aggregated recorder view intended for debug panels, support dumps, and tests. */
export type SliceSnapshot = {
  /** Resource names supplied by the caller, useful when no requests have fired yet. */
  resources: string[];
  /** Events in the same order they were recorded. */
  events: SliceRecorderEvent[];
  /** Request ids that have not yet produced a response or error. */
  pending: SliceRecorderEvent[];
  /** Error events in chronological order. */
  errors: SliceRecorderEvent[];
};

/** Subscription cleanup returned by `SliceRecorder.subscribe`. */
export type SliceRecorderUnsubscribe = () => void;

/** In-memory recorder contract used by transports and optional devtools. */
export type SliceRecorder = {
  /** Appends an event and synchronously notifies subscribers. */
  record: (event: SliceRecorderEvent) => void;
  /** Returns a copy so debug consumers cannot mutate recorder internals. */
  getEvents: () => SliceRecorderEvent[];
  /** Removes all retained history and notifies subscribers with the clear event absent. */
  clear: () => void;
  /** Observes future events; subscribers are not replayed existing history. */
  subscribe: (listener: (event: SliceRecorderEvent) => void) => SliceRecorderUnsubscribe;
};

/** Configuration for the default in-memory recorder. */
export type SliceRecorderConfig = {
  /** Maximum retained events; older entries are discarded first. Defaults to 200. */
  maxEvents?: number;
};

/**
 * Creates a small dependency-free recorder for request history. It intentionally
 * stores plain events rather than owning UI, persistence, or global state so web
 * apps, React Native apps, and tests can present the same history differently.
 */
export function createSliceRecorder(config: SliceRecorderConfig = {}): SliceRecorder {
  const maxEvents = config.maxEvents ?? 200;
  const events: SliceRecorderEvent[] = [];
  const listeners = new Set<(event: SliceRecorderEvent) => void>();

  return {
    record: (event) => {
      events.push(event);

      if (events.length > maxEvents) {
        events.splice(0, events.length - maxEvents);
      }

      for (const listener of listeners) {
        listener(event);
      }
    },
    getEvents: () => [...events],
    clear: () => {
      events.length = 0;
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Builds a framework-agnostic debug snapshot from known resources and recorder
 * history. Pending requests are derived by id, so callers can render a current
 * state tree without coupling Slice core to React Query or another cache.
 */
export function getSliceSnapshot(args: {
  resources?: readonly { name: string }[];
  recorder?: Pick<SliceRecorder, "getEvents">;
}): SliceSnapshot {
  const events = args.recorder?.getEvents() ?? [];
  const completedRequestIds = new Set(
    events
      .filter((event) => event.type === "response" || event.type === "error")
      .map((event) => event.request.id),
  );

  return {
    resources: args.resources?.map((resource) => resource.name) ?? [],
    events,
    pending: events.filter(
      (event) =>
        event.type === "request" && !completedRequestIds.has(event.request.id),
    ),
    errors: events.filter((event) => event.type === "error"),
  };
}
