import type { z } from "zod";

export type Id = string | number;
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type InferSchemaOutput<Schema> = Schema extends z.ZodTypeAny
  ? z.output<Schema>
  : never;

export type InferSchemaInput<Schema> = Schema extends z.ZodTypeAny
  ? z.input<Schema>
  : never;

export type OptionalSchemaInput<Schema> = Schema extends z.ZodTypeAny
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

export type RuntimeActions<Actions extends ResourceActionMap> = {
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
      params: infer Params extends (
        args: { id?: Id; input?: unknown },
      ) => Record<string, Id>;
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
