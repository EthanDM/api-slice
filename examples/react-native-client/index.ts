import { z } from "zod";

import {
  createFetchHttpClient,
  createSliceRecorder,
  getSliceSnapshot,
  resource,
} from "@ethandm/slice";

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const projects = resource({
  name: "projects",
  path: "/projects",
  schemas: {
    entity: ProjectSchema,
    listInput: z.object({ search: z.string().optional() }),
  },
});

const recorder = createSliceRecorder({ maxEvents: 100 });

const http = createFetchHttpClient({
  baseUrl: "https://api.example.com",
  headers: async () => ({
    authorization: `Bearer ${await getToken()}`,
  }),
  auth: {
    onUnauthorized: async () => {
      await clearToken();
      resetToLogin();
    },
  },
  recorder,
  recorderRedact: (event) => ({
    ...event,
    request: {
      ...event.request,
      body: "[redacted]",
    },
  }),
});

export const projectClient = projects.client(http);

export function getApiDebugSnapshot() {
  return getSliceSnapshot({
    resources: [projects],
    recorder,
  });
}

async function getToken(): Promise<string> {
  return "token";
}

async function clearToken(): Promise<void> {
  return undefined;
}

function resetToLogin(): void {
  return undefined;
}
