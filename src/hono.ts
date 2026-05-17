/**
 * Hono adapter for resources whose server routes follow Slice's conventional
 * CRUD/action shape. Business logic stays in handlers; this module owns the
 * HTTP binding around those handlers.
 */
import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { toApiErrorPayload } from "./errors.js";
import type {
  Id,
  Resource,
  ResourceActionOutput,
  ResourceActionRequest,
  RuntimeResourceAction,
  RuntimeResourceActionMap,
} from "./resource.js";

/** Context passed to Hono resource handlers after Slice has parsed route input. */
export type HonoResourceHandlerContext<ListInput = unknown> = {
  /** Original Hono context for auth/session state or response escape hatches. */
  context: Context;
  /** Path id for detail/update/delete and id-based action handlers. */
  id?: Id;
  /** Reserved for future list metadata; list handlers currently receive `input`. */
  listInput?: ListInput;
};

/**
 * CRUD handlers for Hono routes generated from a resource. Handlers own business
 * logic; Slice owns request parsing, output validation, and default status codes.
 */
export type HonoResourceHandlers<Entity, ListInput, CreateInput, UpdateInput> = {
  /** Handles collection reads after query params are parsed as list input. */
  list: (
    args: HonoResourceHandlerContext<ListInput> & { input: ListInput },
  ) => Promise<Entity[]> | Entity[];
  /** Handles entity reads using the `:id` path parameter. */
  detail: (
    args: HonoResourceHandlerContext<ListInput> & { id: Id },
  ) => Promise<Entity> | Entity;
  /** Handles creation after the request body is parsed as create input. */
  create: (
    args: HonoResourceHandlerContext<ListInput> & { input: CreateInput },
  ) => Promise<Entity> | Entity;
  /** Handles updates after `:id` and update input have been parsed. */
  update: (
    args: HonoResourceHandlerContext<ListInput> & {
      id: Id;
      input: UpdateInput;
    },
  ) => Promise<Entity> | Entity;
  /** Handles deletion and should return no response body. */
  delete: (
    args: HonoResourceHandlerContext<ListInput> & { id: Id },
  ) => Promise<void> | void;
};

/** Custom action handlers keyed by the resource action name. */
export type HonoResourceActionHandlers<Actions extends RuntimeResourceActionMap> = {
  [Name in keyof Actions & string]: (
    args: HonoResourceHandlerContext & {
      action: Name;
      request: ResourceActionRequest<Actions[Name]>;
    },
  ) => Promise<ResourceActionOutput<Actions[Name]>> | ResourceActionOutput<Actions[Name]>;
};

/** Full handler map accepted by the Hono adapter, including optional error ownership. */
export type HonoResourceRouteHandlers<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap,
> = HonoResourceHandlers<Entity, ListInput, CreateInput, UpdateInput> & {
  /** Optional handlers for custom resource actions; missing declared actions throw at runtime. */
  actions?: Partial<HonoResourceActionHandlers<Actions>>;
  /** Disable only when a parent Hono app already serializes errors consistently. */
  handleErrors?: boolean;
};

/**
 * Builds conventional CRUD and custom action routes for a resource. This is
 * meant for APIs you control; client-side `operations` remain the escape hatch
 * for consuming inconsistent external backends.
 *
 * @throws When a request body fails validation, a handler returns invalid data,
 * or a declared action is missing a handler.
 */
export function createHonoResourceRoutes<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap = {},
>(
  resource: Resource<Entity, ListInput, CreateInput, UpdateInput, Actions>,
  handlers: HonoResourceRouteHandlers<
    Entity,
    ListInput,
    CreateInput,
    UpdateInput,
    Actions
  >,
): Hono {
  const app = new Hono();

  if (handlers.handleErrors ?? true) {
    app.onError((error, context) => {
      const payload = toApiErrorPayload(error);

      return context.json(payload, payload.status as ContentfulStatusCode);
    });
  }

  app.get("/", async (context) => {
    const input = parseListInput(resource, context);
    const output = await handlers.list({ context, input });

    return context.json(resource.schemas.entity.array().parse(output));
  });

  app.get("/:id", async (context) => {
    const id = context.req.param("id");
    const output = await handlers.detail({ context, id });

    return context.json(resource.schemas.entity.parse(output));
  });

  app.post("/", async (context) => {
    const input = resource.schemas.createInput?.parse(await readJson(context));
    const output = await handlers.create({
      context,
      input: requireInput(resource.name, input, "create"),
    });

    return context.json(resource.schemas.entity.parse(output), 201);
  });

  app.patch("/:id", async (context) => {
    const id = context.req.param("id");
    const input = resource.schemas.updateInput?.parse(await readJson(context));
    const output = await handlers.update({
      context,
      id,
      input: requireInput(resource.name, input, "update"),
    });

    return context.json(resource.schemas.entity.parse(output));
  });

  app.delete("/:id", async (context) => {
    const id = context.req.param("id");

    await handlers.delete({ context, id });

    return context.body(null, 204);
  });

  for (const name of Object.keys(resource.actions) as (keyof Actions & string)[]) {
    const action = resource.actions[name];

    app.on(action.method, action.path, async (context) => {
      const handler = handlers.actions?.[name];

      if (!handler) {
        throw new Error(
          `Missing Hono handler for resource action "${name}" on resource "${resource.name}". ` +
            `Add handlers.actions.${name} to createHonoResourceRoutes(${resource.name}, ...).`,
        );
      }

      const request = await parseActionRequest(action, context);
      const output = await handler({
        context,
        action: name,
        request: request as ResourceActionRequest<Actions[typeof name]>,
      });

      if (!action.output) {
        return context.body(null, 204);
      }

      return context.json(action.output.parse(output));
    });
  }

  return app;
}

/** Parses list filters from query params, or returns undefined for unfiltered lists. */
function parseListInput<Entity, ListInput, CreateInput, UpdateInput>(
  resource: Resource<Entity, ListInput, CreateInput, UpdateInput>,
  context: Context,
): ListInput {
  if (!resource.schemas.listInput) {
    return undefined as ListInput;
  }

  return resource.schemas.listInput.parse(context.req.query());
}

/** Reads JSON only when the request advertises a JSON content type. */
async function readJson(context: Context): Promise<unknown> {
  const contentType = context.req.header("content-type");

  if (!contentType?.includes("application/json")) {
    return undefined;
  }

  return context.req.json();
}

/**
 * Enforces that mutating CRUD routes have schemas before handlers run.
 *
 * @throws When create/update routes are used without their input schema.
 */
function requireInput<Input>(
  resourceName: string,
  input: Input | undefined,
  operation: "create" | "update",
): Input {
  if (input === undefined) {
    throw new Error(
      `Resource "${resourceName}" ${operation} route requires an input schema. ` +
        `Add schemas.${operation}Input to resource({ name: "${resourceName}", ... }).`,
    );
  }

  return input;
}

/** Parses a custom action request from path params plus query/body input. */
async function parseActionRequest(
  action: RuntimeResourceAction,
  context: Context,
): Promise<ResourceActionRequest<RuntimeResourceAction>> {
  const id = context.req.param("id");
  const rawInput =
    action.method === "GET" ? context.req.query() : await readJson(context);

  return {
    id: id || undefined,
    input: parseOptionalActionInput(action, rawInput),
  } as ResourceActionRequest<RuntimeResourceAction>;
}

/** Preserves undefined for actions without input schemas. */
function parseOptionalActionInput(
  action: RuntimeResourceAction,
  input: unknown,
): unknown {
  if (!action.input) {
    return undefined;
  }

  return action.input.parse(input);
}
