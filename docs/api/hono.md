# Hono Adapter

`createHonoResourceRoutes()` binds a resource contract to conventional Hono CRUD/action routes.

```ts
app.route(
  "/projects",
  createHonoResourceRoutes(projects, {
    list: ({ input }) => projectService.list(input),
    detail: ({ id }) => projectService.detail(id),
    create: ({ input }) => projectService.create(input),
    update: ({ id, input }) => projectService.update(id, input),
    delete: ({ id }) => projectService.delete(id),
  }),
);
```

## Responsibilities

The Hono adapter owns:

- request input parsing
- path id extraction
- handler output validation
- default status codes
- optional API error serialization
- custom action route binding

It does not own:

- auth middleware
- DB access
- service workflows
- non-conventional route design

## Custom Actions

```ts
createHonoResourceRoutes(projects, {
  list,
  detail,
  create,
  update,
  delete,
  actions: {
    archive: ({ request }) => projectService.archive(request.id, request.input),
  },
});
```

## Error Handling

By default, thrown errors are serialized into Slice API error payloads.

Disable that when a parent Hono app already owns error serialization:

```ts
createHonoResourceRoutes(projects, {
  handleErrors: false,
  list,
  detail,
  create,
  update,
  delete,
});
```
