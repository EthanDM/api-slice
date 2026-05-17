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

export type ResourceQueryOptions<Data, Selected = Data> = Omit<
  UseQueryOptions<Data, Error, Selected, QueryKey>,
  "queryKey" | "queryFn"
>;

export type ResourceMutationOptions<Data, Variables, Context = unknown> = Omit<
  UseMutationOptions<Data, Error, Variables, Context>,
  "mutationFn" | "onSuccess"
> & {
  invalidates?: false | QueryKeys | ((data: Data, variables: Variables) => QueryKeys);
  onSuccess?: UseMutationOptions<Data, Error, Variables, Context>["onSuccess"];
};

export type UpdateVariables<UpdateInput> = {
  id: Id;
  input: UpdateInput;
};

export type DeleteVariables = {
  id: Id;
};

export type ResourceHooks<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap = {},
> = {
  useList: <Selected = Entity[]>(
    input?: ListInput,
    options?: ResourceQueryOptions<Entity[], Selected>,
  ) => UseQueryResult<Selected, Error>;
  useDetail: <Selected = Entity>(
    id: Id,
    options?: ResourceQueryOptions<Entity, Selected>,
  ) => UseQueryResult<Selected, Error>;
  useCreate: (
    options?: ResourceMutationOptions<Entity, CreateInput>,
  ) => UseMutationResult<Entity, Error, CreateInput>;
  useUpdate: (
    options?: ResourceMutationOptions<Entity, UpdateVariables<UpdateInput>>,
  ) => UseMutationResult<Entity, Error, UpdateVariables<UpdateInput>>;
  useDelete: (
    options?: ResourceMutationOptions<void, DeleteVariables>,
  ) => UseMutationResult<void, Error, DeleteVariables>;
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

export async function invalidateResourceQueries(
  queryClient: QueryClient,
  keys: QueryKeys,
): Promise<void> {
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

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
