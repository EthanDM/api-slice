# Slice Agent Guide

Act like a strong senior TypeScript engineer. Keep Slice small, explicit, and easy to copy into real apps.

## Core Boundaries

- Use `resource()` for API contracts: schemas, paths, client calls, query keys, invalidation, and custom API actions.
- Use `store()` for backend action catalogs: named service-layer operations that read/write databases or run workflows.
- Use `createHonoResourceRoutes()` only for conventional Hono CRUD/action HTTP bindings.
- Use `operations` when a backend route is inconsistent, legacy, or not REST-shaped.
- Use `createFetchHttpClient()` for JSON transport, auth callbacks, logging, and request recording.
- Use React Query helpers only in `@ethandm/slice/react-query`.

## Do Not Add To Core

- Do not add an ORM, auth framework, router framework, global state manager, job queue, migration system, or permission system to core.
- Do not make stores depend on Drizzle, D1, Postgres, Hono, or React Query.
- Do not put HTTP concerns in stores.
- Do not put DB/workflow logic in resources.
- Do not hide behavior behind code generation unless a separate explicit generator is added later.

## Preferred Shapes

For a normal feature, use this flow:

```txt
Zod schemas -> resource contract -> store actions -> Hono route binding -> client/hooks
```

Keep route handlers thin:

```ts
list: ({ context, input }) =>
  fileStore.actions.list.run({
    ctx: { db: context.env.DB, user: getUser(context) },
    input,
  })
```

Use action intent honestly:

- `query()` for reads.
- `mutation()` for app-owned writes.
- `command()` for side effects, AI calls, emails, payments, syncs, or workflow steps.

## Agent-Friendly Requirements

- Add or update examples when adding a new public pattern.
- Add tests that demonstrate the intended usage, not just implementation details.
- Keep runtime errors actionable. Say what resource/store/action failed and what the caller should add or change.
- Keep docs copyable. Agents should be able to paste an example and adapt names/schemas.
