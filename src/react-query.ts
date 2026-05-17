import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";

import type { Id, Resource, ResourceClient } from "./resource.js";
import type {
  AnyResource,
  ResourceActionOutput,
  ResourceActionRequest,
  RuntimeResourceActionMap,
  SliceClient,
} from "./resource.js";

type QueryKey = readonly unknown[];
type QueryKeys = readonly QueryKey[];
type ResourceQueryRoot = {
  name: string;
  keys: { all: QueryKey };
};

/** Query options callers may override without breaking Slice-owned keys/functions. */
export type ResourceQueryOptions<Data, Selected = Data> = Omit<
  UseQueryOptions<Data, Error, Selected, QueryKey>,
  "queryKey" | "queryFn"
>;

/**
 * Mutation options that preserve TanStack Query behavior while letting Slice own
 * the mutation function and default invalidation policy.
 */
export type ResourceMutationOptions<Data, Variables, Context = unknown> = Omit<
  UseMutationOptions<Data, Error, Variables, Context>,
  "mutationFn" | "onSuccess"
> & {
  invalidates?: false | QueryKeys | ((data: Data, variables: Variables) => QueryKeys);
  onSuccess?: UseMutationOptions<Data, Error, Variables, Context>["onSuccess"];
};

/** Groups id and patch payload so update invalidation can target the changed entity. */
export type UpdateVariables<UpdateInput> = {
  /** Entity id used for both the request path and default detail invalidation. */
  id: Id;
  /** Already typed update payload passed through to the resource client. */
  input: UpdateInput;
};

/** Keeps delete variables object-shaped so mutation callbacks receive stable metadata. */
export type DeleteVariables = {
  /** Entity id used for both the request path and default detail invalidation. */
  id: Id;
};

/** Minimal serializable view of one TanStack Query cache entry. */
export type SliceQuerySnapshotEntry = {
  /** Query hash assigned by TanStack Query. */
  queryHash: string;
  /** Original query key, usually produced by a Slice resource key factory. */
  queryKey: QueryKey;
  /** First query-key segment when it matches a Slice resource name. */
  resource?: string;
  /** TanStack Query status without exposing cached data by default. */
  status: string;
  /** Current fetch state, useful for seeing stale/loading cache branches. */
  fetchStatus: string;
  /** Whether this query has been invalidated and awaits refetch. */
  isInvalidated: boolean;
  /** Last successful data timestamp from TanStack Query. */
  dataUpdatedAt: number;
  /** Last error timestamp from TanStack Query. */
  errorUpdatedAt: number;
};

/** Snapshot of Slice-owned query-cache state for debug panels and tests. */
export type SliceQuerySnapshot = {
  /** Resource names included in this snapshot filter. Empty means all queries. */
  resources: string[];
  /** Matching query-cache entries with cache data intentionally omitted. */
  queries: SliceQuerySnapshotEntry[];
};

/**
 * Hook surface generated for one resource. Query keys and invalidation remain
 * resource-derived so screens do not need to recreate cache conventions.
 */
export type ResourceHooks<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap = {},
> = {
  /** Reads a list using the resource list key, including any filter input. */
  useList: <Selected = Entity[]>(
    input?: ListInput,
    options?: ResourceQueryOptions<Entity[], Selected>,
  ) => UseQueryResult<Selected, Error>;
  /** Reads one entity using the resource detail key. */
  useDetail: <Selected = Entity>(
    id: Id,
    options?: ResourceQueryOptions<Entity, Selected>,
  ) => UseQueryResult<Selected, Error>;
  /** Creates an entity and invalidates collection-level defaults unless overridden. */
  useCreate: (
    options?: ResourceMutationOptions<Entity, CreateInput>,
  ) => UseMutationResult<Entity, Error, CreateInput>;
  /** Updates an entity and invalidates detail plus collection defaults unless overridden. */
  useUpdate: (
    options?: ResourceMutationOptions<Entity, UpdateVariables<UpdateInput>>,
  ) => UseMutationResult<Entity, Error, UpdateVariables<UpdateInput>>;
  /** Deletes an entity and invalidates detail plus collection defaults unless overridden. */
  useDelete: (
    options?: ResourceMutationOptions<void, DeleteVariables>,
  ) => UseMutationResult<void, Error, DeleteVariables>;
  /** Executes a named custom action using that action's inferred request/output contract. */
  useAction: <Name extends keyof Actions & string>(
    name: Name,
    options?: ResourceMutationOptions<
      ResourceActionOutput<Actions[Name]>,
      ResourceActionRequest<Actions[Name]>
    >,
  ) => UseMutationResult<
    ResourceActionOutput<Actions[Name]>,
    Error,
    ResourceActionRequest<Actions[Name]>
  >;
};

/** Hook registry produced by binding Slice clients to matching resources. */
export type SliceHooks<Resources extends Record<string, AnyResource>> = {
  [Name in keyof Resources]: Resources[Name] extends Resource<
    infer Entity,
    infer ListInput,
    infer CreateInput,
    infer UpdateInput,
    infer Actions
  >
    ? ResourceHooks<Entity, ListInput, CreateInput, UpdateInput, Actions>
    : never;
};

/**
 * Creates React Query hooks for an already-configured resource client. The
 * adapter does not create its own QueryClient; it uses the nearest provider so
 * web and React Native apps keep normal TanStack Query ownership.
 */
