# Agent Recipes

These recipes are written for coding agents. Prefer copying the closest recipe before inventing a new shape.

## Add A New Resource

1. Define Zod schemas.
2. Create a `resource()`.
3. Add client/hooks or route bindings near the consuming app code.
4. Add a test that exercises the generated request or route.

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
});
```

## Add A Custom API Action

Use resource `actions` for domain verbs that are still API endpoints.

```ts
export const projects = resource({
  name: "projects",
  path: "/projects",
  schemas,
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

Client:

```ts
await projects.client(http).action("archive", {
  id: "project_1",
  input: { reason: "Done" },
});
```

## Consume A Bad Backend API

Use `operations`. Keep the app-facing entity clean and map bad transport details at the edge.

```ts
const contacts = resource({
  name: "contacts",
  path: "/people",
  schemas,
  operations: {
    list: {
      path: "/v3/person-search",
      query: ({ input }) => ({
        q: input?.search,
        "page[number]": input?.page,
      }),
      response: RawContactListResponseSchema,
      select: (response) =>
        RawContactListResponseSchema.parse(response).payload.items.map(toContact),
    },
    update: {
      method: "PUT",
      path: "/v2/person-update/:person_uuid",
      params: ({ id }) => ({ person_uuid: id ?? "" }),
      body: ({ input }) => ({ first_name: input?.firstName }),
    },
  },
});
```

## Add A Store Action

Use stores for backend/service actions. Do not put HTTP details here.

```ts
export const projectStore = store({
  name: "projects",
  actions: {
    detail: query({
      input: z.object({ id: z.string() }),
      output: ProjectSchema,
      run: ({ ctx, input }) => projectService.detail(ctx.db, input.id),
    }),
    create: mutation({
      input: CreateProjectSchema,
      output: ProjectSchema,
      run: ({ ctx, input }) => projectService.create(ctx.db, input),
    }),
    syncToProvider: command({
      input: z.object({ id: z.string() }),
      output: SyncResultSchema,
      run: ({ ctx, input }) => provider.sync(ctx.env, input.id),
    }),
  },
});
```

## Bind A Store To Hono Routes

Keep the route layer thin. It should parse HTTP through the resource and delegate business logic to the store.

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
    update: ({ context, id, input }) =>
      projectStore.actions.update.run({
        ctx: { db: context.env.DB, user: getUser(context) },
        input: { id: String(id), ...input },
      }),
    delete: ({ context, id }) =>
      projectStore.actions.delete.run({
        ctx: { db: context.env.DB, user: getUser(context) },
        input: { id: String(id) },
      }),
  }),
);
```

## Add React Query Hooks

Only use this recipe in React/React Native apps that already use TanStack Query.

```ts
const projectClient = projects.client(http);
export const projectHooks = createResourceHooks(projects, projectClient);
```

Generated hooks:

```ts
projectHooks.useList(filters);
projectHooks.useDetail(id);
projectHooks.useCreate();
projectHooks.useUpdate();
projectHooks.useDelete();
projectHooks.useAction("archive");
```

## Add Debug Visibility

Use the recorder for in-app history. Redact tokens and PII before retaining events.

```ts
const recorder = createSliceRecorder();

const http = createFetchHttpClient({
  recorder,
  recorderRedact: (event) => ({
    ...event,
    request: { ...event.request, body: "[redacted]" },
  }),
});

const snapshot = getSliceSnapshot({
  resources: [projects],
  recorder,
});
```

## Inspect A Surface Before Editing

Use introspection helpers:

```ts
describeResource(projects);
describeStore(projectStore);
```

If the metadata says an action has no input or no output, do not invent schemas without checking the actual domain need.
