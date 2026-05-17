# Adoption Guide

Use this guide when introducing Slice into an existing TypeScript app.

## Rule

Adopt one vertical slice at a time. Do not rewrite the API layer broadly.

## 1. Pick One Bounded Surface

Good first candidates:

- a simple list/detail API
- an admin settings resource
- a workflow queue
- a legacy API client with repeated response mapping

Avoid starting with:

- auth
- payments
- large file upload flows
- complex cron/job execution
- deeply coupled service workflows

## 2. Define Schemas

Start with the app-facing contract:

```ts
const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
});
```

Add only the input schemas the first slice needs.

## 3. Define A Resource

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

If the backend is inconsistent, use `operations` instead of leaking transport shape into UI code.

## 4. Define A Store When Backend Logic Exists

Use stores for backend/service actions:

```ts
export const projectStore = store({
  name: "projects",
  actions: {
    list: query({
      input: ProjectListInputSchema,
      output: z.array(ProjectSchema),
      run: ({ ctx, input }) => projectService.list(ctx.db, input),
    }),
  },
});
```

Skip stores for client-only external API consumption.

See [Adapter Guide](./adapters.md) for Ky, Axios, server, state-layer, and DB integration patterns.

## 5. Bind Routes Thinly

```ts
app.route(
  "/projects",
  createHonoResourceRoutes(projects, {
    list: ({ context, input }) =>
      projectStore.actions.list.run({
        ctx: { db: context.env.DB, user: getUser(context) },
        input,
      }),
  }),
);
```

## 6. Add Client Usage

```ts
const http = createFetchHttpClient({
  baseUrl: API_URL,
  headers: () => ({ authorization: `Bearer ${getToken()}` }),
});

export const projectClient = projects.client(http);
```

Use React Query hooks only where the app already uses TanStack Query.

## 7. Add Visibility

For debugging:

```ts
const recorder = createSliceRecorder();

getSliceSnapshot({ resources: [projects], recorder });
describeResource(projects);
describeStore(projectStore);
```

## 8. Verify

Run the consuming repo's:

- typecheck
- tests for touched routes/clients
- app build if the touched surface is user-facing

## Done Criteria

- Resource owns API shape only.
- Store owns backend action catalog only.
- Route handlers are thin.
- UI no longer hand-builds string paths for the migrated surface.
- Tests prove the migrated surface still works.
