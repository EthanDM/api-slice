# Slice

`@cafecito/slice` is a small typed resource layer for TypeScript apps. The v0 goal is narrow: define an API resource once and get stable query keys, validated client calls, TanStack Query hooks, default mutation invalidation, and normalized API errors.

It is not trying to replace `ky`, Hono, TanStack Query, or an ORM. Slice is the boring glue layer above those tools.

## Install

```sh
npm install @cafecito/slice zod
```

Install adapters only when you use them:

```sh
npm install @tanstack/react-query
npm install hono
```

## Resource Definition

```ts
import { resource } from "@cafecito/slice";
import { z } from "zod";

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const projects = resource({
  name: "projects",
  path: "/projects",
  schemas: {
    entity: ProjectSchema,
    listInput: z.object({ search: z.string().optional() }),
    createInput: z.object({ name: z.string().min(1) }),
    updateInput: z.object({ name: z.string().min(1).optional() }),
  },
  actions: {
    archive: {
      method: "POST",
      path: "/:id/archive",
      input: z.object({ reason: z.string().optional() }),
      output: ProjectSchema,
    },
  },
});
```

## Query Keys

```ts
projects.keys.all;
projects.keys.list({ search: "alpha" });
projects.keys.detail("project_1");
```

## Client

Use the built-in `fetch` adapter for a normal JSON API:

```ts
import { createFetchHttpClient } from "@cafecito/slice/fetch";

const http = createFetchHttpClient({
  baseUrl: "https://api.example.com",
  headers: () => ({
    authorization: `Bearer ${token}`,
  }),
  auth: {
    onUnauthorized: () => {
      clearToken();
      navigation.reset({ routes: [{ name: "Login" }] });
    },
  },
});

const client = projects.client(http);

await client.list({ search: "alpha" });
await client.detail("project_1");
await client.create({ name: "Alpha" });
await client.update("project_1", { name: "Beta" });
await client.delete("project_1");
```

Slice also accepts any custom HTTP client with the same request shape, so `ky`, Hono RPC, and test fakes still work.

Custom actions use the same client:

```ts
await client.action("archive", {
  id: "project_1",
  input: { reason: "Done" },
});
```

### Fetch Logging

The fetch adapter can emit structured request, response, and error events. Slice does not ship a logging backend; wire these callbacks to `console`, Sentry, Datadog, or your own logger.

```ts
const http = createFetchHttpClient({
  baseUrl: "https://api.example.com",
  logger: {
    request: ({ method, path }) => {
      console.log("[api]", method, path);
    },
    response: ({ method, path, status, durationMs }) => {
      console.log("[api]", method, path, status, durationMs);
    },
    error: ({ method, path, status, error, durationMs }) => {
      captureException(error, {
        tags: {
          apiMethod: method,
          apiPath: path,
          apiStatus: status,
        },
        extra: { durationMs },
      });
    },
    redact: (event) => ({
      ...event,
      body: "[redacted]",
      headers: { authorization: "[redacted]" },
    }),
  },
});
```

### Request Recorder

Use the recorder when you want an in-app API history for debugging, support dumps, React Native screens, or tests. It is memory-only by design.

```ts
import {
  createFetchHttpClient,
  createSliceRecorder,
  getSliceSnapshot,
} from "@cafecito/slice";

const recorder = createSliceRecorder({ maxEvents: 300 });

const http = createFetchHttpClient({
  baseUrl: "https://api.example.com",
  recorder,
  recorderRedact: (event) => ({
    ...event,
    request: {
      ...event.request,
      body: "[redacted]",
    },
  }),
});

const unsubscribe = recorder.subscribe((event) => {
  console.log(event.type, event.request.meta, event.status);
});

const snapshot = getSliceSnapshot({
  resources: [projects],
  recorder,
});
```

Recorder events include request, response, and error history with resource metadata when calls come from a Slice resource client:

```ts
{
  type: "response",
  request: {
    method: "GET",
    path: "/projects/project_1",
    meta: { resource: "projects", operation: "detail" }
  },
  status: 200,
  durationMs: 42
}
```

Successful response bodies are not retained unless `recordResponseBody: true` is set.

## Inconsistent Backend APIs

Use `operations` when the backend shape does not match clean REST conventions. This keeps the app-facing schema clean while mapping messy transport details at the edge.

