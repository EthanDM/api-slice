# Adapter Guide

Slice keeps adapters small and explicit. The core resource client only needs an `HttpClient`, so most integrations are thin wrappers around tools an app already owns.

## HTTP Clients

Use the built-in fetch adapter for normal JSON APIs:

```ts
import { createFetchHttpClient } from "@ethandm/api-slice/fetch";

const http = createFetchHttpClient({
  baseUrl: "https://api.example.com",
  headers: () => ({ authorization: `Bearer ${getToken()}` }),
});
```

Bind the shared adapter once when an app has multiple resources:

```ts
import { createSliceClient } from "@ethandm/api-slice";

const api = createSliceClient({
  http,
  resources: {
    projects,
    users,
  },
});
```

Use an existing `ky` instance by adapting it to Slice's `HttpClient` shape:

```ts
import ky from "ky";
import type { HttpClient } from "@ethandm/api-slice";

const api = ky.create({
  prefixUrl: "https://api.example.com",
});

const http: HttpClient = {
  request: ({ method, path, query, body }) =>
    api(path.replace(/^\//, ""), {
      method,
      searchParams: query as Record<string, string>,
      json: body,
    }).json(),
};
```

Use an existing Axios instance the same way:

```ts
import axios from "axios";
import type { HttpClient } from "@ethandm/api-slice";

const api = axios.create({
  baseURL: "https://api.example.com",
});

const http: HttpClient = {
  request: async ({ method, path, query, body }) => {
    const response = await api.request({
      method,
      url: path,
      params: query,
      data: body,
    });

    return response.data;
  },
};
```

Use a fake client in tests:

```ts
import type { HttpClient } from "@ethandm/api-slice";

const http: HttpClient = {
  request: async ({ path }) => {
    if (path === "/projects") {
      return [{ id: "project_1", name: "Alpha" }];
    }

    throw new Error(`Unhandled test request: ${path}`);
  },
};
```

## Server Adapters

Hono is the only built-in server adapter:

```ts
import { createHonoResourceRoutes } from "@ethandm/api-slice/hono";
```

Use Hono when your routes follow Slice's conventional CRUD/action shape. Keep auth, service logic, and DB access outside the adapter.

For Express, Fastify, or another server, start with the same contract:

- parse query/body/path params
- call the matching resource/store handler
- validate output with the resource schema
- serialize errors with `toApiErrorPayload()`

Do not add a new server adapter until a real app needs it.

## State Layers

The default client is plain TypeScript:

```ts
const client = projects.client(http);
const projectsList = await client.list({ search: "alpha" });
```

Use TanStack Query only when the app already wants TanStack Query for server-state caching:

```ts
import { createResourceHooks, createSliceHooks } from "@ethandm/api-slice/react-query";

const hooks = createResourceHooks(projects, projects.client(http));

const sliceHooks = createSliceHooks({
  resources: {
    projects,
    users,
  },
  clients: api,
});
```

For Zustand, Jotai, Redux, or local component state, call the plain client from your existing action/effect layer. Slice should not generate framework-specific state stores in v0.

## Backend Services And DBs

Slice does not own the database layer. Use `store()` to catalog backend actions and inject whatever DB client the app already uses.

Drizzle example:

```ts
const projectStore = store({
  name: "projects",
  actions: {
    list: query({
      input: ProjectListInputSchema,
      output: z.array(ProjectSchema),
      run: ({ ctx, input }) =>
        ctx.db.query.projects.findMany({
          where: input.search
            ? like(projectsTable.name, `%${input.search}%`)
            : undefined,
        }),
    }),
  },
});
```

Prisma example:

```ts
const projectStore = store({
  name: "projects",
  actions: {
    list: query({
      input: ProjectListInputSchema,
      output: z.array(ProjectSchema),
      run: ({ ctx, input }) =>
        ctx.prisma.project.findMany({
          where: input.search
            ? { name: { contains: input.search, mode: "insensitive" } }
            : undefined,
        }),
    }),
  },
});
```

The store should describe and validate backend actions. The ORM should still own SQL/query construction, transactions, and migrations.
