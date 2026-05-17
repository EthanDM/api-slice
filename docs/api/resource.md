# Resource API

Resources define the app-facing API contract.

```ts
const projects = resource({
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

## Responsibilities

Resources own:

- entity and input schemas
- query keys
- CRUD client methods
- custom API actions
- inconsistent backend mappings through `operations`
- default mutation invalidation metadata

Resources do not own:

- DB queries
- service workflows
- auth policy
- route middleware
- provider SDK calls

## Client

```ts
const client = projects.client(http);

await client.list(filters);
await client.detail(id);
await client.create(input);
await client.update(id, input);
await client.delete(id);
```

## Actions

Use actions for API verbs that are not CRUD:

```ts
actions: {
  archive: {
    method: "POST",
    path: "/:id/archive",
    input: ArchiveProjectSchema,
    output: ProjectSchema,
  },
}
```

Call:

```ts
await client.action("archive", {
  id: "project_1",
  input: { reason: "Done" },
});
```

## Operations

Use `operations` to adapt backend transport shape while preserving a clean app-facing schema.

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

Supported operation fields:

- `method`
- `path`
- `params`
- `query`
- `body`
- `response`
- `select`

## Introspection

```ts
describeResource(projects);
projects.describe();
```

Use this for docs, debug views, support dumps, and agent workflows.
