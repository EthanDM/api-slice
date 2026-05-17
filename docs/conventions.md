# Slice Conventions

Slice has two core concepts:

- `resource()` defines an API contract.
- `store()` defines a backend action catalog.

Keep those boundaries strict.

## Resource Conventions

Use resources for app-facing API contracts:

- Zod entity/input schemas
- stable query keys
- CRUD client calls
- custom API actions
- inconsistent backend route mappings
- React Query invalidation defaults

Do not put DB queries, service workflows, auth policy, or provider SDK calls in a resource.

Use `actions` for API verbs that are not CRUD:

```ts
archive
approve
duplicate
send
sync
```

Use `operations` when the backend API shape is awkward:

- renamed path params
- snake_case bodies
- non-REST methods
- envelope responses
- legacy routes

## Store Conventions

Use stores for named backend operations:

- DB reads
- DB writes
- provider calls
- AI workflows
- email/payment/document commands
- service-layer operations reused by routes/tests/jobs

Use the narrowest honest action kind:

- `query()` reads state and should not write.
- `mutation()` writes app-owned state.
- `command()` may trigger side effects or external systems.

Stores receive dependencies through `ctx`. This keeps Slice independent from D1, Drizzle, Postgres, Workers, Hono, and tests.

```ts
await fileStore.actions.detail.run({
  ctx: { db, user, env },
  input: { fileId },
});
```

## Route Conventions

Route handlers should bind HTTP to store actions. They should not grow into the business logic layer.

Good:

```ts
detail: ({ context, id }) =>
  fileStore.actions.detail.run({
    ctx: { db: context.env.DB, user: getUser(context) },
    input: { fileId: String(id) },
  })
```

Avoid:

```ts
detail: async ({ context, id }) => {
  // hundreds of lines of DB and workflow logic
}
```

## Client Conventions

Use resource clients and hooks from the resource contract.

Use the fetch recorder for debug visibility, support dumps, React Native debug screens, and agent inspection.

Do not store tokens or own navigation inside Slice. Use `auth.onUnauthorized` and `auth.onForbidden` to call app-owned logic.

## Introspection

Use these helpers when building tooling or when an agent needs to inspect the available surface:

```ts
describeResource(projects);
describeStore(fileStore);
getSliceSnapshot({ resources: [projects], recorder });
getSliceQuerySnapshot(queryClient, [projects]);
```

These helpers intentionally return metadata, not implementation functions or cached API payloads.
