import type { z } from "zod";

/** Action intent used for cataloging backend operations without implying CRUD. */
export type StoreActionKind = "query" | "mutation" | "command";

/** Extracts the pre-parse input value accepted by an optional Zod schema. */
export type StoreActionInput<InputSchema> = InputSchema extends z.ZodTypeAny
  ? z.input<InputSchema>
  : undefined;

/** Extracts the parsed output value returned by an optional Zod schema. */
export type StoreActionOutput<OutputSchema> = OutputSchema extends z.ZodTypeAny
  ? z.output<OutputSchema>
  : void;

/** Runtime arguments passed to a store action after input validation. */
export type StoreActionRunArgs<Input, Context> = {
  /** App-owned dependencies such as db handles, env bindings, user/session, or loggers. */
  ctx: Context;
  /** Parsed action input. Omitted schemas receive `undefined`. */
  input: Input;
};

/**
 * Definition for one backend action. The action owns validation and intent
 * metadata, while callers own dependency injection through `ctx`.
 */
export type StoreActionConfig<
  Kind extends StoreActionKind,
  InputSchema extends z.ZodTypeAny | undefined,
  OutputSchema extends z.ZodTypeAny | undefined,
  Context,
> = {
  /** Catalog kind used by tooling and reviewers to separate reads from writes. */
  kind: Kind;
  /** Optional input schema parsed before `run` executes. */
  input?: InputSchema;
  /** Optional output schema parsed after `run` resolves. */
  output?: OutputSchema;
  /** Executes the app-owned backend operation with already-validated input. */
  run: (
    args: StoreActionRunArgs<StoreActionInput<InputSchema>, Context>,
  ) =>
    | StoreActionOutput<OutputSchema>
    | Promise<StoreActionOutput<OutputSchema>>;
  /** Optional human-readable description for generated catalogs or debug panels. */
  description?: string;
};

/** Runtime store action returned by `query`, `mutation`, and `command`. */
export type StoreAction<
  Kind extends StoreActionKind = StoreActionKind,
  Input = unknown,
  Output = unknown,
  Context = unknown,
> = {
  /** Catalog kind used for visibility and review, not runtime permission enforcement. */
  kind: Kind;
  /** Optional description copied from the action config. */
  description?: string;
  /** Input schema retained for adapters that want to inspect or reuse validation. */
  inputSchema?: z.ZodTypeAny;
  /** Output schema retained for adapters that want to inspect or reuse validation. */
  outputSchema?: z.ZodTypeAny;
  /**
   * Validates input, executes the underlying operation, and validates output.
   *
   * @throws Zod errors when input or output does not match the action contract.
   */
  run: (args: StoreActionRunArgs<Input, Context>) => Promise<Output>;
};

/** Named store action map passed to `store()`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StoreActionMap = Record<string, StoreAction<StoreActionKind, any, any, any>>;

/** Catalog entry returned by `listActions()` and `getAction()`. */
export type StoreActionMetadata = {
  /** Action key inside the store. */
  name: string;
  /** Declared action intent. */
  kind: StoreActionKind;
  /** Whether this action validates caller input. */
  hasInput: boolean;
  /** Whether this action validates a meaningful return value. */
  hasOutput: boolean;
  /** Optional description copied from the action definition. */
  description?: string;
};

/** Serializable store summary for docs, debug panels, and coding agents. */
export type StoreDescription = {
  /** Stable catalog name, usually matching the backend domain area. */
  name: string;
  /** Cataloged backend actions without implementation functions. */
  actions: StoreActionMetadata[];
};

/** Input arguments inferred for one store action. */
export type StoreRunArgs<
  Action extends StoreAction,
  Context,
> = Action extends StoreAction<StoreActionKind, infer Input, unknown, Context>
  ? StoreActionRunArgs<Input, Context>
  : never;

/** Output inferred for one store action. */
export type StoreRunOutput<Action extends StoreAction> =
  Action extends StoreAction<StoreActionKind, unknown, infer Output, unknown>
    ? Output
    : never;

/** Backend action catalog returned by `store()`. */
export type Store<
  Name extends string,
  Actions extends StoreActionMap,
  Context,
> = {
  /** Stable catalog name, usually matching the backend domain area. */
  name: Name;
  /** Directly callable actions, preserving each action's input/output contract. */
  actions: Actions;
  /** Lists catalog metadata without exposing implementation functions. */
  listActions: () => StoreActionMetadata[];
  /** Reads one catalog entry by name. */
  getAction: <ActionName extends keyof Actions & string>(
    name: ActionName,
  ) => StoreActionMetadata;
  /** Returns a serializable catalog summary for tooling and agent workflows. */
  describe: () => StoreDescription;
  /** Executes an action by name, useful for generic tooling and route binders. */
  run: <ActionName extends keyof Actions & string>(
    name: ActionName,
    args: StoreRunArgs<Actions[ActionName], Context>,
  ) => Promise<StoreRunOutput<Actions[ActionName]>>;
};

/** Configuration accepted by `store()`. */
export type StoreConfig<
  Name extends string,
  Actions extends StoreActionMap,
  Context,
> = {
  /** Stable catalog name used in metadata and debug views. */
  name: Name;
  /** Named backend operations for this domain area. */
  actions: Actions;
  /** Context-only type anchor for callers that want to set `Context` explicitly. */
  ctx?: Context;
};

