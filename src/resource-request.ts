/**
 * Request-building primitives shared by resource clients. These helpers are
 * intentionally framework-free so fetch, React Query, and future adapters all
 * agree on path interpolation and schema parsing behavior.
 */
import type { z } from "zod";

import type {
  Id,
  ResourceActionMap,
  ResourceOperationArgs,
  ResourceOperationConfig,
  RuntimeResourceAction,
} from "./resource-types.js";

/**
 * Resolves a named custom action at runtime.
 *
 * @throws When callers reference an action that was not declared on the resource.
 */
export function getAction<
  Actions extends ResourceActionMap,
  Name extends keyof Actions & string,
>(
  actions: Actions | undefined,
  name: Name,
  resourceName?: string,
): Actions[Name] {
  const action = actions?.[name];

  if (!action) {
    const available = Object.keys(actions ?? {}).join(", ") || "(none)";

    throw new Error(
      resourceName
        ? `Unknown resource action "${name}" on resource "${resourceName}". Available actions: ${available}.`
        : `Unknown resource action "${name}". Available actions: ${available}.`,
    );
  }

  return action;
}

/**
 * Builds the final custom-action request path by combining the resource base
 * path with the action path and applying the same parameter rules as CRUD
 * operation paths.
 */
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

/**
 * Replaces `:param` path tokens with encoded values. `id` is available by
 * default, and operation/action `params` can introduce backend-specific names
 * such as `personId` or `person_uuid`.
 *
 * @throws When the final path still contains an unresolved `:param` token.
 */
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

/**
 * Parses raw transport output and optionally selects the app-facing value from
 * a backend envelope. Without an operation-level response schema, the normal
 * resource entity schema remains the output contract.
 */
export function parseOperationOutput<Output>(
  operation: ResourceOperationConfig<any, Output> | undefined,
  defaultSchema: z.ZodType<Output>,
  output: unknown,
): Output {
  const parsed = operation?.response
    ? operation.response.parse(output)
    : defaultSchema.parse(output);

  return (operation?.select ? operation.select(parsed) : parsed) as Output;
}

/** Parses optional input schemas while preserving `undefined` as "no input". */
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

/**
 * Parses required operation input.
 *
 * @throws When an operation that needs input was configured without a schema.
 */
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
