# Compatibility

## Runtime

Slice is ESM-only and targets modern TypeScript runtimes.

Supported environments:

- modern browsers
- Node.js versions with `fetch`
- Cloudflare Workers
- React Native environments with a compatible `fetch`

If a runtime does not expose `fetch`, pass one to `createFetchHttpClient({ fetch })`.

## TypeScript

The library is developed against TypeScript 5.8.

## Peer Dependencies

Required:

- `zod`: `^3.25.0`

Optional:

- `hono`: `^4.0.0`
- `@tanstack/react-query`: `^5.0.0`
- `react`: `>=18.0.0 <20.0.0`

## Package Entrypoints

```ts
import { resource, store } from "@ethandm/slice";
import { resource } from "@ethandm/slice/core";
import { createFetchHttpClient } from "@ethandm/slice/fetch";
import { createHonoResourceRoutes } from "@ethandm/slice/hono";
import { createResourceHooks } from "@ethandm/slice/react-query";
import { createSliceRecorder } from "@ethandm/slice/recorder";
import { store } from "@ethandm/slice/store";
```
