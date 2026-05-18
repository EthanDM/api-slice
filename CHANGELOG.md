# Changelog

All notable changes to `@ethandm/api-slice` will be documented here.

This project uses semantic versioning once published.

## 0.1.0 - Initial Public Release

- Added `resource()` for typed API contracts, query keys, CRUD clients, custom actions, and inconsistent backend mappings.
- Added `createSliceClient()` for binding one HTTP adapter to a named set of resources.
- Added dependency-free `fetch` adapter with auth callbacks, structured logging, request recording, and redaction hooks.
- Added backend `store()` action catalogs with `query()`, `mutation()`, and `command()` intent.
- Added Hono route adapter for conventional resource CRUD/action routes.
- Added TanStack Query hook and cache helper adapter.
- Added TanStack Query query-options factories for `useQuery`, `prefetchQuery`, and module-level option reuse.
- Added `createSliceHooks()` for binding React Query hooks across a client registry.
- Added `createSliceManifest()` for read-only resource/store catalogs.
- Set Zod 4 as the default tested schema dependency while keeping Zod 3 in the peer range.
- Added API errors, request recorder, resource/store introspection, docs, examples, and Codex skill guidance.
