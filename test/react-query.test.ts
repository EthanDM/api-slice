import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateResourceQueries } from "../src/index.js";

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
