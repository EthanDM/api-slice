import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createHonoResourceRoutes, resource } from "../src/index.js";

const projects = resource({
  name: "projects",
  path: "/projects",
  schemas: {
    entity: z.object({ id: z.string(), name: z.string() }),
    createInput: z.object({ name: z.string().min(1) }),
  },
});

describe("Hono resource error handling", () => {
  it("serializes thrown errors as ApiError payloads", async () => {
    const app = createHonoResourceRoutes(projects, {
      list: () => [],
      detail: () => {
        throw new Error("Project lookup failed");
      },
      create: ({ input }) => ({ id: "project_1", name: input.name }),
      update: () => ({ id: "project_1", name: "Alpha" }),
      delete: () => undefined,
    });

    const response = await app.request("/project_1");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "UNKNOWN_ERROR",
      message: "Project lookup failed",
      status: 500,
    });
  });
});
