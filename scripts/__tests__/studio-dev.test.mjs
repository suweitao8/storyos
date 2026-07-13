import { strict as assert } from "node:assert";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createRuntimeConfig } from "../worktree-runtime.mjs";
import { buildStudioLaunchPlan, ensureRuntimeDirectories, startStudio } from "../studio-dev.mjs";

test("Studio launch plan passes task ports and worktree project root", () => {
  const projectRoot = "D:/work/storyos/.worktrees/story-settings";
  const config = createRuntimeConfig({
    branch: "codex/story-settings",
    projectRoot,
    env: { INKOS_STUDIO_CLIENT_PORT: "4700", INKOS_STUDIO_PORT: "4702" },
  });
  const plan = buildStudioLaunchPlan({
    projectRoot,
    studioRoot: join(projectRoot, "packages", "studio"),
    config,
    command: "node",
    tsxCli: "tsx-cli.mjs",
    viteCli: "vite.js",
    baseEnv: { INKOS_LLM_PROVIDER: "test" },
  });

  assert.deepEqual(plan.api.args, ["tsx-cli.mjs", "watch", "--clear-screen=false", "src/api/index.ts"]);
  assert.deepEqual(plan.client.args, ["vite.js", "--host", "--port", "4700"]);
  assert.equal(plan.api.cwd, plan.client.cwd);
  assert.equal(plan.api.env.INKOS_PROJECT_ROOT, projectRoot);
  assert.equal(plan.api.env.INKOS_STUDIO_PORT, "4702");
  assert.equal(plan.client.env.INKOS_STUDIO_PORT, "4702");
  assert.equal(plan.api.env.INKOS_LLM_PROVIDER, "test");
});

test("default Studio commands use Node entrypoints instead of Windows cmd shims", () => {
  const projectRoot = "D:/work/storyos/.worktrees/story-settings";
  const config = createRuntimeConfig({ branch: "codex/story-settings", projectRoot });
  const plan = buildStudioLaunchPlan({ projectRoot, studioRoot: join(projectRoot, "packages", "studio"), config });

  assert.equal(plan.api.command, process.execPath);
  assert.equal(plan.client.command, process.execPath);
  assert.match(plan.api.args[0], /tsx[\\/]dist[\\/]cli\.mjs$/);
  assert.match(plan.client.args[0], /vite[\\/]bin[\\/]vite\.js$/);
});

test("runtime directory setup creates task-scoped logs and screenshots", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "inkos-studio-"));
  const config = createRuntimeConfig({ branch: "codex/asset-review", projectRoot });
  const dirs = await ensureRuntimeDirectories(config);

  assert.equal(dirs.logDir, config.logDir);
  assert.equal(dirs.screenshotDir, config.screenshotDir);
  await access(config.logDir);
  await access(config.screenshotDir);
  await rm(projectRoot, { recursive: true, force: true });
});

test("Studio source root stays separate from an overridden project data root", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "inkos-project-"));
  const calls = [];
  const fakeChild = () => ({
    killed: false,
    stdout: { pipe() {} },
    stderr: { pipe() {} },
    once() {},
    kill() { this.killed = true; },
  });
  const session = await startStudio({
    projectRoot,
    branch: "codex/project-root",
    env: {
      INKOS_STUDIO_CLIENT_PORT: "4910",
      INKOS_STUDIO_PORT: "4912",
    },
    spawnProcess: (command, args, options) => {
      calls.push({ command, args, options });
      return fakeChild();
    },
  });

  assert.equal(calls[0].options.cwd, join(process.cwd(), "packages", "studio"));
  assert.equal(calls[0].options.env.INKOS_PROJECT_ROOT, projectRoot);
  session.shutdown();
  session.dispose();
  await rm(projectRoot, { recursive: true, force: true });
});
