---
name: ethandm-slice
description: Use when adding, refactoring, or reviewing @ethandm/slice resources, stores, Hono route bindings, React Query hooks, fetch clients, recorder/debug tooling, or incremental adoption in existing TypeScript apps.
---

# EthanDM Slice

Use this skill when a repo should consume `@ethandm/slice` or when reviewing whether existing Slice usage follows the intended architecture.

## Core Decision

Pick the smallest Slice primitive that matches the job:

- `resource()` for API contracts, typed clients, query keys, custom API actions, and inconsistent backend route mappings.
- `store()` for backend/service-layer action catalogs.
- `createHonoResourceRoutes()` for conventional Hono CRUD/action route bindings.
- `createResourceHooks()` only when the app already uses TanStack Query or is intentionally adopting it.
- `createFetchHttpClient()` for JSON transport, auth callbacks, request logging, and recorder integration.

Do not add DB, auth, routing, permissions, queues, or global state ownership to Slice core usage in a consuming app.

## Adoption Workflow

For existing apps, do not migrate broadly.

1. Pick one bounded API surface.
2. Identify existing Zod schemas or add narrow schemas for that surface.
3. Define a `resource()` for the app-facing API contract.
4. If backend logic is involved, define a `store()` for the service actions.
5. Bind route handlers thinly to store actions.
6. Add client usage or React Query hooks only where the screen needs them.
7. Verify with the consuming repo's typecheck/tests.

Prefer one high-signal vertical slice over a large mechanical rewrite.

## Resource Pattern

Use resources for HTTP/API shape, not business logic.

```ts
export const projects = resource({
  name: "projects",
  path: "/projects",
  schemas: {
    entity: ProjectSchema,
    listInput: ProjectListInputSchema,
    createInput: CreateProjectSchema,
    updateInput: UpdateProjectSchema,
  },
  actions: {
    archive: {
      method: "POST",
      path: "/:id/archive",
      input: ArchiveProjectSchema,
      output: ProjectSchema,
    },
  },
});
```

Use `operations` for ugly or legacy backends:

```ts
operations: {
  list: {
    path: "/v3/person-search",
    query: ({ input }) => ({ q: input?.search }),
    response: RawListResponseSchema,
    select: (response) => RawListResponseSchema.parse(response).payload.items.map(toEntity),
  },
}
```

## Store Pattern

Use stores to catalog backend actions in one domain area. Stores receive app-owned dependencies through `ctx`.

```ts
export const reviewStore = store({
  name: "review",
  actions: {
    queue: query({
      input: ReviewQueueInputSchema,
      output: z.array(ReviewQueueItemSchema),
      run: ({ ctx, input }) => getReviewQueue(ctx.db, input),
    }),
    sendReminder: command({
      input: SendReminderInputSchema,
      output: SendReminderResultSchema,
      run: ({ ctx, input }) => sendReminder(ctx.env, input.taskId),
    }),
  },
});
```

Action intent:

- `query()` reads state.
- `mutation()` writes app-owned state.
- `command()` may call external systems, AI, email, payments, sync jobs, or workflow side effects.

## Hono Binding Pattern

Keep Hono route handlers thin. Resource validates HTTP input/output; store owns backend action execution.

```ts
app.route(
  "/projects",
  createHonoResourceRoutes(projects, {
    list: ({ context, input }) =>
      projectStore.actions.list.run({
        ctx: { db: context.env.DB, user: getUser(context) },
        input,
      }),
    detail: ({ context, id }) =>
      projectStore.actions.detail.run({
        ctx: { db: context.env.DB, user: getUser(context) },
        input: { id: String(id) },
      }),
    create: ({ context, input }) =>
      projectStore.actions.create.run({
        ctx: { db: context.env.DB, user: getUser(context) },
        input,
      }),
  }),
);
```

## Client Pattern

Use the fetch adapter when the app needs standard JSON transport.

```ts
const recorder = createSliceRecorder();

const http = createFetchHttpClient({
  baseUrl: API_URL,
  headers: () => ({ authorization: `Bearer ${getToken()}` }),
  auth: {
    onUnauthorized: () => {
      clearToken();
      redirectToLogin();
    },
  },
  recorder,
  recorderRedact: (event) => ({
    ...event,
    request: { ...event.request, body: "[redacted]" },
  }),
});

export const projectClient = projects.client(http);
```

For React Query:

```ts
export const projectHooks = createResourceHooks(projects, projectClient);
```

Do not introduce TanStack Query solely because Slice exists. Use the plain client for React Native or simpler apps when that is enough.

## Introspection And Debugging

Use metadata helpers before guessing what exists:

```ts
describeResource(projects);
describeStore(projectStore);
getSliceSnapshot({ resources: [projects], recorder });
getSliceQuerySnapshot(queryClient, [projects]);
```

Use these for debug screens, support dumps, and agent-oriented inspection.

## Review Checklist

Before finishing a Slice change in a consuming repo:

- Resources contain schemas/API shape, not DB or workflow logic.
- Stores contain backend action catalog logic, not HTTP request/response handling.
- Route handlers are thin bindings.
- Bad backend routes use `operations` instead of leaking weird transport shapes into UI code.
- Auth/session/navigation logic stays app-owned through callbacks.
- Tests cover the added resource/store or route behavior.
- Runtime errors are actionable enough for the next agent to fix from the message.
