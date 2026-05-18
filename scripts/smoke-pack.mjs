import { execFile } from "node:child_process";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = process.cwd();
let tarballPath;
let tempDir;

try {
  const { stdout } = await exec("npm", ["pack", "--json"], { cwd: root });
  const [pack] = JSON.parse(stdout);

  if (!pack?.filename) {
    throw new Error(`npm pack did not return a tarball filename: ${stdout}`);
  }

  tarballPath = resolve(root, pack.filename);
  tempDir = await mkdtemp(join(tmpdir(), "api-slice-smoke-"));

  await writeFile(
    join(tempDir, "package.json"),
    JSON.stringify({ type: "module", private: true }, null, 2),
  );
  await exec(
    "npm",
    [
      "install",
      "--ignore-scripts",
      tarballPath,
      "zod",
      "hono",
      "react",
      "@tanstack/react-query",
    ],
    { cwd: tempDir },
  );
  await writeFile(
    join(tempDir, "smoke.mjs"),
    `
      import { createSliceClient, createSliceManifest, resource, store } from "@ethandm/api-slice";
      import { createFetchHttpClient } from "@ethandm/api-slice/fetch";
      import { createHonoResourceRoutes } from "@ethandm/api-slice/hono";
      import {
        createResourceHooks,
        createResourceQueryOptions,
        createSliceHooks,
        createSliceQueryOptions,
      } from "@ethandm/api-slice/react-query";
      import { createSliceRecorder } from "@ethandm/api-slice/recorder";
      import { z } from "zod";

      const ProjectSchema = z.object({ id: z.string() });
      const projects = resource({
        name: "projects",
        path: "/projects",
        schemas: { entity: ProjectSchema },
      });
      const http = async () => [{ id: "project_1" }];
      const clients = createSliceClient({ http, resources: { projects } });
      const queries = createSliceQueryOptions({ resources: { projects }, clients });
      const hooks = createSliceHooks({ resources: { projects }, clients });
      const projectQueries = createResourceQueryOptions(projects, clients.projects);
      const manifest = createSliceManifest({ resources: { projects } });

      if (!createFetchHttpClient || !createHonoResourceRoutes || !createResourceHooks || !createSliceRecorder || !store) {
        throw new Error("Expected all package entrypoints to import.");
      }
      if (!hooks.projects || !queries.projects || projectQueries.detail("project_1").queryKey[0] !== "projects" || manifest.resources[0]?.name !== "projects") {
        throw new Error("Expected package helpers to execute.");
      }
    `,
  );
  await exec("node", ["smoke.mjs"], { cwd: tempDir });
} finally {
  if (tarballPath) {
    await unlink(tarballPath).catch(() => undefined);
  }

  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
}
