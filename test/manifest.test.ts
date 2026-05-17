import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createSliceManifest,
  query,
  resource,
  store,
} from "../src/index.js";

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
});

describe("createSliceManifest", () => {
  it("describes resources and stores without runtime implementations", () => {
    const projects = resource({
      name: "projects",
      path: "/projects",
      schemas: {
        entity: ProjectSchema,
        listInput: z.object({ search: z.string().optional() }),
      },
      actions: {
        archive: {
          method: "POST",
          path: "/:id/archive",
          output: ProjectSchema,
        },
      },
    });
    const projectStore = store({
      name: "projects",
      actions: {
        list: query({
          output: z.array(ProjectSchema),
          description: "Read visible projects",
          run: () => [],
        }),
      },
    });

    expect(
      createSliceManifest({
        resources: { projects },
        stores: { projectStore },
      }),
    ).toEqual({
      resources: [
        {
          name: "projects",
          path: "/projects",
          schemas: {
            entity: true,
            listInput: true,
            createInput: false,
            updateInput: false,
          },
          operations: [],
          actions: [
            {
              name: "archive",
              method: "POST",
              path: "/:id/archive",
              hasInput: false,
              hasOutput: true,
              hasInvalidation: false,
            },
          ],
        },
      ],
      stores: [
        {
          name: "projects",
          actions: [
            {
              name: "list",
              kind: "query",
              hasInput: false,
              hasOutput: true,
              description: "Read visible projects",
            },
          ],
        },
      ],
    });
  });
});
