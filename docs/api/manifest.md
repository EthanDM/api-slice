# Manifest API

`createSliceManifest()` creates a read-only catalog of resources and stores.

```ts
const manifest = createSliceManifest({
  resources: {
    projects,
    users,
  },
  stores: {
    projectStore,
  },
});
```

## Responsibilities

The manifest owns:

- resource descriptions
- store action descriptions
- serializable metadata for docs, debug panels, support dumps, and agent inspection

It does not own:

- HTTP clients
- React Query hooks
- Hono routes
- DB clients
- request context
- action execution

## Output

```ts
{
  resources: projects.map((resource) => resource.describe()),
  stores: stores.map((store) => store.describe()),
}
```

The output intentionally excludes implementation functions and schema internals.
