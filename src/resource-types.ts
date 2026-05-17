/**
 * Core type model for resource definitions. These types describe the public
 * contract adapters rely on; transport-specific behavior belongs in adapter
 * modules, not here.
 */
import type { z } from "zod";

/** Stable identifier accepted by generated detail, update, delete, and action paths. */
export type Id = string | number;

/** HTTP verbs Slice can emit through resource clients and action definitions. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Extracts the post-parse value a Zod schema exposes to callers. */
export type InferSchemaOutput<Schema> = Schema extends z.ZodTypeAny
  ? z.output<Schema>
  : never;

/** Extracts the pre-parse value a caller may pass into a Zod schema. */
export type InferSchemaInput<Schema> = Schema extends z.ZodTypeAny
  ? z.input<Schema>
  : never;

/** Represents an omitted input schema as an operation that only accepts `undefined`. */
export type OptionalSchemaInput<Schema> = Schema extends z.ZodTypeAny
  ? z.input<Schema>
  : undefined;

/**
 * Zod schemas that define the clean app-facing resource model. Operation
 * overrides may parse raw backend envelopes separately, but the client methods
 * ultimately return values compatible with `entity`.
 */
export type ResourceSchemas<
  EntitySchema extends z.ZodTypeAny,
  ListInputSchema extends z.ZodTypeAny | undefined = undefined,
  CreateInputSchema extends z.ZodTypeAny | undefined = undefined,
  UpdateInputSchema extends z.ZodTypeAny | undefined = undefined,
> = {
  /** App-facing entity shape returned from detail/create/update and list items. */
  entity: EntitySchema;
  /** Optional filter/search input accepted by generated list calls. */
  listInput?: ListInputSchema;
  /** Required payload schema for generated create calls. */
  createInput?: CreateInputSchema;
  /** Required payload schema for generated update calls. */
  updateInput?: UpdateInputSchema;
};

/**
 * Describes a non-CRUD endpoint relative to the resource base path. Actions
 * are for domain verbs such as archive, approve, duplicate, or sync where a
 * CRUD method name would hide intent.
 */
export type ResourceActionConfig = {
  /** HTTP verb used for this domain action. */
  method: HttpMethod;
  /** Action path relative to the resource base path; may include `:id`. */
  path: `/${string}`;
  /** Optional payload/query schema parsed before the action request is sent. */
  input?: z.ZodTypeAny;
  /** Optional response schema; actions without one resolve `void`. */
  output?: z.ZodTypeAny;
  /** Maps an action request into named `:path` parameters beyond the default `id`. */
  params?: (args: { id?: Id; input?: unknown }) => Record<string, Id>;
  /** Query keys the React Query adapter invalidates after this action succeeds. */
  invalidates?: readonly (readonly unknown[])[];
};

/** Named action definitions keyed by the string callers pass to `client.action()`. */
export type ResourceActionMap = Record<string, ResourceActionConfig>;

/** Arguments available to operation mappers when adapting an inconsistent API. */
export type ResourceOperationArgs<Input = unknown> = {
  /** Resource id for detail/update/delete operations and id-based actions. */
  id?: Id;
  /** Already-validated operation input, when that operation has a schema. */
  input?: Input;
};

/**
 * Overrides how one CRUD operation talks to the backend without changing the
 * app-facing resource model. Use this to adapt legacy routes, renamed params,
 * envelope responses, or snake_case request bodies at the edge.
 */
export type ResourceOperationConfig<Input, Output> = {
  method?: HttpMethod;
  path?: `/${string}`;
  /** Maps operation arguments into named `:path` parameters beyond the default `id`. */
  params?: (args: ResourceOperationArgs<Input>) => Record<string, Id>;
  /** Builds query params from already-validated operation input. */
  query?: (args: ResourceOperationArgs<Input>) => unknown;
  /** Builds request bodies from already-validated operation input. */
  body?: (args: ResourceOperationArgs<Input>) => unknown;
  /** Parses the raw transport response before optional selection into app data. */
  response?: z.ZodTypeAny;
  /** Converts a parsed raw response envelope into the app-facing operation output. */
  select?: (response: unknown) => Output;
};

