import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { ensureProjectGitignore, ensureProjectSupportFiles } from "@actalk/inkos-core";

export interface ProjectBootstrapOptions {
  readonly language?: "zh" | "en";
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

function buildProjectConfig(projectDir: string, language: "zh" | "en") {
  return {
    name: basename(projectDir),
    version: "0.1.0" as const,
    language,
    llm: {
      provider: "openai" as const,
      service: "custom",
      configSource: "studio" as const,
      baseUrl: "",
      model: "",
      apiFormat: "chat" as const,
      stream: true,
    },
    notify: [],
    inputGovernanceMode: "v2" as const,
    daemon: {
      schedule: {
        radarCron: "0 */6 * * *",
        writeCron: "*/15 * * * *",
      },
      maxConcurrentBooks: 3,
    },
  };
}

export { ensureProjectGitignore } from "@actalk/inkos-core";

export async function initializeProjectDirectory(
  projectDir: string,
  options: ProjectBootstrapOptions = {},
): Promise<void> {
  const language = options.language ?? "zh";
  const overwriteSupportFiles = options.overwriteSupportFiles ?? true;
  const configPath = join(projectDir, "inkos.json");

  if (await exists(configPath)) {
    throw new Error(`inkos.json already exists in ${projectDir}. Use a different directory or delete the existing project.`);
  }

  await mkdir(projectDir, { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify(buildProjectConfig(projectDir, language), null, 2),
    "utf-8",
  );
  await ensureProjectSupportFiles(projectDir, { overwriteSupportFiles });
}

export async function ensureProjectDirectoryInitialized(
  projectDir: string,
  options: Omit<ProjectBootstrapOptions, "overwriteSupportFiles"> = {},
): Promise<boolean> {
  const configPath = join(projectDir, "inkos.json");
  if (await exists(configPath)) {
    await ensureProjectSupportFiles(projectDir, { overwriteSupportFiles: false });
    return false;
  }

  await initializeProjectDirectory(projectDir, {
    language: options.language,
    overwriteSupportFiles: false,
  });
  return true;
}
