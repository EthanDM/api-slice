import { z } from "zod";

import { createFetchHttpClient } from "@ethandm/slice/fetch";
import { resource } from "@ethandm/slice";

const RawContactSchema = z.object({
  person_id: z.string(),
  first_name: z.string(),
});

const ContactSchema = z.object({
  id: z.string(),
  firstName: z.string(),
});

const RawListResponseSchema = z.object({
  payload: z.object({
    items: z.array(RawContactSchema),
  }),
});

const toContact = (raw: z.output<typeof RawContactSchema>) => ({
  id: raw.person_id,
  firstName: raw.first_name,
});

export const contacts = resource({
  name: "contacts",
  path: "/people",
  schemas: {
    entity: ContactSchema,
    listInput: z.object({
      search: z.string().optional(),
      page: z.number().optional(),
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
      response: RawListResponseSchema,
      select: (response) =>
        RawListResponseSchema.parse(response).payload.items.map(toContact),
    },
    update: {
      method: "PUT",
      path: "/v2/person-update/:person_uuid",
      params: ({ id }) => ({ person_uuid: id ?? "" }),
      body: ({ input }) => ({ first_name: input?.firstName }),
    },
  },
});

const client = contacts.client(
  createFetchHttpClient({ baseUrl: "https://legacy.example.com" }),
);

await client.list({ search: "ethan", page: 1 });
