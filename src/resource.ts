import type { z } from "zod";

export type Id = string | number;
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type InferSchemaOutput<Schema> = Schema extends z.ZodTypeAny
  ? z.output<Schema>
  : never;

type InferSchemaInput<Schema> = Schema extends z.ZodTypeAny
  ? z.input<Schema>
  : never;

type OptionalSchemaInput<Schema> = Schema extends z.ZodTypeAny
  ? z.input<Schema>
  : undefined;

export type ResourceSchemas<
  EntitySchema extends z.ZodTypeAny,
  ListInputSchema extends z.ZodTypeAny | undefined = undefined,
  CreateInputSchema extends z.ZodTypeAny | undefined = undefined,
  UpdateInputSchema extends z.ZodTypeAny | undefined = undefined,
> = {
  entity: EntitySchema;
  listInput?: ListInputSchema;
  createInput?: CreateInputSchema;
  updateInput?: UpdateInputSchema;
};

export type ResourceActionConfig = {
  method: HttpMethod;
  path: `/${string}`;
  input?: z.ZodTypeAny;
  output?: z.ZodTypeAny;
  params?: (args: { id?: Id; input?: unknown }) => Record<string, Id>;
  invalidates?: readonly (readonly unknown[])[];
};

export type ResourceActionMap = Record<string, ResourceActionConfig>;

export type ResourceOperationArgs<Input = unknown> = {
  id?: Id;
  input?: Input;
};

export type ResourceOperationConfig<Input, Output> = {
  method?: HttpMethod;
  path?: `/${string}`;
  params?: (args: ResourceOperationArgs<Input>) => Record<string, Id>;
  query?: (args: ResourceOperationArgs<Input>) => unknown;
  body?: (args: ResourceOperationArgs<Input>) => unknown;
  response?: z.ZodTypeAny;
  select?: (response: unknown) => Output;
};

export type ResourceOperations<ListInput, CreateInput, UpdateInput, Entity> = {
  list?: ResourceOperationConfig<ListInput, Entity[]>;
  detail?: ResourceOperationConfig<undefined, Entity>;
  create?: ResourceOperationConfig<CreateInput, Entity>;
  update?: ResourceOperationConfig<UpdateInput, Entity>;
  delete?: ResourceOperationConfig<undefined, void>;
};

export type ResourceConfig<
  EntitySchema extends z.ZodTypeAny,
  ListInputSchema extends z.ZodTypeAny | undefined = undefined,
  CreateInputSchema extends z.ZodTypeAny | undefined = undefined,
  UpdateInputSchema extends z.ZodTypeAny | undefined = undefined,
  Actions extends ResourceActionMap = {},
> = {
  name: string;
  path: `/${string}`;
  schemas: ResourceSchemas<
    EntitySchema,
    ListInputSchema,
    CreateInputSchema,
    UpdateInputSchema
  >;
  operations?: ResourceOperations<
    OptionalSchemaInput<ListInputSchema>,
    InferSchemaInput<CreateInputSchema>,
    InferSchemaInput<UpdateInputSchema>,
    InferSchemaOutput<EntitySchema>
  >;
  actions?: Actions;
};

export type HttpClient = <Output>(request: {
  method: HttpMethod;
  path: string;
  query?: unknown;
  body?: unknown;
}) => Promise<Output>;

export type ResourceKeys<ListInput = unknown> = {
  all: readonly [string];
  list: (input?: ListInput) => readonly [string, "list", ListInput | undefined];
  detail: (id: Id) => readonly [string, "detail", Id];
};

export type ResourceMutationName = "create" | "update" | "delete";

export type ResourceInvalidation<ListInput = unknown> = {
  create: (input?: ListInput) => readonly (readonly unknown[])[];
  update: (id: Id, input?: ListInput) => readonly (readonly unknown[])[];
  delete: (id: Id, input?: ListInput) => readonly (readonly unknown[])[];
  action: (name: string) => readonly (readonly unknown[])[];
};

export type ResourceClient<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap = {},
> = {
  list: (input?: ListInput) => Promise<Entity[]>;
  detail: (id: Id) => Promise<Entity>;
  create: (input: CreateInput) => Promise<Entity>;
  update: (id: Id, input: UpdateInput) => Promise<Entity>;
  delete: (id: Id) => Promise<void>;
  action: <Name extends keyof Actions & string>(
    name: Name,
    request: ResourceActionRequest<Actions[Name]>,
  ) => Promise<ResourceActionOutput<Actions[Name]>>;
};

export type RuntimeResourceAction = {
  method: HttpMethod;
  path: `/${string}`;
  input?: z.ZodTypeAny;
  output?: z.ZodTypeAny;
  params?: (args: { id?: Id; input?: unknown }) => Record<string, Id>;
  invalidates?: readonly (readonly unknown[])[];
};

