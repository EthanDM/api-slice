import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  createFetchHttpClient,
  createSliceRecorder,
} from "../src/index.js";

describe("createFetchHttpClient", () => {
  it("serializes query params and reads JSON responses", async () => {
    const fetch = vi.fn(async () =>
      Response.json([{ id: "project_1", name: "Alpha" }]),
    );
    const http = createFetchHttpClient({
      baseUrl: "https://api.example.com",
      fetch,
    });

    await expect(
      http({
        method: "GET",
        path: "/projects",
        query: { search: "alpha", tags: ["one", "two"], empty: undefined },
      }),
    ).resolves.toEqual([{ id: "project_1", name: "Alpha" }]);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/projects?search=alpha&tags=one&tags=two",
      expect.objectContaining({
        method: "GET",
        body: undefined,
      }),
    );
  });

  it("sends JSON bodies and supports dynamic headers", async () => {
    const fetch = vi.fn(async () => Response.json({ id: "project_1" }));
    const http = createFetchHttpClient({
      fetch,
      headers: async () => ({ authorization: "Bearer token" }),
    });

    await http({
      method: "POST",
      path: "/projects",
      body: { name: "Alpha" },
    });

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init?.headers as Headers;

    expect(fetch).toHaveBeenCalledWith(
      "/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Alpha" }),
      }),
    );
    expect(headers.get("authorization")).toBe("Bearer token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("returns undefined for 204 responses", async () => {
    const http = createFetchHttpClient({
      fetch: async () => new Response(null, { status: 204 }),
    });

    await expect(http({ method: "DELETE", path: "/projects/1" })).resolves.toBe(
      undefined,
    );
  });

  it("throws ApiError for structured error responses", async () => {
    const http = createFetchHttpClient({
      fetch: async () =>
        Response.json(
          {
            code: "VALIDATION_ERROR",
            message: "Invalid project",
            status: 422,
            details: { name: ["Required"] },
          },
          { status: 422 },
        ),
    });

    await expect(http({ method: "POST", path: "/projects" })).rejects.toEqual(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "Invalid project",
        status: 422,
        details: { name: ["Required"] },
      }),
    );
  });

  it("emits request and response log events", async () => {
    const request = vi.fn();
    const response = vi.fn();
    const http = createFetchHttpClient({
      fetch: async () => Response.json({ id: "project_1" }, { status: 201 }),
      headers: { authorization: "Bearer token" },
      logger: {
        request,
        response,
      },
    });

    await http({
      method: "POST",
      path: "/projects",
      body: { name: "Alpha" },
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/projects",
        id: expect.any(String),
        url: "/projects",
        body: { name: "Alpha" },
        headers: expect.objectContaining({
          authorization: "Bearer token",
        }),
        startedAt: expect.any(Number),
      }),
    );
    expect(response).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/projects",
        status: 201,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("records request and response history with resource metadata", async () => {
    const recorder = createSliceRecorder();
    const http = createFetchHttpClient({
      fetch: async () => Response.json({ id: "project_1" }),
      recorder,
      recordResponseBody: true,
    });

    await http({
      method: "GET",
      path: "/projects/project_1",
      meta: { resource: "projects", operation: "detail" },
    });

    const events = recorder.getEvents();

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "request",
      request: {
        method: "GET",
        path: "/projects/project_1",
        meta: { resource: "projects", operation: "detail" },
      },
    });
    expect(events[1]).toMatchObject({
      type: "response",
      status: 200,
      response: { id: "project_1" },
      request: {
        id: events[0]?.request.id,
      },
    });
  });

  it("calls auth hooks for authorization failures", async () => {
    const onUnauthorized = vi.fn();
    const onForbidden = vi.fn();
    const http = createFetchHttpClient({
      fetch: async () => Response.json({ message: "Unauthorized" }, { status: 401 }),
      auth: {
        onUnauthorized,
        onForbidden,
      },
    });

    await expect(http({ method: "GET", path: "/me" })).rejects.toThrow(
      ApiError,
    );

    expect(onUnauthorized).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        path: "/me",
        error: expect.any(ApiError),
      }),
    );
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it("emits error log events for failed responses", async () => {
    const error = vi.fn();
    const http = createFetchHttpClient({
      fetch: async () =>
        Response.json(
          { code: "NOT_FOUND", message: "Missing", status: 404 },
          { status: 404 },
        ),
      logger: { error },
    });

    await expect(http({ method: "GET", path: "/missing" })).rejects.toThrow(
      ApiError,
    );

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/missing",
        status: 404,
        durationMs: expect.any(Number),
        error: expect.any(ApiError),
      }),
    );
  });

  it("redacts log events before emitting them", async () => {
    const request = vi.fn();
    const http = createFetchHttpClient({
      fetch: async () => Response.json({ id: "project_1" }),
      headers: { authorization: "Bearer token" },
      logger: {
        request,
        redact: (event) => ({
          ...event,
          body: "[redacted]",
          headers: { authorization: "[redacted]" },
        }),
      },
    });

    await http({
      method: "POST",
      path: "/projects",
      body: { name: "Alpha" },
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "[redacted]",
        headers: { authorization: "[redacted]" },
      }),
    );
  });
});
