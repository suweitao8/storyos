import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findAvailablePortPair, createRuntimeConfig } from "./worktree-runtime.mjs";
import { readWorktreeContext } from "./worktree-guard.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function ensureRuntimeDirectories(config) {
  await Promise.all([
    mkdir(config.logDir, { recursive: true }),
    mkdir(config.screenshotDir, { recursive: true }),
    mkdir(config.projectRuntimeDir, { recursive: true }),
  ]);
  return {
    logDir: config.logDir,
    screenshotDir: config.screenshotDir,
    projectRuntimeDir: config.projectRuntimeDir,
  };
}

export function buildStudioLaunchPlan({
  projectRoot,
  studioRoot,
  config,
  command = process.execPath,
  tsxCli = resolve(studioRoot, "node_modules", "tsx", "dist", "cli.mjs"),
  viteCli = resolve(studioRoot, "node_modules", "vite", "bin", "vite.js"),
  baseEnv = process.env,
}) {
  const commonEnv = {
    ...baseEnv,
    STORYOS_PROJECT_ROOT: projectRoot,
    STORYOS_STUDIO_PORT: String(config.serverPort),
    STORYOS_STUDIO_CLIENT_PORT: String(config.clientPort),
  };

  return {
    api: {
      command,
      args: [tsxCli, "watch", "--clear-screen=false", "src/api/index.ts"],
      cwd: studioRoot,
      env: commonEnv,
      stdoutPath: resolve(config.logDir, "server.out.log"),
      stderrPath: resolve(config.logDir, "server.err.log"),
    },
    client: {
      command,
      args: [viteCli, "--host", "--port", String(config.clientPort)],
      cwd: studioRoot,
      env: commonEnv,
      stdoutPath: resolve(config.logDir, "client.out.log"),
      stderrPath: resolve(config.logDir, "client.err.log"),
    },
  };
}

function spawnPlannedProcess(entry, spawnProcess) {
  const child = spawnProcess(entry.command, entry.args, {
    cwd: entry.cwd,
    env: entry.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(createWriteStream(entry.stdoutPath, { flags: "a" }));
  child.stderr?.pipe(createWriteStream(entry.stderrPath, { flags: "a" }));
  return child;
}

function killChild(child) {
  if (child && !child.killed) child.kill();
}

export async function startStudio({
  projectRoot,
  branch,
  studioRoot = resolve(repositoryRoot, "packages", "studio"),
  env = process.env,
  spawnProcess = spawn,
}) {
  let config = createRuntimeConfig({ branch, projectRoot, env });
  const hasExplicitPorts = env.STORYOS_STUDIO_CLIENT_PORT || env.STORYOS_STUDIO_PORT;
  if (!hasExplicitPorts) {
    const ports = await findAvailablePortPair({ preferredClientPort: config.clientPort });
    config = { ...config, ...ports };
  }

  await ensureRuntimeDirectories(config);
  const plan = buildStudioLaunchPlan({
    projectRoot,
    studioRoot,
    config,
    baseEnv: env,
  });

  const api = spawnPlannedProcess(plan.api, spawnProcess);
  let client;
  try {
    client = spawnPlannedProcess(plan.client, spawnProcess);
  } catch (error) {
    killChild(api);
    throw error;
  }

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    killChild(client);
    killChild(api);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return {
    config,
    plan,
    children: { api, client },
    shutdown,
    dispose() {
      process.off("SIGINT", shutdown);
      process.off("SIGTERM", shutdown);
    },
  };
}

async function waitForStudioExit(children) {
  return new Promise((resolveExit) => {
    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      resolveExit(code ?? 1);
    };
    children.api.once("exit", finish);
    children.client.once("exit", finish);
  });
}

if (process.argv[1] && process.argv[1].endsWith("studio-dev.mjs")) {
  const context = readWorktreeContext(process.cwd());
  const session = await startStudio({
    projectRoot: process.env.STORYOS_PROJECT_ROOT ?? context.worktreePath,
    branch: context.branch,
    studioRoot: resolve(context.worktreePath, "packages", "studio"),
  });
  const exitCode = await waitForStudioExit(session.children);
  session.shutdown();
  session.dispose();
  process.exitCode = exitCode;
}
