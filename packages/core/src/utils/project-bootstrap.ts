import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GLOBAL_ENV_PATH } from "./llm-env.js";

export interface ProjectSupportFileOptions {
  readonly overwriteSupportFiles?: boolean;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function hasGlobalConfig(): Promise<boolean> {
  try {
    const content = await readFile(GLOBAL_ENV_PATH, "utf-8");
    return content.includes("STORYOS_LLM_API_KEY=") && !content.includes("your-api-key-here");
  } catch {
    return false;
  }
}

async function writeMaybe(path: string, content: string, overwrite: boolean): Promise<void> {
  if (!overwrite && await exists(path)) {
    return;
  }
  await writeFile(path, content, "utf-8");
}

const DEFAULT_GITIGNORE_ENTRIES = [".env", "node_modules/", ".DS_Store"] as const;

export async function ensureProjectGitignore(projectDir: string): Promise<void> {
  const path = join(projectDir, ".gitignore");
  let existing = "";
  if (await exists(path)) {
    existing = await readFile(path, "utf-8");
  }

  const existingEntries = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#")),
  );
  const missing = DEFAULT_GITIGNORE_ENTRIES.filter((entry) => !existingEntries.has(entry));
  if (missing.length === 0) return;

  if (!existing) {
    await writeFile(path, `${missing.join("\n")}\n`, "utf-8");
    return;
  }

  const separator = existing.endsWith("\n") ? "" : "\n";
  await writeFile(path, `${existing}${separator}${missing.join("\n")}\n`, "utf-8");
}

function buildProjectEnvTemplate(globalConfigured: boolean): string {
  if (globalConfigured) {
    return [
      "# Project-level LLM overrides (optional)",
      "# Global config at ~/.storyos/.env will be used by default.",
      "# Switch Studio to 'Use Studio config' if you want per-project service settings.",
      "# Uncomment below to override for this project only:",
      "# STORYOS_LLM_PROVIDER=anthropic",
      "# STORYOS_LLM_BASE_URL=",
      "# STORYOS_LLM_API_KEY=",
      "# STORYOS_LLM_MODEL=",
      "",
      "# Web search (optional):",
      "# TAVILY_API_KEY=tvly-xxxxx",
      "",
    ].join("\n");
  }

  return [
    "# Optional project-level LLM overrides",
    "# Studio can manage provider / model / key without editing this file.",
    "# Uncomment only if you want this directory to force env-based config:",
    "# STORYOS_LLM_PROVIDER=openai",
    "# STORYOS_LLM_BASE_URL=",
    "# STORYOS_LLM_API_KEY=",
    "# STORYOS_LLM_MODEL=",
    "# STORYOS_LLM_API_FORMAT=chat",
    "# STORYOS_LLM_STREAM=true",
    "",
    "# Web search (optional):",
    "# TAVILY_API_KEY=tvly-xxxxx",
    "",
  ].join("\n");
}

export async function ensureProjectSupportFiles(
  projectDir: string,
  options: ProjectSupportFileOptions = {},
): Promise<void> {
  const overwriteSupportFiles = options.overwriteSupportFiles ?? true;
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, "books"), { recursive: true });
  await mkdir(join(projectDir, "radar"), { recursive: true });

  const globalConfigured = await hasGlobalConfig();
  await Promise.all([
    writeMaybe(join(projectDir, ".env"), buildProjectEnvTemplate(globalConfigured), overwriteSupportFiles),
    ensureProjectGitignore(projectDir),
    writeMaybe(join(projectDir, ".nvmrc"), "22\n", overwriteSupportFiles),
    writeMaybe(join(projectDir, ".node-version"), "22\n", overwriteSupportFiles),
  ]);
}
