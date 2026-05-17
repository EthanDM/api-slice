# Release Guide

This guide is for publishing `@ethandm/slice`.

## Preflight

1. Confirm the package name, version, license, and repository in `package.json`.
2. Update `CHANGELOG.md`.
3. Run:

```sh
npm run check
```

4. Inspect the tarball contents:

```sh
npm pack --dry-run
```

The tarball should include `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, and `package.json`.

## Publish

For a public scoped package:

```sh
npm publish --access public
```

## Post-Publish Smoke Test

In a temporary app:

```sh
npm install @ethandm/slice zod
```

Then verify imports:

```ts
import { resource, store } from "@ethandm/slice";
import { createFetchHttpClient } from "@ethandm/slice/fetch";
import { createHonoResourceRoutes } from "@ethandm/slice/hono";
import { createResourceHooks } from "@ethandm/slice/react-query";
```

## Versioning

- Patch: bug fixes and docs that do not alter behavior.
- Minor: new adapters, helpers, or optional APIs.
- Major: breaking API or type contract changes.
