import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { command, mutation, query, store } from "../src/index.js";

type TestContext = {
  db: {
    projects: Map<string, { id: string; name: string }>;
  };
  user: { id: string };
};

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const CreateProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

describe("store", () => {
  it("runs typed query, mutation, and command actions", async () => {
    const ctx: TestContext = {
      db: {
        projects: new Map([["project_1", { id: "project_1", name: "Alpha" }]]),
      },
      user: { id: "user_1" },
    };
    const projectStore = store({
      name: "projects",
      actions: {
        detail: query({
          input: z.object({ id: z.string() }),
          output: ProjectSchema,
          run: async ({ ctx, input }: { ctx: TestContext; input: { id: string } }) => {
            const project = ctx.db.projects.get(input.id);

            if (!project) {
              throw new Error("Project not found");
            }

            return project;
          },
        }),
        create: mutation({
          input: CreateProjectSchema,
          output: ProjectSchema,
          run: ({ ctx, input }: { ctx: TestContext; input: z.output<typeof CreateProjectSchema> }) => {
            ctx.db.projects.set(input.id, input);

            return input;
          },
        }),
        sendDigest: command({
          output: z.object({ sentBy: z.string() }),
          run: ({ ctx }: { ctx: TestContext; input: undefined }) => ({
            sentBy: ctx.user.id,
          }),
        }),
      },
    });

    await expect(
      projectStore.actions.detail.run({ ctx, input: { id: "project_1" } }),
    ).resolves.toEqual({ id: "project_1", name: "Alpha" });
    await expect(
      projectStore.actions.create.run({
        ctx,
        input: { id: "project_2", name: "Beta" },
      }),
    ).resolves.toEqual({ id: "project_2", name: "Beta" });
    await expect(
      projectStore.run("sendDigest", { ctx, input: undefined }),
    ).resolves.toEqual({ sentBy: "user_1" });
  });

  it("validates input before running the action", async () => {
    const run = vi.fn();
    const projectStore = store({
      name: "projects",
      actions: {
        create: mutation({
          input: CreateProjectSchema,
          output: ProjectSchema,
          run,
        }),
      },
    });

    await expect(
      projectStore.actions.create.run({
        ctx: {},
        input: { id: "project_1", name: "" },
      }),
    ).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it("validates output after running the action", async () => {
    const projectStore = store({
      name: "projects",
      actions: {
        detail: query({
          input: z.object({ id: z.string() }),
          output: ProjectSchema,
          run: () => ({ id: "project_1" }) as never,
        }),
      },
    });

    await expect(
      projectStore.actions.detail.run({ ctx: {}, input: { id: "project_1" } }),
    ).rejects.toThrow();
  });

  it("lists action metadata without exposing action implementations", () => {
    const projectStore = store({
      name: "projects",
      actions: {
        list: query({
          output: z.array(ProjectSchema),
          description: "Read visible projects",
          run: () => [],
        }),
        create: mutation({
          input: CreateProjectSchema,
          output: ProjectSchema,
          run: ({ input }) => input,
        }),
        sync: command({
          run: () => undefined,
        }),
      },
    });

    expect(projectStore.listActions()).toEqual([
      {
        name: "list",
        kind: "query",
        hasInput: false,
        hasOutput: true,
        description: "Read visible projects",
      },
      {
        name: "create",
        kind: "mutation",
        hasInput: true,
        hasOutput: true,
        description: undefined,
      },
      {
        name: "sync",
        kind: "command",
        hasInput: false,
        hasOutput: false,
        description: undefined,
      },
    ]);
    expect(projectStore.getAction("create")).toMatchObject({
      name: "create",
      kind: "mutation",
    });
  });

  it("throws for unknown generic action names", async () => {
    const projectStore = store({
      name: "projects",
      actions: {
        list: query({
          output: z.array(ProjectSchema),
          run: () => [],
        }),
      },
    });

    await expect(
      projectStore.run("missing" as "list", { ctx: {}, input: undefined }),
    ).rejects.toThrow("Unknown store action: missing");
  });
});
