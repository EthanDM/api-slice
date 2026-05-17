# Slice

`@ethandm/api-slice` is a small typed API resource layer for TypeScript apps. The v0 goal is narrow: define an API resource once and get stable query keys, validated client calls, optional adapters, and normalized API errors.

It is not trying to replace `ky`, Hono, TanStack Query, or an ORM. Slice is the boring contract layer above those tools, and each integration is opt-in.

## Status

`@ethandm/api-slice` is pre-1.0. The public API is intended to be usable, but breaking changes may happen before `1.0.0`.

## Choose Your Path

- Client-only or React Native: start with `resource()` and `createFetchHttpClient()`.
- Hono backend: add `createHonoResourceRoutes()`.
- Service-layer/backend workflow: add `store()`, `query()`, `mutation()`, and `command()`.
- TanStack Query app: optionally add `createResourceHooks()` from the React Query adapter.
- Inconsistent backend API: use `operations`.

## Docs

- [Adoption guide](./docs/adoption-guide.md)
- [Compatibility](./docs/compatibility.md)
- [Resource API](./docs/api/resource.md)
- [Store API](./docs/api/store.md)
- [Fetch adapter](./docs/api/fetch.md)
- [Hono adapter](./docs/api/hono.md)
- [React Query adapter](./docs/api/react-query.md)
- [Recorder API](./docs/api/recorder.md)
- [Release guide](./docs/release.md)

## Install

```sh
npm install @ethandm/api-slice zod
```

Install adapter peer dependencies only when you use those adapters:

```sh
npm install @tanstack/react-query
npm install hono
```

## Resource Definition

```ts
import { resource } from "@ethandm/api-slice";
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
import { createFetchHttpClient } from "@ethandm/api-slice/fetch";

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

Resources can describe themselves for debug panels, docs, and coding agents:

```ts
import { describeResource } from "@ethandm/api-slice";

describeResource(projects);
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
} from "@ethandm/api-slice";

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

## Optional TanStack Query Adapter

The core client works without React, React Query, or any cache library. Use this adapter only in apps that already use TanStack Query or intentionally want it for server-state caching.

```ts
import { createResourceHooks } from "@ethandm/api-slice/react-query";

export const projectClient = projects.client(http);
export const projectHooks = createResourceHooks(projects, projectClient);
```

The adapter wraps an existing resource client:

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

### Optional State Utilities

The React Query adapter also exports small state helpers for resource-scoped cache operations and debug views. These helpers are not part of Slice core:

```ts
import {
  clearResourceQueries,
  clearSliceQueries,
  getSliceQuerySnapshot,
  invalidateResource,
} from "@ethandm/api-slice/react-query";

await invalidateResource(queryClient, projects);
clearResourceQueries(queryClient, projects);
clearSliceQueries(queryClient, [projects, users]);

const queryState = getSliceQuerySnapshot(queryClient, [projects]);
```

`getSliceQuerySnapshot()` intentionally omits cached data by default because API payloads often include PII.

## Backend Store Actions

Use stores when you want a centralized catalog of backend operations without forcing those operations into CRUD or Drizzle-specific shapes.

```ts
import { command, mutation, query, store } from "@ethandm/api-slice/store";
import { z } from "zod";

type AppContext = {
  db: D1Database;
  user: { id: string; name: string };
  env: Env;
};

const ReviewQueueInputSchema = z.object({
  scope: z.enum(["mine", "team"]).default("team"),
  includeClosed: z.boolean().optional(),
  limit: z.number().optional(),
});

const ReviewQueueItemSchema = z.object({
  id: z.string(),
  recordId: z.string(),
  title: z.string(),
});

export const reviewStore = store({
  name: "review",
  actions: {
    queue: query({
      input: ReviewQueueInputSchema,
      output: z.array(ReviewQueueItemSchema),
      run: async ({ ctx, input }: { ctx: AppContext; input: z.output<typeof ReviewQueueInputSchema> }) => {
        return getReviewQueue(ctx.db, {
          assignedUserId: input.scope === "mine" ? ctx.user.id : null,
          includeClosed: input.includeClosed,
          limit: input.limit,
        });
      },
    }),

    updateStatus: mutation({
      input: UpdateReviewStatusSchema,
      output: ReviewQueueItemSchema,
      run: async ({ ctx, input }: { ctx: AppContext; input: z.output<typeof UpdateReviewStatusSchema> }) => {
        return updateReviewStatus(ctx.db, input.recordId, input.status);
      },
    }),

    sendReminder: command({
      input: SendReminderSchema,
      output: SendReminderResultSchema,
      run: async ({ ctx, input }: { ctx: AppContext; input: z.output<typeof SendReminderSchema> }) => {
        return sendReminder(ctx.env, input.taskId, ctx.user.name);
      },
    }),
  },
});
```

Routes and services can use direct action calls:

```ts
const data = await reviewStore.actions.queue.run({
  ctx: { db: c.env.DB, user: getUser(c), env: c.env },
  input: { scope: "mine" },
});
```

Tooling can use the generic runner and metadata catalog:

```ts
await reviewStore.run("queue", {
  ctx,
  input: { scope: "team", limit: 25 },
});

reviewStore.listActions();
// [
//   { name: "queue", kind: "query", hasInput: true, hasOutput: true },
//   { name: "updateStatus", kind: "mutation", hasInput: true, hasOutput: true },
//   { name: "sendReminder", kind: "command", hasInput: true, hasOutput: true }
// ]
```

Stores also expose a serializable description:

```ts
import { describeStore } from "@ethandm/api-slice";

describeStore(reviewStore);
```

The store module is not a database adapter. It is a typed action catalog for service-layer operations that may read a DB, write a DB, call AI providers, send emails, or trigger payment workflows.

## Agent Support

This repo includes agent-focused guidance and examples:

- [AGENTS.md](./AGENTS.md): hard architectural boundaries and preferred shapes.
- [docs/adoption-guide.md](./docs/adoption-guide.md): incremental adoption workflow for existing repos.
- [docs/conventions.md](./docs/conventions.md): resource/store/route/client conventions.
- [docs/agent-recipes.md](./docs/agent-recipes.md): copyable implementation recipes.
- [examples/workflow-store](./examples/workflow-store): resource + store + Hono route binding.
- [examples/inconsistent-backend](./examples/inconsistent-backend): adapting a legacy API.
- [examples/react-native-client](./examples/react-native-client): client-only usage with recorder/auth hooks.
- [skills/ethandm-api-slice/SKILL.md](./skills/ethandm-api-slice/SKILL.md): repo-versioned Codex skill for agents consuming Slice in other repos.

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
import { createHonoResourceRoutes } from "@ethandm/api-slice/hono";

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
import { ApiError, normalizeApiError } from "@ethandm/api-slice";

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
- resource and store introspection helpers
- validated CRUD client requests
- per-operation method/path/query/body/response mapping
- custom resource actions
- built-in JSON `fetch` HTTP client
- optional structured fetch logging
- optional request recorder and debug snapshots
- fetch auth callbacks for app-owned unauthorized/forbidden handling
- backend store action catalogs with query/mutation/command intent
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