/** Defines a validated read-only backend action by convention. */
export function query<
  InputSchema extends z.ZodTypeAny | undefined = undefined,
  OutputSchema extends z.ZodTypeAny | undefined = undefined,
  Context = unknown,
>(
  config: Omit<
    StoreActionConfig<"query", InputSchema, OutputSchema, Context>,
    "kind"
  >,
): StoreAction<
  "query",
  StoreActionInput<InputSchema>,
  StoreActionOutput<OutputSchema>,
  Context
> {
  return defineAction({ ...config, kind: "query" });
}

/** Defines a backend action that writes app-owned state. */
export function mutation<
  InputSchema extends z.ZodTypeAny | undefined = undefined,
  OutputSchema extends z.ZodTypeAny | undefined = undefined,
  Context = unknown,
>(
  config: Omit<
    StoreActionConfig<"mutation", InputSchema, OutputSchema, Context>,
    "kind"
  >,
): StoreAction<
  "mutation",
  StoreActionInput<InputSchema>,
  StoreActionOutput<OutputSchema>,
  Context
> {
  return defineAction({ ...config, kind: "mutation" });
}

/** Defines a backend action that may perform workflow or external side effects. */
export function command<
  InputSchema extends z.ZodTypeAny | undefined = undefined,
  OutputSchema extends z.ZodTypeAny | undefined = undefined,
  Context = unknown,
>(
  config: Omit<
    StoreActionConfig<"command", InputSchema, OutputSchema, Context>,
    "kind"
  >,
): StoreAction<
  "command",
  StoreActionInput<InputSchema>,
  StoreActionOutput<OutputSchema>,
  Context
> {
  return defineAction({ ...config, kind: "command" });
}

/**
 * Creates a backend action catalog. Stores deliberately do not know about
 * HTTP, Drizzle, transactions, auth, or queues; those dependencies stay in the
 * `ctx` object supplied by the consuming app.
 */
export function store<
  Name extends string,
  Actions extends StoreActionMap,
  Context = InferStoreContext<Actions>,
>(config: StoreConfig<Name, Actions, Context>): Store<Name, Actions, Context> {
  const metadata = Object.entries(config.actions).map(([name, action]) =>
    getMetadata(name, action),
  );

  return {
    name: config.name,
    actions: config.actions,
    listActions: () => [...metadata],
    getAction: (name) => {
      const action = metadata.find((entry) => entry.name === name);

      if (!action) {
        throw new Error(
          `Unknown store action "${String(name)}" on store "${config.name}". ` +
            `Available actions: ${metadata.map((entry) => entry.name).join(", ") || "(none)"}.`,
        );
      }

      return action;
    },
    describe: () => ({
      name: config.name,
      actions: [...metadata],
    }),
    run: async (name, args) => {
      const action = config.actions[name];

      if (!action) {
        throw new Error(
          `Unknown store action "${String(name)}" on store "${config.name}". ` +
            `Available actions: ${metadata.map((entry) => entry.name).join(", ") || "(none)"}.`,
        );
      }

      return action.run(args as never) as Promise<
        StoreRunOutput<Actions[typeof name]>
      >;
    },
  };
}

/** Returns a serializable store summary for generic tooling and agents. */
export function describeStore(
  store: { describe: () => StoreDescription },
): StoreDescription {
  return store.describe();
}

/** Converts a config object into a runtime action with input/output validation. */
function defineAction<
  Kind extends StoreActionKind,
  InputSchema extends z.ZodTypeAny | undefined,
  OutputSchema extends z.ZodTypeAny | undefined,
  Context,
>(
  config: StoreActionConfig<Kind, InputSchema, OutputSchema, Context>,
): StoreAction<
  Kind,
  StoreActionInput<InputSchema>,
  StoreActionOutput<OutputSchema>,
  Context
> {
  return {
    kind: config.kind,
    description: config.description,
    inputSchema: config.input,
    outputSchema: config.output,
    run: async ({ ctx, input }) => {
      const parsedInput = parseOptional(
        config.input,
        input,
      ) as StoreActionInput<InputSchema>;
      const output = await config.run({ ctx, input: parsedInput });

      return parseOutput(config.output, output) as StoreActionOutput<OutputSchema>;
    },
  };
}

/** Parses optional action input, using `undefined` as the no-input sentinel. */
function parseOptional<Schema extends z.ZodTypeAny | undefined>(
  schema: Schema,
  value: StoreActionInput<Schema>,
): StoreActionInput<Schema> {
  if (!schema) {
    return undefined as StoreActionInput<Schema>;
  }

  return schema.parse(value) as StoreActionInput<Schema>;
}

/** Parses optional action output, preserving `void` for output-less actions. */
function parseOutput<Schema extends z.ZodTypeAny | undefined>(
  schema: Schema,
  value: StoreActionOutput<Schema>,
): StoreActionOutput<Schema> {
  if (!schema) {
    return undefined as StoreActionOutput<Schema>;
  }

  return schema.parse(value) as StoreActionOutput<Schema>;
}

/** Builds stable action catalog metadata without leaking implementation details. */
function getMetadata(name: string, action: StoreAction): StoreActionMetadata {
  return {
    name,
    kind: action.kind,
    hasInput: Boolean(action.inputSchema),
    hasOutput: Boolean(action.outputSchema),
    description: action.description,
  };
}

/** Infers the shared context type from a store's action map. */
type InferStoreContext<Actions extends StoreActionMap> = Actions[keyof Actions] extends
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StoreAction<StoreActionKind, any, any, infer Context>
  ? Context
  : unknown;
