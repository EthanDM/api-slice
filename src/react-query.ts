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
  ResourceActionOutput,
  ResourceActionRequest,
  RuntimeResourceActionMap,
} from "./resource.js";

type QueryKey = readonly unknown[];
type QueryKeys = readonly QueryKey[];

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

/** Invalidates each generated query key using TanStack Query's public API. */
export async function invalidateResourceQueries(
  queryClient: QueryClient,
  keys: QueryKeys,
): Promise<void> {
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
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
