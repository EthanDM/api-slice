# React Query Adapter

`createResourceQueryOptions()` creates TanStack Query option builders for a resource client.
`createResourceHooks()` creates hooks from those same option builders.

This is an optional adapter. Slice core does not require React or TanStack Query.

```ts
const projectClient = projects.client(http);
const projectQueries = createResourceQueryOptions(projects, projectClient);
const projectHooks = createResourceHooks(projects, projectClient);
```

Use `createSliceQueryOptions()` and `createSliceHooks()` when multiple resources already share clients from `createSliceClient()`:

```ts
const api = createSliceClient({
  http,
  resources: {
    projects,
    users,
  },
});

const queries = createSliceQueryOptions({
  resources: {
    projects,
    users,
  },
  clients: api,
});

const hooks = createSliceHooks({
  resources: {
    projects,
    users,
  },
  clients: api,
});

useQuery(queries.projects.list(filters));
hooks.projects.useList(filters);
hooks.users.useDetail("user_1");
```

## Query Options

Use query options when a codebase prefers colocated `queryOptions.ts` modules, route loaders, prefetching, or direct `useQuery()` composition:

```ts
useQuery(projectQueries.list(filters));
useQuery(projectQueries.detail(id));

await queryClient.prefetchQuery(projectQueries.detail(id));
await queryClient.ensureQueryData(projectQueries.list(filters));
```

Slice owns only the query key and query function. Callers can still pass normal TanStack Query options:

```ts
useQuery(
  projectQueries.list(filters, {
    staleTime: 30_000,
    select: (projects) => projects.filter((project) => project.active),
  }),
);
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