/** Per-CRUD transport overrides for APIs that do not follow Slice defaults. */
export type ResourceOperations<ListInput, CreateInput, UpdateInput, Entity> = {
  list?: ResourceOperationConfig<ListInput, Entity[]>;
  detail?: ResourceOperationConfig<undefined, Entity>;
  create?: ResourceOperationConfig<CreateInput, Entity>;
  update?: ResourceOperationConfig<UpdateInput, Entity>;
  delete?: ResourceOperationConfig<undefined, void>;
};

/** Serializable view of one resource action for tools and agent workflows. */
export type ResourceActionDescription = {
  /** Action key from the resource definition. */
  name: string;
  /** HTTP verb used by the action. */
  method: HttpMethod;
  /** Action path relative to the resource base path. */
  path: string;
  /** Whether this action validates caller input. */
  hasInput: boolean;
  /** Whether this action validates a meaningful return value. */
  hasOutput: boolean;
  /** Whether this action declares custom invalidation keys. */
  hasInvalidation: boolean;
};

/** Serializable resource summary for docs, debug panels, and coding agents. */
export type ResourceDescription = {
  /** Resource name used for cache keys and diagnostics. */
  name: string;
  /** Default collection path used by generated operations. */
  path: string;
  /** Declared schema presence without exposing schema implementation details. */
  schemas: {
    entity: true;
    listInput: boolean;
    createInput: boolean;
    updateInput: boolean;
  };
  /** CRUD operations whose transport behavior was overridden. */
  operations: ResourceOperationName[];
  /** Declared custom actions with method/path and schema presence. */
  actions: ResourceActionDescription[];
};

/**
 * Optional diagnostic metadata attached by resource clients. Transport
 * adapters must not depend on this for request correctness; it exists so
 * recorders and loggers can group calls by app-facing resource operation.
 */
export type HttpRequestMeta = {
  /** Resource name from the `resource()` definition, such as `projects`. */
  resource?: string;
  /** CRUD operation or custom action name emitted by the resource client. */
  operation?: string;
  /** Present when `operation` came from a custom resource action. */
  action?: string;
};

/** Full resource definition consumed by `resource()`. */
export type ResourceConfig<
  EntitySchema extends z.ZodTypeAny,
  ListInputSchema extends z.ZodTypeAny | undefined = undefined,
  CreateInputSchema extends z.ZodTypeAny | undefined = undefined,
  UpdateInputSchema extends z.ZodTypeAny | undefined = undefined,
  Actions extends ResourceActionMap = {},
> = {
  /** Stable resource name used as the root query-key segment. */
  name: string;
  /** Default REST-style collection path used when operations do not override it. */
  path: `/${string}`;
  schemas: ResourceSchemas<
    EntitySchema,
    ListInputSchema,
    CreateInputSchema,
    UpdateInputSchema
  >;
  /** Optional per-CRUD mapping for APIs whose transport shape differs from the app model. */
  operations?: ResourceOperations<
    OptionalSchemaInput<ListInputSchema>,
    InferSchemaInput<CreateInputSchema>,
    InferSchemaInput<UpdateInputSchema>,
    InferSchemaOutput<EntitySchema>
  >;
  /** Optional domain actions beyond the standard CRUD surface. */
  actions?: Actions;
};

/**
 * Minimal transport interface used by generated resource clients. Adapters may
 * use fetch, ky, React Native networking, mocks, or any other implementation.
 */
export type HttpClient = <Output>(request: {
  method: HttpMethod;
  path: string;
  query?: unknown;
  body?: unknown;
  meta?: HttpRequestMeta;
}) => Promise<Output>;

/** Stable query-key factory used by the React Query adapter and callers. */
export type ResourceKeys<ListInput = unknown> = {
  /** Coarse key for invalidating every query belonging to the resource. */
  all: readonly [string];
  /** List key includes filters so separate list states do not collide. */
  list: (input?: ListInput) => readonly [string, "list", ListInput | undefined];
  /** Detail key includes id so item-level mutations can invalidate narrowly. */
  detail: (id: Id) => readonly [string, "detail", Id];
};

/** CRUD mutation names that have built-in invalidation defaults. */
export type ResourceMutationName = "create" | "update" | "delete";

/** CRUD operation names that can be generated or transport-overridden. */
export type ResourceOperationName =
  | "list"
  | "detail"
  | ResourceMutationName;

