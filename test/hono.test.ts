import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createHonoResourceRoutes, resource } from "../src/index.js";

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const projects = resource({
  name: "projects",
  path: "/projects",
  schemas: {
    entity: ProjectSchema,
    listInput: z.object({ search: z.string().optional() }),
    createInput: z.object({ name: z.string().min(1) }),
    updateInput: z.object({ name: z.string().min(1).optional() }),
  },
  actions: {
    archive: {
      method: "POST",
      path: "/:id/archive",
      input: z.object({ reason: z.string().optional() }),
      output: ProjectSchema,
    },
    recalculate: {
      method: "POST",
      path: "/:id/recalculate",
    },
  },
});

describe("createHonoResourceRoutes", () => {
  it("routes list and detail requests through typed handlers", async () => {
    const list = vi.fn(({ input }) => [{ id: "project_1", name: input.search }]);
    const detail = vi.fn(({ id }) => ({ id, name: "Alpha" }));
    const app = createHonoResourceRoutes(projects, {
      list,
      detail,
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    });

    const listResponse = await app.request("/?search=Alpha");
    const detailResponse = await app.request("/project_1");

    await expect(listResponse.json()).resolves.toEqual([
      { id: "project_1", name: "Alpha" },
    ]);
    await expect(detailResponse.json()).resolves.toEqual({
      id: "project_1",
      name: "Alpha",
    });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ input: { search: "Alpha" } }),
    );
    expect(detail).toHaveBeenCalledWith(
      expect.objectContaining({ id: "project_1" }),
    );
  });

  it("validates create input and output", async () => {
    const create = vi.fn(({ input }) => ({ id: "project_1", name: input.name }));
    const app = createHonoResourceRoutes(projects, {
      list: vi.fn(),
      detail: vi.fn(),
      create,
      update: vi.fn(),
      delete: vi.fn(),
    });

    const response = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Alpha" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "project_1",
      name: "Alpha",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ input: { name: "Alpha" } }),
    );
  });

  it("uses a 204 response for delete", async () => {
    const deleteHandler = vi.fn();
    const app = createHonoResourceRoutes(projects, {
      list: vi.fn(),
      detail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: deleteHandler,
    });

    const response = await app.request("/project_1", { method: "DELETE" });

    expect(response.status).toBe(204);
    expect(deleteHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: "project_1" }),
    );
  });

  it("routes custom actions through named handlers", async () => {
    const archive = vi.fn(({ request }) => ({
      id: request.id,
      name: request.input.reason,
    }));
    const app = createHonoResourceRoutes(projects, {
      list: vi.fn(),
      detail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      actions: {
        archive,
      },
    });

    const response = await app.request("/project_1/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Archived" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "project_1",
      name: "Archived",
    });
    expect(archive).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "archive",
        request: { id: "project_1", input: { reason: "Archived" } },
      }),
    );
  });

  it("returns 204 for custom actions without output schemas", async () => {
    const recalculate = vi.fn();
    const app = createHonoResourceRoutes(projects, {
      list: vi.fn(),
      detail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      actions: {
        recalculate,
      },
    });

    const response = await app.request("/project_1/recalculate", {
      method: "POST",
    });

    expect(response.status).toBe(204);
    expect(recalculate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "recalculate",
        request: { id: "project_1", input: undefined },
      }),
    );
  });

  it("returns actionable errors when a custom action handler is missing", async () => {
    const app = createHonoResourceRoutes(projects, {
      list: vi.fn(),
      detail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    });

    const response = await app.request("/project_1/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Archived" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      message:
        'Missing Hono handler for resource action "archive" on resource "projects". Add handlers.actions.archive to createHonoResourceRoutes(projects, ...).',
    });
  });
});
