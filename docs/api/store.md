# Store API

Stores define backend action catalogs.

```ts
const projectStore = store({
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

## Responsibilities

Stores own:

- named backend/service actions
- input validation before the action runs
- output validation after the action resolves
- action metadata for visibility
- dependency injection through `ctx`

Stores do not own:

- HTTP request/response handling
- auth middleware
- routing
- migrations
- ORM configuration

## Action Kinds

Use the narrowest honest kind:

- `query()` reads state.
- `mutation()` writes app-owned state.
- `command()` may trigger external side effects, AI calls, emails, payments, syncs, or workflow steps.

## Running Actions

Direct:

```ts
await projectStore.actions.list.run({
  ctx: { db, user, env },
  input: { search: "alpha" },
});
```

Generic:

```ts
await projectStore.run("list", {
  ctx: { db, user, env },
  input: { search: "alpha" },
});
```

## Metadata

```ts
projectStore.listActions();
projectStore.getAction("list");
describeStore(projectStore);
projectStore.describe();
```

Metadata intentionally excludes implementation functions.
