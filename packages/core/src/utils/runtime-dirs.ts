import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * After the InkOS → StoryOS rename, runtime data moved from `.inkos/` to `.storyos/`.
 * These helpers resolve the effective project-level sub-directory: if the new
 * `.storyos/` directory exists it wins, otherwise we transparently fall back to the
 * legacy `.inkos/` directory so existing users don't lose sessions, secrets, or
 * materials.
 *
 * Writes always go to the new `.storyos/` path (via {@link resolveWriteRuntimeDir}).
 */

const NEW_DIR = ".storyos";
const LEGACY_DIR = ".inkos";

/**
 * Returns the effective runtime directory for reading. Prefers `.storyos/` but
 * falls back to `.inkos/` when only the legacy directory exists.
 */
export function resolveRuntimeDir(projectRoot: string): string {
  const newPath = join(projectRoot, NEW_DIR);
  if (existsSync(newPath)) return newPath;
  const legacyPath = join(projectRoot, LEGACY_DIR);
  if (existsSync(legacyPath)) return legacyPath;
  return newPath;
}

/**
 * Returns the `.storyos/` path for writing (always new name so new data lands
 * in the right place going forward).
 */
export function resolveWriteRuntimeDir(projectRoot: string): string {
  return join(projectRoot, NEW_DIR);
}
