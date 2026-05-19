# Release Guide

This guide is for publishing `@ethandm/api-slice`.

## Preflight

1. Confirm the package name, version, license, and repository in `package.json`.
2. Confirm the GitHub repository exists at `https://github.com/EthanDM/api-slice`.
3. Confirm `git remote -v` points `origin` at that repository.
4. Update `CHANGELOG.md`.
5. Run:

```sh
npm run check
```

6. Inspect the tarball contents:

```sh
npm pack --dry-run
```

The tarball should include `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`, `docs`, `examples`, and `skills`.

`npm run check` also runs `npm run smoke:pack`, which installs the packed tarball into a temporary consumer project and verifies every public entrypoint imports.

`npm pack` and `npm publish` run `prepack`, so `dist` is rebuilt before the tarball is created.

## Publish

For a public scoped package:

```sh
npm publish --access public
```

`npm publish` runs `prepublishOnly`, which runs the full check suite before publishing.

## Post-Publish Smoke Test

In a temporary app:

```sh
npm install @ethandm/api-slice zod
```

Then verify imports:

```ts
import { createSliceClient, createSliceManifest, resource, store } from "@ethandm/api-slice";
import { createFetchHttpClient } from "@ethandm/api-slice/fetch";
import { createHonoResourceRoutes } from "@ethandm/api-slice/hono";
import {
  createResourceHooks,
  createResourceQueryOptions,
  createSliceHooks,
  createSliceQueryOptions,
} from "@ethandm/api-slice/react-query";
```

## Versioning

- Patch: bug fixes and docs that do not alter behavior.
- Minor: new adapters, helpers, or optional APIs.
- Major: breaking API or type contract changes.