```ts
const RawContactListResponseSchema = z.object({
  payload: z.object({
    items: z.array(
      z.object({
        person_id: z.string(),
        first_name: z.string(),
      }),
    ),
  }),
});

const contacts = resource({
  name: "contacts",
  path: "/people",
  schemas: {
    entity: z.object({
      id: z.string(),
      firstName: z.string(),
    }),
    listInput: z.object({
      search: z.string().optional(),
      page: z.number().optional(),
    }),
    createInput: z.object({
      firstName: z.string(),
    }),
    updateInput: z.object({
      firstName: z.string().optional(),
    }),
  },
  operations: {
    list: {
      path: "/v3/person-search",
      query: ({ input }) => ({
        q: input?.search,
        "page[number]": input?.page,
      }),
      response: RawContactListResponseSchema,
      select: (response) =>
        RawContactListResponseSchema.parse(response).payload.items.map((person) => ({
          id: person.person_id,
          firstName: person.first_name,
        })),
    },
    detail: {
      path: "/legacy/people/:personId",
      params: ({ id }) => ({ personId: id }),
    },
    create: {
      path: "/people/create-new",
      body: ({ input }) => ({
        first_name: input?.firstName,
      }),
    },
    update: {
      method: "PUT",
      path: "/v2/person-update/:person_uuid",
      params: ({ id }) => ({ person_uuid: id }),
      body: ({ input }) => ({
        first_name: input?.firstName,
      }),
    },
    delete: {
      method: "POST",
      path: "/people/remove",
      query: ({ id }) => ({ person_id: id }),
    },
  },
});
```

Operation overrides can customize method, path, path params, query params, request body, raw response schema, and response selection.

## TanStack Query Hooks

```ts
import { createResourceHooks } from "@cafecito/slice/react-query";

export const projectClient = projects.client(http);
export const projectHooks = createResourceHooks(projects, projectClient);
```

Use the generated hooks in components:

```ts
const projectsQuery = projectHooks.useList({ search: "alpha" });
const projectQuery = projectHooks.useDetail("project_1");

const createProject = projectHooks.useCreate({
  onSuccess: () => {
    toast.success("Project created");
  },
});

createProject.mutate({ name: "Alpha" });
```

Update and delete mutations use explicit variable objects:

```ts
projectHooks.useUpdate().mutate({
  id: "project_1",
  input: { name: "Beta" },
});

projectHooks.useDelete().mutate({
  id: "project_1",
});
```

Custom actions use `useAction()`:

```ts
const archiveProject = projectHooks.useAction("archive");

archiveProject.mutate({
  id: "project_1",
  input: { reason: "Done" },
});
```

Mutation hooks invalidate the resource defaults automatically. You can override or disable that per mutation:

```ts
projectHooks.useCreate({
  invalidates: false,
});

projectHooks.useUpdate({
  invalidates: (project, variables) => [
    projects.keys.detail(variables.id),
    ["dashboard"],
  ],
});
```

### React Query State Utilities

The React Query adapter also exports small state helpers for resource-scoped cache operations and debug views:

```ts
import {
  clearResourceQueries,
  clearSliceQueries,
  getSliceQuerySnapshot,
  invalidateResource,
} from "@cafecito/slice/react-query";

await invalidateResource(queryClient, projects);
clearResourceQueries(queryClient, projects);
clearSliceQueries(queryClient, [projects, users]);

const queryState = getSliceQuerySnapshot(queryClient, [projects]);
```

`getSliceQuerySnapshot()` intentionally omits cached data by default because API payloads often include PII.

## Invalidation Defaults

```ts
projects.invalidates.create();
projects.invalidates.update("project_1");
projects.invalidates.delete("project_1");
projects.invalidates.action("archive");
```

These return query keys that the TanStack Query adapter invalidates. The defaults are intentionally conservative:

- `create` invalidates the resource root and list key.
- `update` invalidates detail, list, and root keys.
- `delete` invalidates detail, list, and root keys.

## Hono Routes

```ts
import { createHonoResourceRoutes } from "@cafecito/slice/hono";

const projectRoutes = createHonoResourceRoutes(projects, {
  list: async ({ input }) => {
    return projectService.list(input);
  },
  detail: async ({ id }) => {
    return projectService.get(id);
  },
  create: async ({ input }) => {
    return projectService.create(input);
  },
  update: async ({ id, input }) => {
    return projectService.update(id, input);
  },
  delete: async ({ id }) => {
    await projectService.delete(id);
  },
  actions: {
    archive: async ({ request }) => {
      return projectService.archive(request.id, request.input);
    },
  },
});

app.route("/projects", projectRoutes);
```

The route adapter validates request input with the resource schemas and validates handler output with the entity schema before responding.

By default, route errors are serialized as the same API error payload the fetch client understands. Pass `handleErrors: false` if the parent Hono app owns error handling.

## API Errors

```ts
import { ApiError, normalizeApiError } from "@cafecito/slice";

throw new ApiError({
  code: "VALIDATION_ERROR",
  details: { name: ["Required"] },
});

const error = normalizeApiError(unknownError);
```

## Current Scope

Built now:

- `resource()`
- stable query keys
- validated CRUD client requests
- per-operation method/path/query/body/response mapping
- custom resource actions
- built-in JSON `fetch` HTTP client
- optional structured fetch logging
- optional request recorder and debug snapshots
- fetch auth callbacks for app-owned unauthorized/forbidden handling
- TanStack Query hook adapter
- TanStack Query cache utilities and data-free state snapshots
- Hono route adapter
- shared API error payloads
- default invalidation metadata
- `ApiError` and error normalization helpers

Not built yet:

- OpenAPI generation
- MSW/mock helpers
- code generation
