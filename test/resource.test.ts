import { describe, expect, it } from "vitest";
import { z } from "zod";

import { resource, type HttpClient } from "../src/index.js";

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const ProjectListInputSchema = z.object({
  search: z.string().optional(),
});

const CreateProjectSchema = z.object({
  name: z.string().min(1),
});

const UpdateProjectSchema = CreateProjectSchema.partial();
const ArchiveProjectSchema = z.object({
  reason: z.string().optional(),
});

describe("resource", () => {
  const projects = resource({
    name: "projects",
    path: "/projects",
    schemas: {
      entity: ProjectSchema,
      listInput: ProjectListInputSchema,
      createInput: CreateProjectSchema,
      updateInput: UpdateProjectSchema,
    },
  });

  const projectsWithActions = resource({
    name: "projects",
    path: "/projects",
    schemas: {
      entity: ProjectSchema,
      listInput: ProjectListInputSchema,
      createInput: CreateProjectSchema,
      updateInput: UpdateProjectSchema,
    },
    actions: {
      archive: {
        method: "POST",
        path: "/:id/archive",
        input: ArchiveProjectSchema,
        output: ProjectSchema,
      },
      stats: {
        method: "GET",
        path: "/stats",
        output: z.object({ count: z.number() }),
        invalidates: [],
      },
    },
  });

  it("creates stable query keys", () => {
    expect(projects.keys.all).toEqual(["projects"]);
    expect(projects.keys.list({ search: "alpha" })).toEqual([
      "projects",
      "list",
      { search: "alpha" },
    ]);
    expect(projects.keys.detail("project_1")).toEqual([
      "projects",
      "detail",
      "project_1",
    ]);
  });

  it("declares default mutation invalidation targets", () => {
    expect(projects.invalidates.create()).toEqual([
      ["projects"],
      ["projects", "list", undefined],
    ]);
    expect(projects.invalidates.update("project_1")).toEqual([
      ["projects", "detail", "project_1"],
      ["projects", "list", undefined],
      ["projects"],
    ]);
  });

  it("builds CRUD client requests", async () => {
    const requests: Parameters<HttpClient>[0][] = [];
    const http: HttpClient = async <Output>(request: Parameters<HttpClient>[0]) => {
      requests.push(request);
      const output =
        request.method === "GET" && request.path === "/projects"
          ? [{ id: "project_1", name: "Alpha" }]
          : { id: "project_1", name: "Alpha" };

      return output as Output;
    };

    const client = projects.client(http);

    await client.list({ search: "alpha" });
    await client.detail("project 1");
    await client.create({ name: "Alpha" });
    await client.update("project_1", { name: "Beta" });
    await client.delete("project_1");

    expect(requests).toEqual([
      {
        method: "GET",
        path: "/projects",
        query: { search: "alpha" },
      },
      {
        method: "GET",
        path: "/projects/project%201",
      },
      {
        method: "POST",
        path: "/projects",
        body: { name: "Alpha" },
      },
      {
        method: "PATCH",
        path: "/projects/project_1",
        body: { name: "Beta" },
      },
      {
        method: "DELETE",
        path: "/projects/project_1",
      },
    ]);
  });

  it("validates input before sending requests", async () => {
    const client = projects.client(async () => {
      throw new Error("Should not request");
    });

    await expect(client.create({ name: "" })).rejects.toThrow();
  });

  it("validates entity responses", async () => {
    const client = projects.client(
      async <Output>() => ({ id: "project_1" }) as Output,
    );

    await expect(client.detail("project_1")).rejects.toThrow();
  });

  it("builds custom action client requests", async () => {
    const requests: Parameters<HttpClient>[0][] = [];
    const client = projectsWithActions.client(
      async <Output>(request: Parameters<HttpClient>[0]) => {
        requests.push(request);

        return { id: "project_1", name: "Alpha" } as Output;
      },
    );

    await client.action("archive", {
      id: "project_1",
      input: { reason: "Done" },
    });

    expect(requests).toEqual([
      {
        method: "POST",
        path: "/projects/project_1/archive",
        body: { reason: "Done" },
      },
    ]);
  });

  it("supports GET custom action query input and invalidation metadata", async () => {
    const client = projectsWithActions.client(
      async <Output>(request: Parameters<HttpClient>[0]) =>
        ({ count: request.query ? 1 : 0 }) as Output,
    );

    await expect(client.action("stats", {})).resolves.toEqual({ count: 0 });
    expect(projectsWithActions.invalidates.action("archive")).toEqual([
      ["projects"],
    ]);
    expect(projectsWithActions.invalidates.action("stats")).toEqual([]);
  });

  it("supports inconsistent backend operation mappings", async () => {
    const RawPersonSchema = z.object({
      person_id: z.string(),
      first_name: z.string(),
    });
    const LegacyListResponseSchema = z.object({
      success: z.boolean(),
      payload: z.object({
        items: z.array(RawPersonSchema),
      }),
    });
    const LegacyDetailResponseSchema = z.object({
      data: RawPersonSchema,
    });
    const ContactSchema = z.object({
      id: z.string(),
      firstName: z.string(),
    });
    const normalizeContact = (raw: z.output<typeof RawPersonSchema>) => ({
      id: raw.person_id,
      firstName: raw.first_name,
    });
    const contacts = resource({
      name: "contacts",
      path: "/people",
      schemas: {
        entity: ContactSchema,
        listInput: z.object({
          search: z.string().optional(),
          page: z.number().optional(),
        }),
        createInput: z.object({
          firstName: z.string(),
        }),
        updateInput: z.object({
          firstName: z.string().optional(),
        }),
      },
      operations: {
        list: {
          path: "/v3/person-search",
          query: ({ input }) => ({
            q: input?.search,
            "page[number]": input?.page,
          }),
          response: LegacyListResponseSchema,
          select: (response) =>
            LegacyListResponseSchema.parse(response).payload.items.map(
              normalizeContact,
            ),
        },
        detail: {
          path: "/legacy/people/:personId",
          params: ({ id }) => ({ personId: id ?? "" }),
          response: LegacyDetailResponseSchema,
          select: (response) =>
            normalizeContact(LegacyDetailResponseSchema.parse(response).data),
        },
        create: {
          method: "POST",
          path: "/people/create-new",
          body: ({ input }) => ({
            first_name: input?.firstName,
          }),
          response: LegacyDetailResponseSchema,
          select: (response) =>
            normalizeContact(LegacyDetailResponseSchema.parse(response).data),
        },
        update: {
          method: "PUT",
          path: "/v2/person-update/:person_uuid",
          params: ({ id }) => ({ person_uuid: id ?? "" }),
          body: ({ input }) => ({
            first_name: input?.firstName,
          }),
          response: LegacyDetailResponseSchema,
          select: (response) =>
            normalizeContact(LegacyDetailResponseSchema.parse(response).data),
        },
        delete: {
          method: "POST",
          path: "/people/remove",
          query: ({ id }) => ({ person_id: id }),
        },
      },
    });
    const requests: Parameters<HttpClient>[0][] = [];
    const client = contacts.client(
      async <Output>(request: Parameters<HttpClient>[0]) => {
        requests.push(request);

        if (request.path === "/v3/person-search") {
          return {
            success: true,
            payload: {
              items: [{ person_id: "person_1", first_name: "Ethan" }],
            },
          } as Output;
        }

        if (request.method === "POST" && request.path === "/people/remove") {
          return undefined as Output;
        }

        return {
          data: { person_id: "person_1", first_name: "Ethan" },
        } as Output;
      },
    );

    await expect(client.list({ search: "ethan", page: 2 })).resolves.toEqual([
      { id: "person_1", firstName: "Ethan" },
    ]);
    await expect(client.detail("person 1")).resolves.toEqual({
      id: "person_1",
      firstName: "Ethan",
    });
    await client.create({ firstName: "Ethan" });
    await client.update("person_1", { firstName: "Ethan" });
    await client.delete("person_1");

    expect(requests).toEqual([
      {
        method: "GET",
        path: "/v3/person-search",
        query: { q: "ethan", "page[number]": 2 },
      },
      {
        method: "GET",
        path: "/legacy/people/person%201",
      },
      {
        method: "POST",
        path: "/people/create-new",
        query: undefined,
        body: { first_name: "Ethan" },
      },
      {
        method: "PUT",
        path: "/v2/person-update/person_1",
        query: undefined,
        body: { first_name: "Ethan" },
      },
      {
        method: "POST",
        path: "/people/remove",
        query: { person_id: "person_1" },
        body: undefined,
      },
    ]);
  });
});
