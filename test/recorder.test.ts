import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  createSliceRecorder,
  getSliceSnapshot,
  resource,
} from "../src/index.js";

describe("createSliceRecorder", () => {
  it("retains events, trims old history, and notifies subscribers", () => {
    const recorder = createSliceRecorder({ maxEvents: 1 });
    const listener = vi.fn();
    const unsubscribe = recorder.subscribe(listener);

    recorder.record({
      type: "request",
      timestamp: 1,
      request: { id: "one", method: "GET", path: "/one" },
    });
    recorder.record({
      type: "response",
      timestamp: 2,
      request: { id: "one", method: "GET", path: "/one" },
      status: 200,
      durationMs: 1,
    });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(recorder.getEvents()).toHaveLength(1);
    expect(recorder.getEvents()[0]?.type).toBe("response");

    unsubscribe();
    recorder.record({
      type: "request",
      timestamp: 3,
      request: { id: "two", method: "GET", path: "/two" },
    });

    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("getSliceSnapshot", () => {
  it("groups resources, pending requests, and errors", () => {
    const projects = resource({
      name: "projects",
      path: "/projects",
      schemas: {
        entity: z.object({ id: z.string() }),
      },
    });
    const recorder = createSliceRecorder();

    recorder.record({
      type: "request",
      timestamp: 1,
      request: {
        id: "pending",
        method: "GET",
        path: "/projects",
        meta: { resource: "projects", operation: "list" },
      },
    });
    recorder.record({
      type: "request",
      timestamp: 2,
      request: { id: "failed", method: "GET", path: "/projects/missing" },
    });
    recorder.record({
      type: "error",
      timestamp: 3,
      request: { id: "failed", method: "GET", path: "/projects/missing" },
      status: 404,
      error: new Error("Missing"),
    });

    expect(getSliceSnapshot({ resources: [projects], recorder })).toMatchObject({
      resources: ["projects"],
      pending: [
        {
          request: {
            id: "pending",
            meta: { resource: "projects", operation: "list" },
          },
        },
      ],
      errors: [{ status: 404 }],
    });
  });
});
