export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Safely constructs the full path to the plugin's data directory. */
export function safeGetPluginFeedsReaderDir(pluginId: string, vaultBasePath: string): string {
  // Obsidian's configDir is usually vaultPath + '/.obsidian'
  // Plugins dir is configDir + '/' + pluginId // Corrected path join for pluginId
  return safePathJoin(vaultBasePath, ".obsidian", "plugins", pluginId);
}

/** Joins path segments, ensuring no double slashes and handling mixed slash types. */
export function safePathJoin(...segments: string[]): string {
  return segments.join('/').replace(/[/\\]+/g, '/');
}
