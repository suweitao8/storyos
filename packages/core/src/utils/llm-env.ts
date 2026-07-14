import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "dotenv";

export const GLOBAL_CONFIG_DIR = join(homedir(), ".storyos");
export const GLOBAL_ENV_PATH = join(GLOBAL_CONFIG_DIR, ".env");
/** Pre-rename path — kept so existing users' ~/.inkos/.env keeps working. */
const LEGACY_GLOBAL_ENV_PATH = join(homedir(), ".inkos", ".env");

/**
 * Returns the effective global .env path. Prefers the current ~/.storyos/.env,
 * but falls back to the legacy ~/.inkos/.env so existing setups keep working
 * after the brand rename.
 */
export function resolveGlobalEnvPath(): string {
  if (existsSync(GLOBAL_ENV_PATH)) return GLOBAL_ENV_PATH;
  if (existsSync(LEGACY_GLOBAL_ENV_PATH)) return LEGACY_GLOBAL_ENV_PATH;
  return GLOBAL_ENV_PATH;
}

export type LLMEnvMap = Record<string, string | undefined>;

export interface LLMEnvLayers {
  readonly global: LLMEnvMap;
  readonly project: LLMEnvMap;
  readonly process: LLMEnvMap;
}

export async function loadLLMEnvLayers(
  root: string,
  processEnv: NodeJS.ProcessEnv = process.env,
): Promise<LLMEnvLayers> {
  const global = await parseEnvFile(resolveGlobalEnvPath());
  const project = await parseEnvFile(join(root, ".env"));
  // Compatibility: modelOverrides.apiKeyEnv and detector config still read process.env directly.
  hydrateProcessEnvFromEnvFiles(processEnv, global, project);

  return {
    global,
    project,
    process: { ...processEnv },
  };
}

export function mergeEnvMaps(...layers: readonly LLMEnvMap[]): LLMEnvMap {
  const merged: LLMEnvMap = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined) merged[key] = value;
    }
  }
  return merged;
}

export function studioIgnoredEnv(layers: LLMEnvLayers): LLMEnvMap {
  return mergeEnvMaps(layers.global, layers.project, layers.process);
}

export function cliOverlayEnv(layers: LLMEnvLayers): LLMEnvMap {
  return mergeEnvMaps(layers.global, layers.project, layers.process);
}

export function legacyEnv(layers: LLMEnvLayers): LLMEnvMap {
  return mergeEnvMaps(layers.global, layers.project, layers.process);
}

async function parseEnvFile(path: string): Promise<LLMEnvMap> {
  try {
    return parse(await readFile(path, "utf-8"));
  } catch {
    return {};
  }
}

function hydrateProcessEnvFromEnvFiles(
  processEnv: NodeJS.ProcessEnv,
  global: LLMEnvMap,
  project: LLMEnvMap,
): void {
  const fileEnv = mergeEnvMaps(global, project);
  for (const [key, value] of Object.entries(fileEnv)) {
    if (value !== undefined && processEnv[key] === undefined) {
      processEnv[key] = value;
    }
  }
}
