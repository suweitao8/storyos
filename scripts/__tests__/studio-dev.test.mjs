import { strict as assert } from "node:assert";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createRuntimeConfig } from "../worktree-runtime.mjs";
import { buildStudioLaunchPlan, ensureRuntimeDirectories } from "../studio-dev.mjs";

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
    command: "pnpm.cmd",
    baseEnv: { INKOS_LLM_PROVIDER: "test" },
  });

  assert.deepEqual(plan.api.args, ["exec", "tsx", "watch", "--clear-screen=false", "src/api/index.ts"]);
  assert.deepEqual(plan.client.args, ["exec", "vite", "--host", "--port", "4700"]);
  assert.equal(plan.api.cwd, plan.client.cwd);
  assert.equal(plan.api.env.INKOS_PROJECT_ROOT, projectRoot);
  assert.equal(plan.api.env.INKOS_STUDIO_PORT, "4702");
  assert.equal(plan.client.env.INKOS_STUDIO_PORT, "4702");
  assert.equal(plan.api.env.INKOS_LLM_PROVIDER, "test");
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
