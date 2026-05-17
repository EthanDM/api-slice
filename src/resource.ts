import type { z } from "zod";

import {
  buildActionPath,
  buildOperationPath,
  getAction,
  parseOperationOutput,
  parseOptional,
  parseRequired,
} from "./resource-request.js";
import type {
  InferSchemaInput,
  InferSchemaOutput,
  OptionalSchemaInput,
  Resource,
  ResourceActionMap,
  ResourceActionOutput,
  ResourceConfig,
  ResourceKeys,
  RuntimeActions,
  RuntimeResourceAction,
} from "./resource-types.js";

/**
 * Defines the app-facing contract for one API resource and returns the client
 * helpers derived from that contract. The resource keeps backend transport
 * quirks behind `operations` and `actions`, so consumers work with the parsed
 * entity schema instead of raw API envelopes.
 *
 * @throws When a configured operation/action is missing a required schema,
 * path parameter, or returns data that fails its Zod output contract.
 *
 * @example
 * const projects = resource({
 *   name: "projects",
 *   path: "/projects",
 *   schemas: { entity: ProjectSchema, createInput: CreateProjectSchema },
 * });
 */
export function resource<
  EntitySchema extends z.ZodTypeAny,
  ListInputSchema extends z.ZodTypeAny | undefined = undefined,
  CreateInputSchema extends z.ZodTypeAny | undefined = undefined,
  UpdateInputSchema extends z.ZodTypeAny | undefined = undefined,
  Actions extends ResourceActionMap = {},
>(
  config: ResourceConfig<
    EntitySchema,
    ListInputSchema,
    CreateInputSchema,
    UpdateInputSchema,
    Actions
  >,
): Resource<
  InferSchemaOutput<EntitySchema>,
  OptionalSchemaInput<ListInputSchema>,
  InferSchemaInput<CreateInputSchema>,
  InferSchemaInput<UpdateInputSchema>,
  RuntimeActions<Actions>
> {
  type ListInput = OptionalSchemaInput<ListInputSchema>;
  type Entity = InferSchemaOutput<EntitySchema>;
  type CreateInput = InferSchemaInput<CreateInputSchema>;
  type UpdateInput = InferSchemaInput<UpdateInputSchema>;

  const keys: ResourceKeys<ListInput> = {
    all: [config.name] as const,
    list: (input) => [config.name, "list", input] as const,
    detail: (id) => [config.name, "detail", id] as const,
  };

  return {
    name: config.name,
    path: config.path,
    schemas: config.schemas as Resource<
      Entity,
      ListInput,
      CreateInput,
      UpdateInput,
      RuntimeActions<Actions>
    >["schemas"],
    actions: (config.actions ?? {}) as RuntimeActions<Actions>,
    keys,
    invalidates: {
      create: (input) => [keys.all, keys.list(input)],
      update: (id, input) => [keys.detail(id), keys.list(input), keys.all],
      delete: (id, input) => [keys.detail(id), keys.list(input), keys.all],
      action: (name) => {
        const action = getAction(config.actions, name as keyof Actions & string);

        return action.invalidates ?? [keys.all];
      },
    },
    client: (http) => ({
      list: async (input) => {
        const operation = config.operations?.list;
        const parsedInput = parseOptional(config.schemas.listInput, input);
        const output = await http<unknown>({
          method: operation?.method ?? "GET",
          path: buildOperationPath(operation?.path ?? config.path, {
            input: parsedInput,
            params: operation?.params,
          }),
          query: operation?.query
            ? operation.query({ input: parsedInput })
            : parsedInput,
        });

        return parseOperationOutput(
          operation,
          config.schemas.entity.array(),
          output,
        ) as Entity[];
      },
      detail: async (id) => {
        const operation = config.operations?.detail;
        const output = await http<unknown>({
          method: operation?.method ?? "GET",
          path: buildOperationPath(operation?.path ?? `${config.path}/:id`, {
            id,
            params: operation?.params,
          }),
        });

        return parseOperationOutput(
          operation,
          config.schemas.entity,
          output,
        ) as Entity;
      },
      create: async (input) => {
        const operation = config.operations?.create;
        const parsedInput = parseRequired(config.schemas.createInput, input);
        const output = await http<unknown>({
          method: operation?.method ?? "POST",
          path: buildOperationPath(operation?.path ?? config.path, {
            input: parsedInput,
            params: operation?.params,
          }),
          query: operation?.query?.({ input: parsedInput }),
          body: operation?.body
            ? operation.body({ input: parsedInput })
            : parsedInput,
        });

        return parseOperationOutput(
          operation,
          config.schemas.entity,
          output,
        ) as Entity;
      },
      update: async (id, input) => {
        const operation = config.operations?.update;
        const parsedInput = parseRequired(config.schemas.updateInput, input);
        const output = await http<unknown>({
          method: operation?.method ?? "PATCH",
          path: buildOperationPath(operation?.path ?? `${config.path}/:id`, {
            id,
            input: parsedInput,
            params: operation?.params,
          }),
          query: operation?.query?.({ id, input: parsedInput }),
          body: operation?.body
            ? operation.body({ id, input: parsedInput })
            : parsedInput,
        });

        return parseOperationOutput(
          operation,
          config.schemas.entity,
          output,
        ) as Entity;
      },
      delete: async (id) => {
        const operation = config.operations?.delete;
        await http<void>({
          method: operation?.method ?? "DELETE",
          path: buildOperationPath(operation?.path ?? `${config.path}/:id`, {
            id,
            params: operation?.params,
          }),
          query: operation?.query?.({ id }),
          body: operation?.body?.({ id }),
        });
      },
      action: async (name, request) => {
        const action = getAction(config.actions, name) as RuntimeResourceAction;
        const parsedInput = parseOptional(action.input, request.input);
        const output = await http<unknown>({
          method: action.method,
          path: buildActionPath(config.path, action, {
            id: request.id,
            input: parsedInput,
          }),
          query: action.method === "GET" ? parsedInput : undefined,
          body: action.method === "GET" ? undefined : parsedInput,
        });

        if (!action.output) {
          return undefined as ResourceActionOutput<RuntimeActions<Actions>[typeof name]>;
        }

        return action.output.parse(output) as ResourceActionOutput<
          RuntimeActions<Actions>[typeof name]
        >;
      },
    }),
  };
}

export type {
  HttpClient,
  HttpMethod,
  Id,
  Resource,
  ResourceActionConfig,
  ResourceActionMap,
  ResourceActionOutput,
  ResourceActionRequest,
  ResourceActionsClient,
  ResourceClient,
  ResourceConfig,
  ResourceInvalidation,
  ResourceKeys,
  ResourceMutationName,
  ResourceOperationArgs,
  ResourceOperationConfig,
  ResourceOperations,
  ResourceSchemas,
  RuntimeResourceAction,
  RuntimeResourceActionMap,
} from "./resource-types.js";
