import type { ResourceDescription } from "./resource.js";
import type { StoreDescription } from "./store.js";

/** Read-only catalog of Slice resource and store contracts. */
export type SliceManifest = {
  /** App-facing API resources described without runtime clients or schemas. */
  resources: ResourceDescription[];
  /** Backend action catalogs described without implementation functions. */
  stores: StoreDescription[];
};

type DescribableResource = {
  describe: () => ResourceDescription;
};

type DescribableStore = {
  describe: () => StoreDescription;
};

/** Input accepted by `createSliceManifest()`. */
export type SliceManifestConfig = {
  /** Named resources included in the manifest. Object keys are for caller organization only. */
  resources?: Record<string, DescribableResource>;
  /** Named stores included in the manifest. Object keys are for caller organization only. */
  stores?: Record<string, DescribableStore>;
};

/**
 * Creates a serializable manifest for docs, debug panels, support dumps, and
 * agent inspection. The manifest is intentionally read-only metadata; it does
 * not run actions, bind HTTP clients, mount routes, or hold request context.
 */
export function createSliceManifest(
  config: SliceManifestConfig,
): SliceManifest {
  return {
    resources: Object.values(config.resources ?? {}).map((resource) =>
      resource.describe(),
    ),
    stores: Object.values(config.stores ?? {}).map((store) =>
      store.describe(),
    ),
  };
}
