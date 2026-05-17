import type { z } from "zod";

import type {
  Id,
  ResourceActionMap,
  ResourceOperationArgs,
  ResourceOperationConfig,
  RuntimeResourceAction,
} from "./resource-types.js";

export function getAction<
  Actions extends ResourceActionMap,
  Name extends keyof Actions & string,
>(actions: Actions | undefined, name: Name): Actions[Name] {
  const action = actions?.[name];

  if (!action) {
    throw new Error(`Unknown resource action: ${name}`);
  }

  return action;
}

export function buildActionPath(
  basePath: string,
  action: RuntimeResourceAction,
  args: ResourceOperationArgs,
): string {
  return buildOperationPath(`${basePath}${action.path}`, {
    ...args,
    params: action.params,
  });
}

export function buildOperationPath<Input>(
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

export function parseOperationOutput<Output>(
  operation: ResourceOperationConfig<any, Output> | undefined,
  defaultSchema: z.ZodType<Output>,
  output: unknown,
): Output {
  const parsed = operation?.response
    ? operation.response.parse(output)
    : defaultSchema.parse(output);

  return operation?.select ? operation.select(parsed) : parsed;
}

export function parseOptional<Schema extends z.ZodTypeAny | undefined>(
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

export function parseRequired<Schema extends z.ZodTypeAny | undefined>(
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
