import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  clearResourceQueries,
  clearSliceQueries,
  getSliceQuerySnapshot,
  invalidateResource,
  invalidateResourceQueries,
} from "../src/react-query.js";
import {
  resource,
} from "../src/index.js";

describe("invalidateResourceQueries", () => {
  it("invalidates each query key", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await invalidateResourceQueries(queryClient, [
      ["projects"],
      ["projects", "detail", "project_1"],
    ]);

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["projects"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["projects", "detail", "project_1"],
    });
  });
});

describe("React Query state helpers", () => {
  const projects = resource({
    name: "projects",
    path: "/projects",
    schemas: {
      entity: z.object({ id: z.string() }),
    },
  });
  const tasks = resource({
    name: "tasks",
    path: "/tasks",
    schemas: {
      entity: z.object({ id: z.string() }),
    },
  });

  it("invalidates and clears resource-scoped queries", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    queryClient.setQueryData(projects.keys.all, [{ id: "project_1" }]);
    queryClient.setQueryData(tasks.keys.all, [{ id: "task_1" }]);

    await invalidateResource(queryClient, projects);
    clearResourceQueries(queryClient, projects);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: projects.keys.all,
    });
    expect(queryClient.getQueryData(projects.keys.all)).toBeUndefined();
    expect(queryClient.getQueryData(tasks.keys.all)).toEqual([{ id: "task_1" }]);
  });

  it("clears multiple Slice resources", () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(projects.keys.all, [{ id: "project_1" }]);
    queryClient.setQueryData(tasks.keys.all, [{ id: "task_1" }]);

    clearSliceQueries(queryClient, [projects, tasks]);

    expect(queryClient.getQueryData(projects.keys.all)).toBeUndefined();
    expect(queryClient.getQueryData(tasks.keys.all)).toBeUndefined();
  });

  it("returns a data-free query state snapshot", () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(projects.keys.detail("project_1"), {
      id: "project_1",
      secret: "not-in-snapshot",
    });
    queryClient.setQueryData(["unrelated"], { id: "other" });

    expect(getSliceQuerySnapshot(queryClient, [projects])).toMatchObject({
      resources: ["projects"],
      queries: [
        {
          queryKey: ["projects", "detail", "project_1"],
          resource: "projects",
          status: "success",
          fetchStatus: "idle",
          isInvalidated: false,
        },
      ],
    });
  });
});
