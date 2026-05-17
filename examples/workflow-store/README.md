# Workflow Store Example

This example shows the intended shape for workflow-heavy apps:

```txt
schemas -> resource -> store -> Hono route binding -> client
```

The store owns named backend actions. The resource owns the HTTP/API contract.

See [index.ts](./index.ts).