export type RuntimeResourceActionMap = Record<string, RuntimeResourceAction>;

export type ResourceActionRequest<Action extends RuntimeResourceAction> =
  Action["input"] extends z.ZodTypeAny
    ? { id?: Id; input: z.input<Action["input"]> }
    : { id?: Id; input?: undefined };

export type ResourceActionOutput<Action extends RuntimeResourceAction> =
  Action["output"] extends z.ZodTypeAny ? z.output<Action["output"]> : void;

export type ResourceActionsClient<Actions extends RuntimeResourceActionMap> = {
  [Name in keyof Actions & string]: (
    request: ResourceActionRequest<Actions[Name]>,
  ) => Promise<ResourceActionOutput<Actions[Name]>>;
};

export type Resource<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap = {},
> = {
  name: string;
  path: `/${string}`;
  schemas: {
    entity: z.ZodType<Entity>;
    listInput?: z.ZodType<ListInput>;
    createInput?: z.ZodType<CreateInput>;
    updateInput?: z.ZodType<UpdateInput>;
  };
  actions: Actions;
  keys: ResourceKeys<ListInput>;
  invalidates: ResourceInvalidation<ListInput>;
  client: (http: HttpClient) => ResourceClient<
    Entity,
    ListInput,
    CreateInput,
    UpdateInput,
    Actions
  >;
};

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
          query:
            action.method === "GET"
              ? parsedInput
              : undefined,
          body:
            action.method === "GET"
              ? undefined
              : parsedInput,
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

type RuntimeActions<Actions extends ResourceActionMap> = {
  [Name in keyof Actions & string]: {
    method: Actions[Name]["method"];
    path: Actions[Name]["path"];
    input: Actions[Name] extends { input: infer Input extends z.ZodTypeAny }
      ? Input
      : undefined;
    output: Actions[Name] extends { output: infer Output extends z.ZodTypeAny }
      ? Output
      : undefined;
    params: Actions[Name] extends {
      params: infer Params extends (args: { id?: Id; input?: unknown }) => Record<string, Id>;
    }
      ? Params
      : undefined;
    invalidates: Actions[Name] extends {
      invalidates: infer Invalidates extends readonly (readonly unknown[])[];
    }
      ? Invalidates
      : undefined;
  };
};

function getAction<Actions extends ResourceActionMap, Name extends keyof Actions & string>(
  actions: Actions | undefined,
  name: Name,
): Actions[Name] {
  const action = actions?.[name];

  if (!action) {
    throw new Error(`Unknown resource action: ${name}`);
  }

  return action;
}

function buildActionPath(
  basePath: string,
  action: RuntimeResourceAction,
  args: ResourceOperationArgs,
): string {
  return buildOperationPath(`${basePath}${action.path}`, {
    ...args,
    params: action.params,
  });
}

function buildOperationPath<Input>(
  path: string,
  args: ResourceOperationArgs<Input> & {
    params?: (args: ResourceOperationArgs<Input>) => Record<string, Id>;
  },
): string {
  const params = {
    ...(args.id === undefined ? {} : { id: args.id }),
    ...(args.params?.(args) ?? {}),
  };
  let builtPath = path;

  for (const [name, value] of Object.entries(params)) {
    builtPath = builtPath.replaceAll(
      `:${name}`,
      encodeURIComponent(String(value)),
    );
  }

  const missingParam = builtPath.match(/:[A-Za-z0-9_]+/);

  if (missingParam) {
    throw new Error(`Missing path parameter: ${missingParam[0].slice(1)}`);
  }

  return builtPath;
}

function parseOperationOutput<Output>(
  operation: ResourceOperationConfig<any, Output> | undefined,
  defaultSchema: z.ZodType<Output>,
  output: unknown,
): Output {
  const parsed = operation?.response
    ? operation.response.parse(output)
    : defaultSchema.parse(output);

  return operation?.select ? operation.select(parsed) : parsed;
}

function parseOptional<Schema extends z.ZodTypeAny | undefined>(
  schema: Schema,
  input: unknown,
): Schema extends z.ZodTypeAny ? z.output<Schema> | undefined : undefined {
  if (!schema || input === undefined) {
    return undefined as Schema extends z.ZodTypeAny
      ? z.output<Schema> | undefined
      : undefined;
  }

  return schema.parse(input) as Schema extends z.ZodTypeAny
    ? z.output<Schema>
    : undefined;
}

function parseRequired<Schema extends z.ZodTypeAny | undefined>(
  schema: Schema,
  input: unknown,
): Schema extends z.ZodTypeAny ? z.output<Schema> : never {
  if (!schema) {
    throw new Error("Resource operation requires a schema");
  }

  return schema.parse(input) as Schema extends z.ZodTypeAny
    ? z.output<Schema>
    : never;
}
