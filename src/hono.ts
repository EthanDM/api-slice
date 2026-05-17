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

export type HonoResourceHandlerContext<ListInput = unknown> = {
  context: Context;
  id?: Id;
  listInput?: ListInput;
};

export type HonoResourceHandlers<Entity, ListInput, CreateInput, UpdateInput> = {
  list: (
    args: HonoResourceHandlerContext<ListInput> & { input: ListInput },
  ) => Promise<Entity[]> | Entity[];
  detail: (
    args: HonoResourceHandlerContext<ListInput> & { id: Id },
  ) => Promise<Entity> | Entity;
  create: (
    args: HonoResourceHandlerContext<ListInput> & { input: CreateInput },
  ) => Promise<Entity> | Entity;
  update: (
    args: HonoResourceHandlerContext<ListInput> & {
      id: Id;
      input: UpdateInput;
    },
  ) => Promise<Entity> | Entity;
  delete: (
    args: HonoResourceHandlerContext<ListInput> & { id: Id },
  ) => Promise<void> | void;
};

export type HonoResourceActionHandlers<Actions extends RuntimeResourceActionMap> = {
  [Name in keyof Actions & string]: (
    args: HonoResourceHandlerContext & {
      action: Name;
      request: ResourceActionRequest<Actions[Name]>;
    },
  ) => Promise<ResourceActionOutput<Actions[Name]>> | ResourceActionOutput<Actions[Name]>;
};

export type HonoResourceRouteHandlers<
  Entity,
  ListInput,
  CreateInput,
  UpdateInput,
  Actions extends RuntimeResourceActionMap,
> = HonoResourceHandlers<Entity, ListInput, CreateInput, UpdateInput> & {
  actions?: Partial<HonoResourceActionHandlers<Actions>>;
  handleErrors?: boolean;
};

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
      input: requireInput(input, "create"),
    });

    return context.json(resource.schemas.entity.parse(output), 201);
  });

  app.patch("/:id", async (context) => {
    const id = context.req.param("id");
    const input = resource.schemas.updateInput?.parse(await readJson(context));
    const output = await handlers.update({
      context,
      id,
      input: requireInput(input, "update"),
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
        throw new Error(`Missing Hono handler for resource action: ${name}`);
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

function parseListInput<Entity, ListInput, CreateInput, UpdateInput>(
  resource: Resource<Entity, ListInput, CreateInput, UpdateInput>,
  context: Context,
): ListInput {
  if (!resource.schemas.listInput) {
    return undefined as ListInput;
  }

  return resource.schemas.listInput.parse(context.req.query());
}

async function readJson(context: Context): Promise<unknown> {
  const contentType = context.req.header("content-type");

  if (!contentType?.includes("application/json")) {
    return undefined;
  }

  return context.req.json();
}

function requireInput<Input>(
  input: Input | undefined,
  operation: "create" | "update",
): Input {
  if (input === undefined) {
    throw new Error(`Resource ${operation} route requires an input schema`);
  }

  return input;
}

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

function parseOptionalActionInput(
  action: RuntimeResourceAction,
  input: unknown,
): unknown {
  if (!action.input) {
    return undefined;
  }

  return action.input.parse(input);
}