/** Query-key invalidation policy derived from a resource definition. */
export type ResourceInvalidation<ListInput = unknown> = {
  /** Default create invalidation targets collection-level queries. */
  create: (input?: ListInput) => readonly (readonly unknown[])[];
  /** Default update invalidation targets the changed entity and collection queries. */
  update: (id: Id, input?: ListInput) => readonly (readonly unknown[])[];
  /** Default delete invalidation mirrors update because stale detail queries may exist. */
  delete: (id: Id, input?: ListInput) => readonly (readonly unknown[])[];
  /** Action invalidation uses explicit action metadata or falls back to the resource root. */
  action: (name: string) => readonly (readonly unknown[])[];
};

/**
 * Runtime client generated from a resource definition. Methods validate input
 * before transport and validate/transform output before resolving.
 */
export type ResourceClient<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap = {},
> = {
  /** Reads the collection and returns parsed app-facing entities. */
  list: (input?: ListInput) => Promise<Entity[]>;
  /** Reads one entity by id using the resource or operation-level detail route. */
  detail: (id: Id) => Promise<Entity>;
  /** Sends create input and returns the parsed created entity. */
  create: (input: CreateInput) => Promise<Entity>;
  /** Sends update input and returns the parsed updated entity. */
  update: (id: Id, input: UpdateInput) => Promise<Entity>;
  /** Sends delete using the resource or operation-level delete route. */
  delete: (id: Id) => Promise<void>;
  /** Executes a named domain action with request/output types inferred from config. */
  action: <Name extends keyof Actions & string>(
    name: Name,
    request: ResourceActionRequest<Actions[Name]>,
  ) => Promise<ResourceActionOutput<Actions[Name]>>;
};

/** Action config after TypeScript has preserved literal action keys. */
export type RuntimeResourceAction = {
  method: HttpMethod;
  path: `/${string}`;
  input?: z.ZodTypeAny;
  output?: z.ZodTypeAny;
  params?: (args: { id?: Id; input?: unknown }) => Record<string, Id>;
  invalidates?: readonly (readonly unknown[])[];
};

/** Runtime action map carried by a `Resource` instance. */
export type RuntimeResourceActionMap = Record<string, RuntimeResourceAction>;

/** Request shape inferred for one custom action. */
export type ResourceActionRequest<Action extends RuntimeResourceAction> =
  Action["input"] extends z.ZodTypeAny
    ? { id?: Id; input: z.input<Action["input"]> }
    : { id?: Id; input?: undefined };

/** Output shape inferred for one custom action. Actions without output resolve void. */
export type ResourceActionOutput<Action extends RuntimeResourceAction> =
  Action["output"] extends z.ZodTypeAny ? z.output<Action["output"]> : void;

/** Object form of the action client surface, useful for adapter authors. */
export type ResourceActionsClient<Actions extends RuntimeResourceActionMap> = {
  [Name in keyof Actions & string]: (
    request: ResourceActionRequest<Actions[Name]>,
  ) => Promise<ResourceActionOutput<Actions[Name]>>;
};

/** Resource instance returned by `resource()`, including schemas for adapters. */
export type Resource<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap = {},
> = {
  /** Stable resource name used for cache keys and diagnostics. */
  name: string;
  /** Default collection path used by generated client calls. */
  path: `/${string}`;
  /** Runtime schemas retained so adapters can validate inputs and outputs. */
  schemas: {
    entity: z.ZodType<Entity>;
    listInput?: z.ZodType<ListInput>;
    createInput?: z.ZodType<CreateInput>;
    updateInput?: z.ZodType<UpdateInput>;
  };
  /** Runtime action definitions keyed by action name. */
  actions: Actions;
  /** Query-key factory derived from the resource name. */
  keys: ResourceKeys<ListInput>;
  /** Invalidation defaults derived from CRUD and action definitions. */
  invalidates: ResourceInvalidation<ListInput>;
  /** Returns a serializable contract summary for tooling and agent workflows. */
  describe: () => ResourceDescription;
  /** Builds a resource client around whichever transport adapter the app provides. */
  client: (http: HttpClient) => ResourceClient<
    Entity,
    ListInput,
    CreateInput,
    UpdateInput,
    Actions
  >;
};

/** Any resource instance that can be bound to an HTTP client. */
export type AnyResource = Resource<
  any,
  any,
  any,
  any,
  any
>;

/** Client map produced by binding a shared HTTP adapter to named resources. */
export type SliceClient<Resources extends Record<string, AnyResource>> = {
  [Name in keyof Resources]: ReturnType<Resources[Name]["client"]>;
};

/** Preserves action-specific schemas and invalidation metadata after inference. */
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
