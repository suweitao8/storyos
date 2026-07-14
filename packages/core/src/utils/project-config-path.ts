import { access } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const CONFIG_FILE = "storyos.json";
const LEGACY_CONFIG_FILE = "inkos.json";

/**
 * Returns the effective project config file path. Prefers `storyos.json` but
 * falls back to the legacy `inkos.json` so existing projects keep working
 * after the brand rename.
 */
export async function resolveProjectConfigPath(projectRoot: string): Promise<string> {
  const newPath = join(projectRoot, CONFIG_FILE);
  try {
    await access(newPath);
    return newPath;
  } catch {
    return join(projectRoot, LEGACY_CONFIG_FILE);
  }
}

/** Synchronous variant for code paths that can't await. */
export function resolveProjectConfigPathSync(projectRoot: string): string {
  const newPath = join(projectRoot, CONFIG_FILE);
  if (existsSync(newPath)) return newPath;
  return join(projectRoot, LEGACY_CONFIG_FILE);
}