export function createResourceHooks<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap = {},
>(
  resource: Resource<Entity, ListInput, CreateInput, UpdateInput, Actions>,
  client: ResourceClient<Entity, ListInput, CreateInput, UpdateInput, Actions>,
): ResourceHooks<Entity, ListInput, CreateInput, UpdateInput, Actions> {
  return {
    useList: (input, options) =>
      useQuery({
        ...options,
        queryKey: resource.keys.list(input) as QueryKey,
        queryFn: () => client.list(input),
      }),
    useDetail: (id, options) =>
      useQuery({
        ...options,
        queryKey: resource.keys.detail(id) as QueryKey,
        queryFn: () => client.detail(id),
      }),
    useCreate: (options) => {
      const queryClient = useQueryClient();

      return useMutation({
        ...options,
        mutationFn: (input) => client.create(input),
        onSuccess: async (data, variables, onMutateResult, context) => {
          await invalidateResourceQueries(
            queryClient,
            resolveInvalidation(options?.invalidates, data, variables, () =>
              resource.invalidates.create(),
            ),
          );
          await options?.onSuccess?.(data, variables, onMutateResult, context);
        },
      });
    },
    useUpdate: (options) => {
      const queryClient = useQueryClient();

      return useMutation({
        ...options,
        mutationFn: ({ id, input }) => client.update(id, input),
        onSuccess: async (data, variables, onMutateResult, context) => {
          await invalidateResourceQueries(
            queryClient,
            resolveInvalidation(options?.invalidates, data, variables, () =>
              resource.invalidates.update(variables.id),
            ),
          );
          await options?.onSuccess?.(data, variables, onMutateResult, context);
        },
      });
    },
    useDelete: (options) => {
      const queryClient = useQueryClient();

      return useMutation({
        ...options,
        mutationFn: ({ id }) => client.delete(id),
        onSuccess: async (data, variables, onMutateResult, context) => {
          await invalidateResourceQueries(
            queryClient,
            resolveInvalidation(options?.invalidates, data, variables, () =>
              resource.invalidates.delete(variables.id),
            ),
          );
          await options?.onSuccess?.(data, variables, onMutateResult, context);
        },
      });
    },
    useAction: (name, options) => {
      const queryClient = useQueryClient();

      return useMutation({
        ...options,
        mutationFn: (request) => client.action(name, request),
        onSuccess: async (data, variables, onMutateResult, context) => {
          await invalidateResourceQueries(
            queryClient,
            resolveInvalidation(options?.invalidates, data, variables, () =>
              resource.invalidates.action(name),
            ),
          );
          await options?.onSuccess?.(data, variables, onMutateResult, context);
        },
      });
    },
  };
}

/**
 * Creates a named hook registry from already-bound resource clients. This stays
 * in the React Query adapter so core clients remain usable without React.
 */
export function createSliceHooks<
  Resources extends Record<string, AnyResource>,
>(config: {
  resources: Resources;
  clients: SliceClient<Resources>;
}): SliceHooks<Resources> {
  return Object.fromEntries(
    Object.entries(config.resources).map(([name, resource]) => [
      name,
      createResourceHooks(
        resource as Resource<any, any, any, any, any>,
        config.clients[name as keyof Resources] as ResourceClient<
          any,
          any,
          any,
          any,
          any
        >,
      ),
    ]),
  ) as SliceHooks<Resources>;
}

/** Invalidates each generated query key using TanStack Query's public API. */
export async function invalidateResourceQueries(
  queryClient: QueryClient,
  keys: QueryKeys,
): Promise<void> {
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

/** Invalidates every query under a resource root key. */
export async function invalidateResource(
  queryClient: QueryClient,
  resource: ResourceQueryRoot,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: resource.keys.all });
}

/** Removes cached queries for one resource without touching unrelated app state. */
export function clearResourceQueries(
  queryClient: QueryClient,
  resource: ResourceQueryRoot,
): void {
  queryClient.removeQueries({ queryKey: resource.keys.all });
}

/** Removes cached queries for a known set of Slice resources. */
export function clearSliceQueries(
  queryClient: QueryClient,
  resources: readonly ResourceQueryRoot[],
): void {
  for (const resource of resources) {
    clearResourceQueries(queryClient, resource);
  }
}

/**
 * Reads a compact query-cache state tree. Cached data is omitted by default
 * because API payloads often contain PII; use TanStack Query devtools when the
 * full payload tree is needed in trusted local development.
 */
export function getSliceQuerySnapshot(
  queryClient: QueryClient,
  resources?: readonly ResourceQueryRoot[],
): SliceQuerySnapshot {
  const resourceNames = resources?.map((resource) => resource.name) ?? [];
  const resourceNameSet = new Set(resourceNames);
  const queries = queryClient
    .getQueryCache()
    .findAll()
    .filter((query) => {
      if (resourceNameSet.size === 0) {
        return true;
      }

      return resourceNameSet.has(String(query.queryKey[0]));
    })
    .map((query): SliceQuerySnapshotEntry => ({
      queryHash: query.queryHash,
      queryKey: query.queryKey,
      resource:
        typeof query.queryKey[0] === "string" ? query.queryKey[0] : undefined,
      status: query.state.status,
      fetchStatus: query.state.fetchStatus,
      isInvalidated: query.state.isInvalidated,
      dataUpdatedAt: query.state.dataUpdatedAt,
      errorUpdatedAt: query.state.errorUpdatedAt,
    }));

  return {
    resources: resourceNames,
    queries,
  };
}

/**
 * Resolves mutation invalidation policy. `false` means the caller takes full
 * ownership; arrays replace defaults; functions can derive keys from mutation
 * results.
 */
function resolveInvalidation<Data, Variables>(
  invalidates:
    | ResourceMutationOptions<Data, Variables>["invalidates"]
    | undefined,
  data: Data,
  variables: Variables,
  getDefaultKeys: () => QueryKeys,
): QueryKeys {
  if (invalidates === false) {
    return [];
  }

  if (typeof invalidates === "function") {
    return invalidates(data, variables);
  }

  return invalidates ?? getDefaultKeys();
}
