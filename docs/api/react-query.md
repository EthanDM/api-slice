# React Query Adapter

`createResourceHooks()` creates TanStack Query hooks for a resource client.

```ts
const projectClient = projects.client(http);
const projectHooks = createResourceHooks(projects, projectClient);
```

## Hooks

```ts
projectHooks.useList(filters);
projectHooks.useDetail(id);
projectHooks.useCreate();
projectHooks.useUpdate();
projectHooks.useDelete();
projectHooks.useAction("archive");
```

## Mutation Variables

Update and delete mutations use object variables so mutation callbacks have stable metadata:

```ts
projectHooks.useUpdate().mutate({
  id: "project_1",
  input: { name: "Beta" },
});

projectHooks.useDelete().mutate({
  id: "project_1",
});
```

## Invalidation

Mutation hooks use the resource defaults unless overridden.

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

## State Helpers

```ts
await invalidateResource(queryClient, projects);
clearResourceQueries(queryClient, projects);
clearSliceQueries(queryClient, [projects, users]);
getSliceQuerySnapshot(queryClient, [projects]);
```

`getSliceQuerySnapshot()` omits cached data by default.
