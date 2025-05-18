/**
 * Cross-layer path helpers.  Placed outside the *view* hierarchy so that
 * services (NetworkService, AssetService, …) can import them without
 * depending on UI code.  Keep **all** generic filesystem helpers here to
 * avoid circular dependencies.
 */

/** Safely constructs the absolute path to the plugin's data directory. */
export function safeGetPluginFeedsReaderDir(
  pluginId: string,
  vaultBasePath: string,
): string {
  // In Obsidian the configDir lives at `${vault}/.obsidian`.
  // Plugins reside in `${configDir}/plugins/${pluginId}`.
  return safePathJoin(vaultBasePath, ".obsidian", "plugins", pluginId);
}

/** Joins path segments, normalising duplicates and mixed slashes. */
export function safePathJoin(...segments: string[]): string {
  return segments.join("/").replace(/[\\/]+/g, "/");
}
