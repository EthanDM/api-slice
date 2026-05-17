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

Optional adapter peers:

- `hono`: `^4.0.0`
- `@tanstack/react-query`: `^5.0.0`
- `react`: `>=18.0.0 <20.0.0`

Core resource clients do not require Hono, React, or TanStack Query. Those packages are only needed when importing their adapter subpaths.

## Package Entrypoints

The root entrypoint is dependency-light and does not import Hono or TanStack Query at runtime.

```ts
import { resource, store } from "@ethandm/api-slice";
import { resource } from "@ethandm/api-slice/core";
import { createFetchHttpClient } from "@ethandm/api-slice/fetch";
import { createHonoResourceRoutes } from "@ethandm/api-slice/hono";
import { createResourceHooks } from "@ethandm/api-slice/react-query";
import { createSliceRecorder } from "@ethandm/api-slice/recorder";
import { store } from "@ethandm/api-slice/store";
```
